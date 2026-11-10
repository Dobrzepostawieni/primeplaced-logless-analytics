<?php
/**
 * Event Contract Service.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalizes public tracking input into the stable internal event envelope.
 */
class EventContract {

	public const VERSION = 1;

	/** Attributes that carry an internal URL path and keep its percent-encoding. */
	private const PATH_ATTRIBUTES = array( 'source_page_path', 'landing_page' );

	private EventFeaturePolicy $policy;

	/**
	 * Creates the Event Contract normalizer.
	 *
	 * @param EventFeaturePolicy $policy Active event policy.
	 */
	public function __construct( EventFeaturePolicy $policy ) {
		$this->policy = $policy;
	}

	/**
	 * Normalizes a batch of public tracking events.
	 *
	 * Public input is always the browser channel and can never carry a
	 * server-only event type, such as an order or a goal conversion.
	 *
	 * @param mixed  $raw_events             Untrusted REST, AJAX, or beacon event input.
	 * @param string $fallback_id_namespace Stable parent transport ID for retry-safe fallback event IDs.
	 * @return array<int, array<string, mixed>>
	 */
	public function normalize_events( $raw_events, string $fallback_id_namespace = '' ): array {
		return $this->normalize_batch( $raw_events, $fallback_id_namespace, false );
	}

	/**
	 * Normalizes events produced in-process by a trusted server integration.
	 *
	 * @param array<int, mixed> $raw_events Server-built event candidates.
	 * @return array<int, array<string, mixed>>
	 */
	public function normalize_server_events( array $raw_events ): array {
		return $this->normalize_batch( $raw_events, '', true );
	}

	/**
	 * Normalizes a batch of events for one trust level.
	 *
	 * @param mixed  $raw_events             Event input.
	 * @param string $fallback_id_namespace Stable parent transport ID for retry-safe fallback event IDs.
	 * @param bool   $is_server              Whether a trusted server integration produced the events.
	 * @return array<int, array<string, mixed>>
	 */
	private function normalize_batch( $raw_events, string $fallback_id_namespace, bool $is_server ): array {
		if ( is_string( $raw_events ) ) {
			$raw_events = json_decode( $raw_events, true );
		}
		if ( ! is_array( $raw_events ) ) {
			return array();
		}

		$events = array();
		foreach ( $raw_events as $index => $candidate ) {
			if ( count( $events ) >= $this->policy->get_max_events_per_hit() || ! is_array( $candidate ) ) {
				break;
			}
			$fallback_event_id = '' === $fallback_id_namespace ? '' : $fallback_id_namespace . ':' . $index;
			$event             = $this->normalize_event( $candidate, $fallback_event_id, $is_server );
			if ( null !== $event ) {
				$events[] = $event;
			}
		}

		return $events;
	}

	/**
	 * Normalizes one Event Contract candidate.
	 *
	 * @param array<string, mixed> $candidate         Untrusted event candidate.
	 * @param string               $fallback_event_id Retry-safe fallback event ID namespace.
	 * @param bool                 $is_server         Whether a trusted server integration produced the event.
	 * @return array<string, mixed>|null
	 */
	private function normalize_event( array $candidate, string $fallback_event_id, bool $is_server ): ?array {
		$type       = isset( $candidate['type'] ) && is_string( $candidate['type'] ) ? $this->sanitize_type( $candidate['type'] ) : '';
		$definition = $this->policy->get_event_definition( $type );
		if ( '' === $type || null === $definition || ( ! $is_server && ! empty( $definition['server_only'] ) ) ) {
			return null;
		}

		$metrics               = isset( $candidate['metrics'] ) && is_array( $candidate['metrics'] ) ? $candidate['metrics'] : array();
		$source                = isset( $candidate['source'] ) && is_array( $candidate['source'] ) ? $candidate['source'] : array();
		$subject               = isset( $candidate['subject'] ) && is_array( $candidate['subject'] ) ? $candidate['subject'] : array();
		$allowed_metrics       = $definition['metrics'] ?? array();
		$allowed_attributes    = $definition['attributes'] ?? array();
		$attribute_constraints = isset( $definition['attribute_constraints'] ) && is_array( $definition['attribute_constraints'] ) ? $definition['attribute_constraints'] : array();
		$allowed_providers     = $definition['provider_ids'] ?? array();
		$allowed_subjects      = $definition['subject_kinds'] ?? array();
		$provider_id           = $this->sanitize_provider_id( $source['provider_id'] ?? '' );
		$subject_kind          = $this->sanitize_key_value( $subject['kind'] ?? '', 32 );
		$currency              = isset( $metrics['currency'] ) && is_string( $metrics['currency'] ) ? strtoupper( sanitize_key( $metrics['currency'] ) ) : '';
		$amount                = in_array( 'amount', $allowed_metrics, true ) ? $this->get_numeric_value( $metrics['amount'] ?? null ) : null;
		$quantity              = in_array( 'quantity', $allowed_metrics, true ) ? $this->get_numeric_value( $metrics['quantity'] ?? null ) : null;

		if ( ! empty( $allowed_providers ) && ! in_array( $provider_id, $allowed_providers, true ) ) {
			return null;
		}

		if ( ! empty( $allowed_subjects ) && ! in_array( $subject_kind, $allowed_subjects, true ) ) {
			return null;
		}

		$attributes = $this->sanitize_attributes( $candidate['attributes'] ?? array(), $allowed_attributes, $attribute_constraints );
		if ( ! $this->has_required_attributes( $attributes, $attribute_constraints ) ) {
			return null;
		}

		// A path longer than the 64-character key is stored as its hash; the
		// full path stays readable in the `path` attribute.
		$subject_path = 'path' === $subject_kind ? $this->sanitize_path( $subject['key'] ?? '' ) : '';
		if ( '' !== $subject_path && UrlPath::subject_key( $subject_path ) !== $subject_path ) {
			$attributes['path'] = $subject_path;
		}

		$privacy = $this->policy->get_event_privacy( $type );

		return array(
			'contract_version' => self::VERSION,
			'event_id'         => $this->sanitize_event_id( $candidate['event_id'] ?? '', $fallback_event_id ),
			'type'             => $type,
			'occurred_at'      => $this->sanitize_occurred_at( $candidate['occurred_at'] ?? '' ),
			'source'           => array(
				'channel'     => $is_server ? $this->sanitize_source_channel( $source['channel'] ?? 'server' ) : 'browser',
				'provider_id' => $provider_id,
			),
			'subject'          => array(
				'kind' => $subject_kind,
				'key'  => '' !== $subject_path ? UrlPath::subject_key( $subject_path ) : $this->sanitize_key_value( $subject['key'] ?? '', 64 ),
			),
			'metrics'          => array(
				'amount'   => $amount,
				'currency' => in_array( 'currency', $allowed_metrics, true ) && 3 === strlen( $currency ) ? $currency : '',
				'quantity' => $quantity,
			),
			'attributes'       => $attributes,
			'attribution'      => isset( $privacy['allow_attribution'] ) && ! $privacy['allow_attribution'] ? array() : $this->sanitize_attribution( $candidate['attribution'] ?? array() ),
			'privacy'          => $privacy,
		);
	}

	/**
	 * Sanitizes an Event Contract type.
	 *
	 * @param string $type Candidate event type.
	 */
	private function sanitize_type( string $type ): string {
		$type = strtolower( trim( $type ) );
		return 1 === preg_match( '/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/', $type ) && strlen( $type ) <= 100 ? $type : '';
	}

	/**
	 * Sanitizes an idempotency key.
	 *
	 * @param mixed  $value             Candidate event ID.
	 * @param string $fallback_event_id Retry-safe fallback event ID namespace.
	 */
	private function sanitize_event_id( $value, string $fallback_event_id = '' ): string {
		$value = is_string( $value ) ? trim( $value ) : '';
		if ( 1 === preg_match( '/^[a-zA-Z0-9_-]{16,64}$/', $value ) ) {
			return $value;
		}

		if ( '' !== $fallback_event_id ) {
			return hash_hmac( 'sha256', $fallback_event_id, wp_salt( 'auth' ) );
		}

		return wp_generate_uuid4();
	}

	/**
	 * Sanitizes an event timestamp into site-local time, like pageviews.
	 *
	 * A value with an explicit offset (the tracker's ISO UTC string) keeps its
	 * instant; a value without one is a server producer's site-local time.
	 *
	 * @param mixed $value Candidate timestamp.
	 */
	private function sanitize_occurred_at( $value ): string {
		$timezone  = wp_timezone();
		$timestamp = false;
		if ( is_string( $value ) && '' !== trim( $value ) ) {
			try {
				$timestamp = ( new \DateTimeImmutable( $value, $timezone ) )->getTimestamp();
			} catch ( \Exception $exception ) {
				$timestamp = false;
			}
		}

		$now = time();
		if ( false === $timestamp || $timestamp > $now + DAY_IN_SECONDS || $timestamp < $now - ( 30 * DAY_IN_SECONDS ) ) {
			$timestamp = $now;
		}

		return ( new \DateTimeImmutable( '@' . $timestamp ) )->setTimezone( $timezone )->format( 'Y-m-d H:i:s' );
	}

	/**
	 * Sanitizes an event source channel.
	 *
	 * @param mixed $value Candidate source channel.
	 */
	private function sanitize_source_channel( $value ): string {
		$value = is_string( $value ) ? sanitize_key( $value ) : 'browser';
		return in_array( $value, array( 'browser', 'server', 'integration' ), true ) ? $value : 'browser';
	}

	/**
	 * Sanitizes a provider ID.
	 *
	 * @param mixed $value Candidate provider ID.
	 */
	private function sanitize_provider_id( $value ): string {
		$value = is_string( $value ) ? sanitize_key( $value ) : '';
		return is_string( $value ) && 1 === preg_match( '/^[a-z][a-z0-9_]{1,49}$/', $value ) ? $value : '';
	}

	/**
	 * Sanitizes a bounded opaque key.
	 *
	 * @param mixed $value Candidate key.
	 * @param int   $length Maximum length.
	 */
	private function sanitize_key_value( $value, int $length ): string {
		return is_string( $value ) ? mb_substr( sanitize_text_field( $value ), 0, $length ) : '';
	}

	/**
	 * Sanitizes a path subject without stripping its percent-encoded octets.
	 *
	 * @param mixed $value Candidate path.
	 */
	private function sanitize_path( $value ): string {
		return is_string( $value ) && '' !== trim( $value ) ? substr( UrlPath::encode( trim( $value ) ), 0, 500 ) : '';
	}

	/**
	 * Extracts a numeric metric value.
	 *
	 * @param mixed $value Candidate numeric value.
	 */
	private function get_numeric_value( $value ): ?float {
		return is_int( $value ) || is_float( $value ) ? (float) $value : null;
	}

	/**
	 * Sanitizes a bounded attributes map.
	 *
	 * @param mixed                                                                  $value Candidate attributes.
	 * @param array<int, string>                                                     $allowed_keys Event-specific allowed keys.
	 * @param array<string,array{type:string,minimum:int,maximum:int,required:bool}> $constraints Event-specific scalar constraints.
	 * @return array<string, int|float|bool|string>
	 */
	private function sanitize_attributes( $value, array $allowed_keys, array $constraints = array() ): array {
		if ( ! is_array( $value ) || empty( $allowed_keys ) ) {
			return array();
		}
		$attributes = array();
		foreach ( array_slice( $value, 0, 20, true ) as $key => $item ) {
			$key = is_string( $key ) ? sanitize_key( $key ) : '';
			if ( ! in_array( $key, $allowed_keys, true ) || ( ! is_string( $item ) && ! is_int( $item ) && ! is_float( $item ) && ! is_bool( $item ) ) ) {
				continue;
			}
			if ( isset( $constraints[ $key ] ) && ! $this->attribute_satisfies_constraint( $item, $constraints[ $key ] ) ) {
				continue;
			}
			if ( is_string( $item ) && in_array( $key, self::PATH_ATTRIBUTES, true ) ) {
				$attributes[ $key ] = '' === trim( $item ) ? '' : mb_substr( UrlPath::encode( trim( $item ) ), 0, 500 );
				continue;
			}
			$attributes[ $key ] = is_string( $item ) ? mb_substr( sanitize_text_field( $item ), 0, 120 ) : $item;
		}
		return $attributes;
	}

	/**
	 * Checks a constrained attribute before it reaches the buffer.
	 *
	 * @param mixed               $value Candidate scalar value.
	 * @param array<string,mixed> $constraint Normalized policy constraint.
	 */
	private function attribute_satisfies_constraint( $value, array $constraint ): bool {
		if ( 'integer' !== ( $constraint['type'] ?? '' ) || ! is_int( $value ) ) {
			return false;
		}

		$minimum     = isset( $constraint['minimum'] ) ? (int) $constraint['minimum'] : PHP_INT_MIN;
		$maximum     = isset( $constraint['maximum'] ) ? (int) $constraint['maximum'] : PHP_INT_MAX;
		$multiple_of = isset( $constraint['multiple_of'] ) ? max( 1, (int) $constraint['multiple_of'] ) : 1;

		return $value >= $minimum && $value <= $maximum && 0 === $value % $multiple_of;
	}

	/**
	 * Ensures a constrained event contains every required attribute.
	 *
	 * @param array<string,int|float|bool|string>                                    $attributes Sanitized attributes.
	 * @param array<string,array{type:string,minimum:int,maximum:int,required:bool}> $constraints Normalized policy constraints.
	 */
	private function has_required_attributes( array $attributes, array $constraints ): bool {
		foreach ( $constraints as $key => $constraint ) {
			if ( ! empty( $constraint['required'] ) && ! array_key_exists( $key, $attributes ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Preserves only the minimized non-UTM referrer attribution sidecar.
	 *
	 * @param mixed $value Candidate attribution sidecar.
	 * @return array{referrer:string}
	 */
	private function sanitize_attribution( $value ): array {
		$value    = is_array( $value ) ? $value : array();
		$referrer = isset( $value['referrer'] ) && is_string( $value['referrer'] )
			? mb_substr( sanitize_text_field( $value['referrer'] ), 0, 500 )
			: '';

		return array(
			'referrer' => $referrer,
		);
	}
}
