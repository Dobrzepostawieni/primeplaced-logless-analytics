<?php
/**
 * Tracking Controller.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Rest;

use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Services\IdentityResolver;
use Primeplaced_Logless_Analytics\Services\DeviceDetector;
use Primeplaced_Logless_Analytics\Services\BufferManager;
use Primeplaced_Logless_Analytics\Services\EventFeaturePolicy;
use Primeplaced_Logless_Analytics\Services\EventContract;
use Primeplaced_Logless_Analytics\Services\ClientIpResolver;
use Primeplaced_Logless_Analytics\Services\TrackingContextSanitizer;
use Primeplaced_Logless_Analytics\Services\TrackingRateLimiter;
use Primeplaced_Logless_Analytics\Services\TrackingRequestBudget;
use Primeplaced_Logless_Analytics\Services\UrlExclusionPatterns;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class TrackingController
 *
 * Coordinates multi-channel tracking payload parsing and ingestion.
 */
class TrackingController extends Base {

	/** Stable idempotency key format shared by hits and events. */
	private const TRACKING_ID_PATTERN = '/^[a-zA-Z0-9_-]{16,64}$/';

	/**
	 * Identity Resolver instance.
	 */
	private IdentityResolver $identity_resolver;

	/**
	 * Device Detector instance.
	 */
	private DeviceDetector $device_detector;

	/**
	 * Buffer Manager instance.
	 */
	private BufferManager $buffer_manager;

	/**
	 * Event Feature Policy instance.
	 */
	private EventFeaturePolicy $event_feature_policy;

	/** Stable Core event envelope normalizer. */
	private EventContract $event_contract;

	/** Shared privacy sanitizer for page context. */
	private TrackingContextSanitizer $context_sanitizer;

	/** Privacy-safe abuse protection for the public tracking endpoint. */
	private TrackingRateLimiter $rate_limiter;

	/** Shared logical and wire limits for public tracking requests. */
	private TrackingRequestBudget $request_budget;

	/**
	 * TrackingController constructor.
	 *
	 * @param IdentityResolver         $identity_resolver    Rotating pseudonymous session hashes.
	 * @param DeviceDetector           $device_detector      Device category detection.
	 * @param BufferManager            $buffer_manager       Buffered hit storage.
	 * @param EventFeaturePolicy       $event_feature_policy Event feature policy.
	 * @param EventContract            $event_contract       Event contract normalizer.
	 * @param TrackingContextSanitizer $context_sanitizer    Page-context privacy boundary.
	 * @param TrackingRateLimiter      $rate_limiter         Rate limiter for public tracking requests.
	 */
	public function __construct( IdentityResolver $identity_resolver, DeviceDetector $device_detector, BufferManager $buffer_manager, EventFeaturePolicy $event_feature_policy, EventContract $event_contract, TrackingContextSanitizer $context_sanitizer, TrackingRateLimiter $rate_limiter ) {
		$this->identity_resolver    = $identity_resolver;
		$this->device_detector      = $device_detector;
		$this->buffer_manager       = $buffer_manager;
		$this->event_feature_policy = $event_feature_policy;
		$this->event_contract       = $event_contract;
		$this->context_sanitizer    = $context_sanitizer;
		$this->rate_limiter         = $rate_limiter;
		$this->request_budget       = new TrackingRequestBudget();
	}

	/**
	 * Registers the tracking route and the request-size guard.
	 *
	 * @return bool True on success.
	 */
	public function initialize(): bool {
		if ( ! parent::initialize() ) {
			return false;
		}

		\add_action( 'rest_api_init', array( $this, 'register_tracking_route' ) );
		\add_filter( 'rest_pre_dispatch', array( $this, 'guard_rest_tracking_request' ), 10, 3 );

		return true;
	}

	/**
	 * Registers the primary REST API endpoint for analytical tracking.
	 */
	public function register_tracking_route(): void {
		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/track',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'handle_tracking_request' ),
					// Public by design: anonymous visitors report pageviews. Requests are
					// size-limited, validated, minimized and rate limited before queuing.
					'permission_callback' => '__return_true',
					'args'                => $this->get_endpoint_args(),
				),
			)
		);
	}

	/**
	 * Handles a tracking request sent to the REST endpoint.
	 *
	 * @param WP_REST_Request $request Tracking request.
	 * @return WP_REST_Response Ingestion result.
	 */
	public function handle_tracking_request( WP_REST_Request $request ): WP_REST_Response {
		if ( 'true' === $request->get_header( 'X-PPLA-Diagnostic' ) ) {
			$nonce = (string) $request->get_header( 'X-WP-Nonce' );

			if ( ! \wp_verify_nonce( $nonce, 'wp_rest' ) ) {
				return new WP_REST_Response( array( 'error' => 'Unauthorized diagnostic request' ), 403 );
			}
			return new WP_REST_Response( array( 'status' => 'diagnostic_ok' ), 201 );
		}

		$payload      = $request->get_params();
		$budget_error = $this->get_budget_error( $payload, (string) $request->get_body() );
		if ( null !== $budget_error ) {
			return $budget_error;
		}
		$payload = $this->request_budget->normalize_logical_payload( $payload );
		if ( null === $payload ) {
			return new WP_REST_Response( array( 'error' => 'Invalid tracking payload' ), 400 );
		}

		$raw_url    = $payload['url'];
		$raw_hit_id = $payload['hit_id'];

		$raw_referrer    = $payload['referrer'];
		$raw_agent       = $request->get_header( 'user-agent' );
		$raw_events      = $payload['events'];
		$device_hint     = $payload['device_hint'];
		$record_pageview = $payload['record_pageview'];

		$hit_id     = \is_string( $raw_hit_id ) ? \sanitize_text_field( $raw_hit_id ) : '';
		$url        = \is_string( $raw_url ) ? \esc_url_raw( $raw_url ) : '';
		$referrer   = \is_string( $raw_referrer ) ? \sanitize_text_field( $raw_referrer ) : '';
		$user_agent = \is_string( $raw_agent ) ?
			\sanitize_text_field( $raw_agent ) : '';

		if ( 'tablet' === $device_hint ) {
			$user_agent .= ' iPad';
		}

		if ( ! $this->is_valid_tracking_id( $hit_id ) ) {
			return new WP_REST_Response( array( 'error' => 'Invalid tracking hit ID' ), 400 );
		}
		$events_error = $this->validate_events_value( $raw_events );
		if ( null !== $events_error ) {
			return new WP_REST_Response( array( 'error' => $events_error->get_error_message() ), 400 );
		}
		$events = $this->event_contract->normalize_events( $raw_events, $hit_id );
		if ( ! $record_pageview && empty( $events ) ) {
			// Only unsupported events remained: acknowledge so the tracker does not retry.
			if ( array() !== $this->decode_event_candidates( $raw_events ) ) {
				return new WP_REST_Response( array( 'status' => 'ignored' ), 202 );
			}
			return new WP_REST_Response( array( 'error' => 'Tracking payload must contain a pageview or event' ), 400 );
		}

		if ( ! $this->process_and_buffer_hit( $hit_id, $url, $referrer, $user_agent, $record_pageview, $events ) ) {
			return new WP_REST_Response( array( 'error' => 'Unable to buffer analytics payload' ), 503 );
		}

		return new WP_REST_Response( array( 'status' => 'buffered' ), 201 );
	}

	/**
	 * Handles a tracking request sent through the admin-ajax fallback.
	 *
	 * Like the REST route, this endpoint is public: visitors are not logged in
	 * and cached pages cannot carry a valid nonce. Requests are instead bounded
	 * in size, validated field by field and rate limited. Only the
	 * administrator's diagnostic probe is nonce-protected.
	 */
	public function handle_ajax_tracking(): void {
		$is_diagnostic = isset( $_POST['is_diagnostic'] ) && '1' === \sanitize_text_field( \wp_unslash( $_POST['is_diagnostic'] ) );
		if ( $is_diagnostic ) {
			\check_ajax_referer( 'wp_rest', '_wpnonce' );
			\wp_send_json_success( array( 'status' => 'diagnostic_ok' ), 201 );
		}

		$content_length = isset( $_SERVER['CONTENT_LENGTH'] ) && \is_string( $_SERVER['CONTENT_LENGTH'] )
			? \sanitize_text_field( \wp_unslash( $_SERVER['CONTENT_LENGTH'] ) )
			: null;
		if ( null !== $content_length && ctype_digit( $content_length ) && (int) $content_length > TrackingRequestBudget::MAX_WIRE_BYTES ) {
			\wp_send_json_error( array( 'error' => 'Tracking payload is too large' ), 413 );
		}

		$wire_body = $this->read_ajax_wire_body();
		if ( ! $this->request_budget->allows_wire_body( $wire_body, $content_length ) ) {
			\wp_send_json_error( array( 'error' => 'Tracking payload is too large' ), 413 );
		}

		$payload = array();
		foreach ( array( 'hit_id', 'referrer', 'record_pageview', 'device_hint' ) as $field ) {
			if ( isset( $_POST[ $field ] ) && \is_string( $_POST[ $field ] ) ) {
				$payload[ $field ] = \sanitize_text_field( \wp_unslash( $_POST[ $field ] ) );
			}
		}
		if ( isset( $_POST['url'] ) && \is_string( $_POST['url'] ) ) {
			$payload['url'] = \esc_url_raw( \wp_unslash( $_POST['url'] ) );
		}
		$events_input = $this->read_posted_events();
		if ( null === $events_input ) {
			\wp_send_json_error( array( 'error' => 'Events payload must be valid JSON.' ), 400 );
		}
		$payload['events'] = $events_input;
		$budget_error      = $this->get_budget_error( $payload, $wire_body );
		if ( null !== $budget_error ) {
			\wp_send_json_error( array( 'error' => $budget_error->get_data()['error'] ), $budget_error->get_status() );
		}
		$payload = $this->request_budget->normalize_logical_payload( $payload );
		if ( null === $payload ) {
			\wp_send_json_error( array( 'error' => 'Invalid tracking payload' ), 400 );
		}

		$hit_id          = \sanitize_text_field( $payload['hit_id'] );
		$url             = \esc_url_raw( $payload['url'] );
		$referrer        = \sanitize_text_field( $payload['referrer'] );
		$record_pageview = $payload['record_pageview'];

		if ( ! $this->is_valid_tracking_id( $hit_id ) ) {
			\wp_send_json_error( array( 'error' => 'Invalid tracking hit ID' ), 400 );
		}

		$agent = '';
		if ( isset( $_SERVER['HTTP_USER_AGENT'] ) && \is_string( $_SERVER['HTTP_USER_AGENT'] ) ) {
			$agent = \sanitize_text_field( \wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) );
		}

		if ( 'tablet' === $payload['device_hint'] ) {
			$agent .= ' iPad';
		}
		$events_error = $this->validate_events_value( $payload['events'] );
		if ( null !== $events_error ) {
			\wp_send_json_error( array( 'error' => $events_error->get_error_message() ), 400 );
		}
		$events = $this->event_contract->normalize_events( $payload['events'], $hit_id );
		if ( ! $record_pageview && empty( $events ) ) {
			if ( array() !== $this->decode_event_candidates( $payload['events'] ) ) {
				\wp_send_json_success( array( 'status' => 'ignored' ), 202 );
			}
			\wp_send_json_error( array( 'error' => 'Tracking payload must contain a pageview or event' ), 400 );
		}

		if ( ! $this->process_and_buffer_hit( $hit_id, $url, $referrer, $agent, $record_pageview, $events ) ) {
			\wp_send_json_error( array( 'error' => 'Unable to buffer analytics payload' ), 503 );
		}

		\wp_send_json_success( array( 'status' => 'buffered' ), 201 );
	}

	/**
	 * Checks the untouched REST body before WordPress parses and validates route arguments.
	 *
	 * @param mixed           $result  Existing pre-dispatch result.
	 * @param WP_REST_Server  $server  REST server instance.
	 * @param WP_REST_Request $request Current REST request.
	 * @return mixed Existing result or a tracking payload error response.
	 */
	public function guard_rest_tracking_request( $result, WP_REST_Server $server, WP_REST_Request $request ) {
		if ( null !== $result || 'POST' !== $request->get_method() || '/' . \PPLA_API_NAMESPACE . '/track' !== $request->get_route() ) {
			return $result;
		}

		$body           = (string) $request->get_body();
		$content_length = $request->get_header( 'content-length' );
		if ( ! $this->request_budget->allows_wire_body( $body, \is_string( $content_length ) ? $content_length : null ) ) {
			return new WP_REST_Response( array( 'error' => 'Tracking payload is too large' ), 413 );
		}

		$query_params = $request->get_query_params();
		// `rest_route` selects the endpoint on non-pretty permalinks; it is not
		// tracking payload data and must not consume the logical request budget.
		unset( $query_params['rest_route'] );
		$request->set_query_params( $query_params );
		$params = $query_params;
		if ( '' !== $body && $request->is_json_content_type() ) {
			$decoded = \json_decode( $body, true );
			if ( JSON_ERROR_NONE !== \json_last_error() || ! \is_array( $decoded ) ) {
				return new WP_REST_Response( array( 'error' => 'Invalid tracking payload' ), 400 );
			}
			$params = array_merge( $query_params, $decoded );
		} elseif ( '' !== $body ) {
			\parse_str( $body, $body_params );
			if ( \is_array( $body_params ) ) {
				$params = array_merge( $query_params, $body_params );
			}
		} else {
			$params = $request->get_params();
		}

		$error = $this->get_budget_error( $params, $body );
		if ( null !== $error ) {
			return $error;
		}

		$normalized = $this->request_budget->normalize_logical_payload( $params );
		if ( null !== $normalized && \array_key_exists( 'events', $params ) ) {
			// WP_REST_Request exposes set_param(), not set_json_params(). This
			// updates its parsed JSON/body source before route argument validation.
			$request->set_param( 'events', $normalized['events'] );
		}

		return $result;
	}

	/**
	 * Validates byte budgets and the canonical field envelope.
	 *
	 * @param array<string,mixed> $payload Known tracking fields and possible raw extras.
	 * @param string              $wire_body Original request body bytes.
	 */
	private function get_budget_error( array $payload, string $wire_body ): ?WP_REST_Response {
		if ( ! $this->request_budget->allows_wire_body( $wire_body ) ) {
			return new WP_REST_Response( array( 'error' => 'Tracking payload is too large' ), 413 );
		}

		$bytes = $this->request_budget->measure_logical_bytes( $payload );
		if ( null === $bytes ) {
			return new WP_REST_Response( array( 'error' => 'Invalid tracking payload' ), 400 );
		}
		if ( $bytes > TrackingRequestBudget::MAX_LOGICAL_BYTES ) {
			return new WP_REST_Response( array( 'error' => 'Tracking payload is too large' ), 413 );
		}

		return null;
	}

	/**
	 * Reads at most one byte beyond the public AJAX wire ceiling.
	 *
	 * Re-encoding $_POST cannot establish the size of the original request. When
	 * Content-Length is absent, use PHP's raw input stream instead.
	 */
	private function read_ajax_wire_body(): string {
		$stream = \fopen( 'php://input', 'rb' );
		if ( false === $stream ) {
			return '';
		}

		$body = \stream_get_contents( $stream, TrackingRequestBudget::MAX_WIRE_BYTES + 1 );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- Closes the bounded raw request stream opened above.
		\fclose( $stream );

		return \is_string( $body ) ? $body : '';
	}

	/**
	 * Applies the tracking exclusions and queues a hit in the database buffer.
	 *
	 * @param string                           $hit_id          Stable transport idempotency key.
	 * @param string                           $url             Sanitized page URL.
	 * @param string                           $referrer        Sanitized referrer URL.
	 * @param string                           $user_agent      Sanitized User-Agent header, used only in memory.
	 * @param bool                             $record_pageview Whether this hit represents a page load.
	 * @param array<int, array<string, mixed>> $events          Sanitized event envelopes.
	 * @return bool True when the hit was buffered or intentionally excluded.
	 */
	private function process_and_buffer_hit( string $hit_id, string $url, string $referrer, string $user_agent, bool $record_pageview, array $events = array() ): bool {
		$settings = \get_option( 'ppla_settings', array() );
		$settings = \is_array( $settings ) ? $settings : array();

		if ( '' === $url || ! $this->is_site_url( $url ) ) {
			return true;
		}

		$filter_bots = isset( $settings['filter_bots'] ) ? (bool) $settings['filter_bots'] : true;
		if ( $filter_bots && $this->is_bot( $user_agent ) ) {
			return true;
		}

		$ip_address = ClientIpResolver::resolve_from_server( $settings );

		$strict_anonymous_mode = isset( $settings['strict_anonymous_mode'] ) ? (bool) $settings['strict_anonymous_mode'] : true;

		$excluded_ips = isset( $settings['excluded_ips'] ) && \is_array( $settings['excluded_ips'] ) ? $settings['excluded_ips'] : array();
		if ( '' !== $ip_address && \in_array( $ip_address, $excluded_ips, true ) ) {
			return true;
		}

		if ( ! $this->rate_limiter->allows_request( $ip_address ) ) {
			return true;
		}

		// Classify paid acquisition while the raw query is still available; the
		// sanitized URL deliberately discards all campaign parameters.
		$acquisition_channel = $this->context_sanitizer->get_acquisition_channel( $url );
		$clean_url           = $this->context_sanitizer->sanitize_url( $url );
		$referrer            = $this->context_sanitizer->sanitize_referrer( $referrer );

		$excluded_urls = isset( $settings['excluded_urls'] ) && \is_array( $settings['excluded_urls'] ) ? $settings['excluded_urls'] : array();
		if ( UrlExclusionPatterns::matches_any( $excluded_urls, $clean_url ) ) {
			return true;
		}

		$device_type = $this->device_detector->detect_device( $user_agent );
		if ( '' === $ip_address && ! $strict_anonymous_mode ) {
			return true;
		}

		$sessionless_events = array();
		$standard_events    = array();
		foreach ( $events as $event ) {
			if ( $this->event_feature_policy->event_uses_session( $event ) || $this->event_feature_policy->event_allows_attribution( $event ) ) {
				$standard_events[] = $event;
				continue;
			}

			$sessionless_events[] = $event;
		}

		$payload = array(
			'hit_id'              => $hit_id,
			'privacy_mode'        => $strict_anonymous_mode ? 'strict_anonymous' : 'session_hash',
			'device_type'         => $device_type,
			'url'                 => $clean_url,
			'referrer'            => $referrer,
			'acquisition_channel' => $acquisition_channel,
			'record_pageview'     => $record_pageview,
			'events'              => $standard_events,
		);

		if ( ! $strict_anonymous_mode ) {
			$payload['session_hash'] = $this->identity_resolver->generate_session_hash( $ip_address, $user_agent );
		}

		if ( $record_pageview || array() !== $standard_events ) {
			if ( ! $this->buffer_manager->push_hit(
				\apply_filters(
					'ppla_tracker_hit_payload',
					$payload,
					$ip_address,
					$user_agent
				)
			) ) {
				return false;
			}
		}

		if ( array() === $sessionless_events ) {
			return true;
		}

		$sessionless_payload = array(
			'hit_id'          => $hit_id,
			'privacy_mode'    => 'strict_anonymous',
			// Device class is server-derived from the request user agent. It is a
			// low-cardinality reporting dimension, not visitor identity.
			'device_type'     => $device_type,
			'url'             => '',
			'referrer'        => '',
			'record_pageview' => false,
			'events'          => $sessionless_events,
		);
		$sessionless_payload = \apply_filters( 'ppla_tracker_hit_payload', $sessionless_payload, $ip_address, $user_agent );
		// A third-party filter may enrich ordinary hits. Re-apply the immutable
		// contract's minimization before buffering a sessionless event batch.
		$sessionless_payload['hit_id']              = '';
		$sessionless_payload['privacy_mode']        = 'strict_anonymous';
		$sessionless_payload['device_type']         = $device_type;
		$sessionless_payload['url']                 = '';
		$sessionless_payload['referrer']            = '';
		$sessionless_payload['acquisition_channel'] = '';
		$sessionless_payload['record_pageview']     = false;
		unset( $sessionless_payload['session_hash'] );

		return $this->buffer_manager->push_hit( $sessionless_payload );
	}

	/**
	 * Detects if the given user agent belongs to a known bot or crawler.
	 *
	 * @param string $user_agent The browser user agent string.
	 * @return bool True if a bot is detected, false otherwise.
	 */
	private function is_bot( string $user_agent ): bool {
		if ( empty( $user_agent ) ) {
			return true;
		}
		$bot_pattern = '/(bot|crawler|spider|slurp|facebookexternalhit|snippet|archive|ia_archiver|google|bing|yandex|yahoo|baidu|ahrefs)/i';

		return (bool) \preg_match( $bot_pattern, $user_agent );
	}

	/**
	 * Accepts relative URLs and URLs on this site's host, ignoring a `www.` prefix.
	 *
	 * Drops hits from a copied tracker on another site. It cannot stop a forged
	 * hit that names this host; the rate limiter bounds those.
	 *
	 * @param string $url Sanitized tracked URL.
	 */
	private function is_site_url( string $url ): bool {
		$host = \wp_parse_url( $url, PHP_URL_HOST );
		if ( ! \is_string( $host ) || '' === $host ) {
			return true;
		}

		/**
		 * Filters the hosts whose pages may be tracked, e.g. for mapped or translated domains.
		 *
		 * @param array<int, string> $hosts Allowed hosts; defaults to the home URL host.
		 */
		$hosts = (array) \apply_filters( 'ppla_tracking_allowed_hosts', array( (string) \wp_parse_url( \home_url(), PHP_URL_HOST ) ) );
		$bare  = static fn( $value ): string => \is_string( $value ) ? (string) \preg_replace( '/^www\./', '', \strtolower( $value ) ) : '';

		return \in_array( $bare( $host ), \array_map( $bare, $hosts ), true );
	}

	/**
	 * Decodes the untrusted events value into its list of candidates.
	 *
	 * @param mixed $raw_events Candidate array or JSON string.
	 * @return array<int|string,mixed>
	 */
	private function decode_event_candidates( $raw_events ): array {
		if ( \is_string( $raw_events ) ) {
			$raw_events = '' === $raw_events ? array() : \json_decode( $raw_events, true );
		}
		if ( ! \is_array( $raw_events ) ) {
			return array();
		}

		// Sanitize every string leaf up front; EventContract::normalize_events()
		// then keeps only fields declared by a registered event definition.
		return \map_deep(
			$raw_events,
			static function ( $value ) {
				return \is_string( $value ) ? \sanitize_text_field( $value ) : $value;
			}
		);
	}

	/**
	 * Reads the events document posted to the admin-ajax fallback.
	 *
	 * The value is a JSON document, so sanitize_text_field() cannot run on the
	 * raw string; it is decoded first and each string leaf is sanitized by
	 * decode_event_candidates().
	 *
	 * @return array<int|string, mixed>|null Sanitized event candidates, or null for malformed JSON.
	 */
	private function read_posted_events(): ?array {
		// Public by design, see handle_ajax_tracking(): visitors on cached pages cannot carry a nonce.
		// phpcs:disable WordPress.Security.NonceVerification.Missing
		if ( ! isset( $_POST['events'] ) ) {
			return array();
		}

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Decoded and sanitized leaf by leaf below.
		$raw = \wp_unslash( $_POST['events'] );
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		if ( \is_string( $raw ) && '' !== $raw ) {
			\json_decode( $raw, true );
			if ( JSON_ERROR_NONE !== \json_last_error() ) {
				return null;
			}
		}

		return $this->decode_event_candidates( $raw );
	}

	/**
	 * Validates REST event payloads before they reach ingestion.
	 *
	 * @param mixed           $value   Events request argument.
	 * @param WP_REST_Request $request REST request object.
	 * @param string          $param   Parameter name.
	 * @return bool|WP_Error True when valid, WP_Error otherwise.
	 */
	public function validate_events_arg( $value, WP_REST_Request $request, string $param ) {
		return $this->validate_events_value( $value ) ?? true;
	}

	/**
	 * Checks event structure and count for every tracking transport.
	 *
	 * @param mixed $value Parsed event value.
	 * @return WP_Error|null Validation error, if any.
	 */
	private function validate_events_value( $value ): ?WP_Error {
		if ( null === $value || '' === $value ) {
			return null;
		}

		if ( \is_string( $value ) ) {
			$value = \json_decode( $value, true );
			if ( JSON_ERROR_NONE !== \json_last_error() ) {
				return new WP_Error(
					'ppla_events_invalid_payload',
					\__( 'Events payload must be valid JSON.', 'primeplaced-logless-analytics' ),
					array( 'status' => 400 )
				);
			}
		}

		if ( ! \is_array( $value ) ) {
			return new WP_Error(
				'ppla_events_invalid_payload',
				\__( 'Events payload must be an array.', 'primeplaced-logless-analytics' ),
				array( 'status' => 400 )
			);
		}

		if ( \count( $value ) > $this->event_feature_policy->get_max_events_per_hit() ) {
			return new WP_Error(
				'ppla_events_too_many_items',
				\__( 'Events payload contains too many items.', 'primeplaced-logless-analytics' ),
				array( 'status' => 400 )
			);
		}

		foreach ( $value as $event ) {
			if ( ! \is_array( $event ) ) {
				return new WP_Error(
					'ppla_events_invalid_item',
					\__( 'Each event must be an object.', 'primeplaced-logless-analytics' ),
					array( 'status' => 400 )
				);
			}

			if ( ! isset( $event['type'] ) || ! \is_string( $event['type'] ) ) {
				return new WP_Error(
					'ppla_events_missing_type',
					\__( 'Each event must define a type.', 'primeplaced-logless-analytics' ),
					array( 'status' => 400 )
				);
			}
		}

		return null;
	}

	/**
	 * Decodes the events argument into a list of candidates.
	 *
	 * Events arrive as a JSON string or an array. Each accepted event is then
	 * rebuilt by EventContract::normalize_events(), which keeps only fields
	 * declared by a registered event definition.
	 *
	 * @param mixed $value Events request argument.
	 * @return array<int|string, mixed> Decoded event candidates.
	 */
	public function sanitize_events_arg( $value ): array {
		return $this->decode_event_candidates( $value );
	}

	/**
	 * Validates a public transport idempotency key.
	 *
	 * @param mixed           $value   Hit ID request argument.
	 * @param WP_REST_Request $request REST request object.
	 * @param string          $param   Parameter name.
	 * @return bool|WP_Error True when valid, WP_Error otherwise.
	 */
	public function validate_hit_id_arg( $value, WP_REST_Request $request, string $param ) {
		if ( \is_string( $value ) && $this->is_valid_tracking_id( $value ) ) {
			return true;
		}

		return new WP_Error(
			'ppla_hit_id_invalid',
			\__( 'Tracking hit ID is invalid.', 'primeplaced-logless-analytics' ),
			array( 'status' => 400 )
		);
	}

	/**
	 * Checks the shared idempotency key format.
	 *
	 * @param string $value Tracking ID.
	 */
	private function is_valid_tracking_id( string $value ): bool {
		return 1 === \preg_match( self::TRACKING_ID_PATTERN, $value );
	}

	/**
	 * Returns the argument schema of the tracking endpoint.
	 *
	 * @return array<string, array<string, mixed>> Route arguments.
	 */
	private function get_endpoint_args(): array {
		return array(
			'hit_id'          => array(
				'required'          => true,
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => array( $this, 'validate_hit_id_arg' ),
			),
			'url'             => array(
				'required'          => true,
				'type'              => 'string',
				'sanitize_callback' => 'esc_url_raw',
				'validate_callback' => 'rest_validate_request_arg',
			),
			'referrer'        => array(
				'required'          => false,
				'type'              => 'string',
				'default'           => '',
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => 'rest_validate_request_arg',
			),
			'record_pageview' => array(
				'required'          => true,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'validate_callback' => 'rest_validate_request_arg',
			),
			'events'          => array(
				'required'          => false,
				'validate_callback' => array( $this, 'validate_events_arg' ),
				'sanitize_callback' => array( $this, 'sanitize_events_arg' ),
			),
			'device_hint'     => array(
				'required'          => false,
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => 'rest_validate_request_arg',
			),
		);
	}
}
