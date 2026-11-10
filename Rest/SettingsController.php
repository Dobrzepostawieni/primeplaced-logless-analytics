<?php
/**
 * Settings Controller.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Rest;

use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Integrations\Capabilities;
use Primeplaced_Logless_Analytics\Services\ClientIpResolver;
use Primeplaced_Logless_Analytics\Services\PrivacyModeHistory;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class SettingsController
 *
 * Handles retrieving and saving plugin settings.
 */
class SettingsController extends Base {

	/** Serializes read-merge-write operations from independent admin clients. */
	private const WRITE_LOCK_OPTION = 'ppla_settings_write_lock';

	/** Maximum lifetime of an abandoned settings writer. */
	private const WRITE_LOCK_TTL = 15;

	/** Lifetime of the one-time reset undo snapshot. */
	private const RESET_UNDO_TTL = 60;

	/** Privacy mode history service. */
	private PrivacyModeHistory $privacy_history;

	/**
	 * Settings controller constructor.
	 *
	 * @param PrivacyModeHistory $privacy_history Privacy history service.
	 */
	public function __construct( PrivacyModeHistory $privacy_history ) {
		$this->privacy_history = $privacy_history;
	}

	/**
	 * Initialize the class and register REST routes.
	 *
	 * @return bool True on success.
	 */
	public function initialize(): bool {
		if ( ! parent::initialize() ) {
			return false;
		}

		\add_action( 'rest_api_init', array( $this, 'register_settings_routes' ) );
		\add_action( 'update_option_ppla_settings', array( $this, 'record_privacy_mode_change' ), 10, 3 );

		return true;
	}

	/**
	 * Registers the settings REST endpoints.
	 */
	public function register_settings_routes(): void {
		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/settings',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_settings' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_analytics' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'save_settings' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_settings' ),
					'args'                => SettingsSchema::get_endpoint_args(),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/settings/exclude-current-ip',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'exclude_current_ip' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_settings' ),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/settings/reset',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'reset_settings' ),
				'permission_callback' => array( Capabilities::class, 'current_user_can_manage_settings' ),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/settings/undo-reset',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'undo_reset' ),
				'permission_callback' => array( Capabilities::class, 'current_user_can_manage_settings' ),
				'args'                => array(
					'token' => array(
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);
	}

	/**
	 * Handles the request to fetch settings.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object containing settings.
	 */
	public function get_settings( WP_REST_Request $request ): WP_REST_Response {
		$settings = \get_option( 'ppla_settings', array() );
		$settings = \is_array( $settings ) ? $settings : array();

		$settings = \array_merge( $this->get_default_settings(), $settings );

		if ( ! Capabilities::current_user_can_manage_settings() ) {
			$settings = $this->get_readonly_analytics_settings( $settings );
		}

		return new WP_REST_Response( $this->with_privacy_history( $settings ), 200 );
	}

	/**
	 * Handles the request to save settings.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object.
	 */
	public function save_settings( WP_REST_Request $request ): WP_REST_Response {
		$schema     = SettingsSchema::get_schema();
		$properties = isset( $schema['properties'] ) && \is_array( $schema['properties'] ) ? $schema['properties'] : array();
		$updates    = array();
		$supplied   = \array_merge(
			$request->get_query_params(),
			$request->get_body_params(),
			(array) $request->get_json_params()
		);

		foreach ( \array_keys( $properties ) as $key ) {
			if ( \array_key_exists( (string) $key, $supplied ) ) {
				$value      = $request->get_param( (string) $key );
				$validation = \rest_validate_value_from_schema( $value, (array) $properties[ $key ], (string) $key );

				if ( \is_wp_error( $validation ) ) {
					return new WP_REST_Response(
						array(
							'success' => false,
							'message' => $validation->get_error_message(),
						),
						400
					);
				}

				if ( isset( $properties[ $key ]['sanitize_callback'] ) && \is_callable( $properties[ $key ]['sanitize_callback'] ) ) {
					$sanitized_value = \call_user_func( $properties[ $key ]['sanitize_callback'], $value, $request, (string) $key );
				} else {
					$sanitized_value = \rest_sanitize_value_from_schema( $value, (array) $properties[ $key ], (string) $key );
				}

				$updates[ $key ] = $sanitized_value;
			}
		}

		$lock_token = $this->acquire_write_lock();
		if ( null === $lock_token ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => \__( 'Settings are being saved by another request. Please retry.', 'primeplaced-logless-analytics' ),
				),
				409
			);
		}

		try {
			$current_settings = \get_option( 'ppla_settings', array() );
			$current_settings = \is_array( $current_settings ) ? $current_settings : array();

			$new_settings = \array_merge( $this->get_default_settings(), $current_settings, $updates );
			$updated      = \update_option( 'ppla_settings', $new_settings );

			if ( ! $updated && \get_option( 'ppla_settings', array() ) !== $new_settings ) {
				return new WP_REST_Response(
					array(
						'success' => false,
						'message' => \__( 'Settings could not be saved.', 'primeplaced-logless-analytics' ),
					),
					500
				);
			}

			return new WP_REST_Response( $this->with_privacy_history( $new_settings ), 200 );
		} finally {
			$this->release_write_lock( $lock_token );
		}
	}

	/**
	 * Adds the requesting administrator's public address to exclusions.
	 *
	 * The response intentionally never returns the address. It shares the
	 * tracker trusted-proxy policy and settings lock, so it cannot race with a
	 * concurrent settings save.
	 *
	 * @param WP_REST_Request $request REST request object.
	 * @return WP_REST_Response Safe success or availability response.
	 */
	public function exclude_current_ip( WP_REST_Request $request ): WP_REST_Response {
		$lock_token = $this->acquire_write_lock();
		if ( null === $lock_token ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'code'    => 'settings_busy',
					'message' => \__( 'Settings are being saved by another request. Please retry.', 'primeplaced-logless-analytics' ),
				),
				409
			);
		}

		try {
			$settings = \get_option( 'ppla_settings', array() );
			$settings = \is_array( $settings ) ? $settings : array();
			$ip       = ClientIpResolver::resolve_from_server( $settings );

			if ( ClientIpResolver::has_untrusted_proxy_headers( $settings ) ) {
				return new WP_REST_Response(
					array(
						'success' => false,
						'code'    => 'proxy_headers_untrusted',
						'message' => \__( 'This request came through a proxy or CDN, so the detected address belongs to the proxy and is shared by your visitors. Enable Trust proxy headers in Advanced settings first.', 'primeplaced-logless-analytics' ),
					),
					400
				);
			}

			if ( ! ClientIpResolver::is_public_address( $ip ) ) {
				return new WP_REST_Response(
					array(
						'success' => false,
						'code'    => 'current_ip_unavailable',
						'message' => \__( 'No public address could be detected. Local sites often expose 127.0.0.1 or ::1; use Ignore administrators for this preview, or configure a trusted public proxy before trying again.', 'primeplaced-logless-analytics' ),
					),
					400
				);
			}

			$excluded_ips = isset( $settings['excluded_ips'] ) && \is_array( $settings['excluded_ips'] )
				? \array_values( \array_filter( $settings['excluded_ips'], 'is_string' ) )
				: array();
			$added        = ! \in_array( $ip, $excluded_ips, true );
			if ( $added ) {
				$excluded_ips[] = $ip;
			}

			$settings['excluded_ips'] = \array_values( \array_unique( $excluded_ips ) );
			if ( $added && ! \update_option( 'ppla_settings', $settings ) ) {
				return new WP_REST_Response(
					array(
						'success' => false,
						'code'    => 'settings_save_failed',
						'message' => \__( 'The exclusion could not be saved. Please retry.', 'primeplaced-logless-analytics' ),
					),
					500
				);
			}

			return new WP_REST_Response(
				array(
					'success' => true,
					'added'   => $added,
					'message' => $added
						? \__( 'Your current address is now excluded from analytics.', 'primeplaced-logless-analytics' )
						: \__( 'Your current address is already excluded from analytics.', 'primeplaced-logless-analytics' ),
				),
				200
			);
		} finally {
			$this->release_write_lock( $lock_token );
		}
	}

	/**
	 * Restores the schema defaults and keeps a short-lived undo snapshot.
	 *
	 * @param WP_REST_Request $request REST request object.
	 * @return WP_REST_Response Reset settings and an opaque undo token.
	 */
	public function reset_settings( WP_REST_Request $request ): WP_REST_Response {
		unset( $request );
		$lock_token = $this->acquire_write_lock();
		if ( null === $lock_token ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'code'    => 'settings_busy',
					'message' => \__( 'Settings are being saved by another request. Please retry.', 'primeplaced-logless-analytics' ),
				),
				409
			);
		}

		try {
			$current_settings   = \get_option( 'ppla_settings', array() );
			$current_settings   = \is_array( $current_settings ) ? $current_settings : array();
			$token              = \wp_generate_uuid4();
			$ppla_transient_key = $this->get_reset_undo_key();
			$reset_settings     = $this->get_default_settings();

			if ( ! \set_transient(
				$ppla_transient_key,
				array(
					'token'    => $token,
					'settings' => $current_settings,
				),
				self::RESET_UNDO_TTL
			) ) {
				return new WP_REST_Response(
					array(
						'success' => false,
						'code'    => 'undo_snapshot_failed',
						'message' => \__( 'The reset could not create an undo snapshot. No settings were changed.', 'primeplaced-logless-analytics' ),
					),
					500
				);
			}

			if ( ! \update_option( 'ppla_settings', $reset_settings ) && \get_option( 'ppla_settings', array() ) !== $reset_settings ) {
				\delete_transient( $ppla_transient_key );
				return new WP_REST_Response(
					array(
						'success' => false,
						'code'    => 'settings_save_failed',
						'message' => \__( 'Settings could not be reset.', 'primeplaced-logless-analytics' ),
					),
					500
				);
			}

			return new WP_REST_Response(
				array(
					'success'         => true,
					'settings'        => $this->with_privacy_history( $reset_settings ),
					'undo_token'      => $token,
					'undo_expires_at' => \time() + self::RESET_UNDO_TTL,
				),
				200
			);
		} finally {
			$this->release_write_lock( $lock_token );
		}
	}

	/**
	 * Restores the settings snapshot created by reset_settings().
	 *
	 * @param WP_REST_Request $request REST request object.
	 * @return WP_REST_Response Restored settings or an expired-token response.
	 */
	public function undo_reset( WP_REST_Request $request ): WP_REST_Response {
		$token      = (string) $request->get_param( 'token' );
		$lock_token = $this->acquire_write_lock();
		if ( null === $lock_token ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'code'    => 'settings_busy',
					'message' => \__( 'Settings are being saved by another request. Please retry.', 'primeplaced-logless-analytics' ),
				),
				409
			);
		}

		try {
			$snapshot = \get_transient( $this->get_reset_undo_key() );
			if ( ! \is_array( $snapshot ) || ! isset( $snapshot['token'], $snapshot['settings'] ) || ! \is_string( $snapshot['token'] ) || ! \is_array( $snapshot['settings'] ) || ! \hash_equals( $snapshot['token'], $token ) ) {
				return new WP_REST_Response(
					array(
						'success' => false,
						'code'    => 'reset_undo_expired',
						'message' => \__( 'The reset undo window has expired. Nothing was changed.', 'primeplaced-logless-analytics' ),
					),
					410
				);
			}

			if ( ! \update_option( 'ppla_settings', $snapshot['settings'] ) && \get_option( 'ppla_settings', array() ) !== $snapshot['settings'] ) {
				return new WP_REST_Response(
					array(
						'success' => false,
						'code'    => 'settings_save_failed',
						'message' => \__( 'Previous settings could not be restored.', 'primeplaced-logless-analytics' ),
					),
					500
				);
			}

			\delete_transient( $this->get_reset_undo_key() );
			return new WP_REST_Response(
				array(
					'success'  => true,
					'settings' => $this->with_privacy_history( $snapshot['settings'] ),
				),
				200
			);
		} finally {
			$this->release_write_lock( $lock_token );
		}
	}

	/**
	 * Atomically acquires the settings writer lock.
	 */
	private function acquire_write_lock(): ?string {
		$token = \wp_generate_uuid4();
		$lock  = array(
			'token'      => $token,
			'expires_at' => \time() + self::WRITE_LOCK_TTL,
		);

		if ( \add_option( self::WRITE_LOCK_OPTION, $lock, '', false ) ) {
			return $token;
		}

		$current_lock = \get_option( self::WRITE_LOCK_OPTION, array() );
		$expires_at   = \is_array( $current_lock ) && isset( $current_lock['expires_at'] ) ? (int) $current_lock['expires_at'] : 0;

		if ( $expires_at > \time() ) {
			return null;
		}

		\delete_option( self::WRITE_LOCK_OPTION );
		/**
		 * Whether the replacement lock was added.
		 *
		 * @var bool $lock_added
		 */
		$lock_added = \add_option( self::WRITE_LOCK_OPTION, $lock, '', false );
		if ( $lock_added ) {
			return $token;
		}

		return null;
	}

	/**
	 * Releases a settings lock only when this request owns it.
	 *
	 * @param string $token Lock ownership token.
	 */
	private function release_write_lock( string $token ): void {
		$lock = \get_option( self::WRITE_LOCK_OPTION, array() );
		if ( \is_array( $lock ) && isset( $lock['token'] ) && \is_string( $lock['token'] ) && \hash_equals( $lock['token'], $token ) ) {
			\delete_option( self::WRITE_LOCK_OPTION );
		}
	}

	/**
	 * Returns the current-user-scoped transient key for reset undo.
	 *
	 * @return string Transient key.
	 */
	private function get_reset_undo_key(): string {
		return 'ppla_settings_reset_undo_' . (int) \get_current_user_id();
	}

	/**
	 * Records a privacy mode change after the settings option has been updated.
	 *
	 * Only the old mode, new mode and UTC timestamp are retained. No visitor,
	 * administrator or request data is written to the history.
	 *
	 * @param mixed  $old_value Previous settings value.
	 * @param mixed  $value     New settings value.
	 * @param string $option    Updated option name.
	 */
	public function record_privacy_mode_change( $old_value, $value, string $option ): void {
		if ( 'ppla_settings' !== $option ) {
			return;
		}

		$this->privacy_history->record( $old_value, $value );
	}

	/**
	 * Adds privacy history to a REST response without storing it in settings.
	 *
	 * @param array<string, mixed> $settings Settings response.
	 * @return array<string, mixed>
	 */
	private function with_privacy_history( array $settings ): array {
		$settings['privacy_history'] = $this->privacy_history->get();

		return $settings;
	}

	/**
	 * Returns default settings from the active settings schema.
	 *
	 * @return array<string, mixed>
	 */
	private function get_default_settings(): array {
		$schema     = SettingsSchema::get_schema();
		$properties = isset( $schema['properties'] ) && \is_array( $schema['properties'] ) ? $schema['properties'] : array();
		$defaults   = array();

		foreach ( $properties as $key => $config ) {
			if ( \is_array( $config ) && \array_key_exists( 'default', $config ) ) {
				$defaults[ (string) $key ] = $config['default'];
			}
		}

		return $defaults;
	}

	/**
	 * Returns only non-sensitive settings needed by dashboard-only users.
	 *
	 * @param array<string, mixed> $settings Full settings array.
	 * @return array<string, mixed>
	 */
	private function get_readonly_analytics_settings( array $settings ): array {
		$allowed_keys = array(
			'strict_anonymous_mode',
			'tracking_mode',
			'track_outbound_links',
			'track_file_downloads',
		);

		$readonly                    = \array_intersect_key( $settings, \array_flip( $allowed_keys ) );
		$readonly['privacy_history'] = $this->privacy_history->get();

		return $readonly;
	}
}
