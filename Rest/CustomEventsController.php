<?php
/**
 * Custom Events Controller.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Rest;

use Primeplaced_Logless_Analytics\Data\CustomEventRepository;
use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Integrations\Capabilities;
use Primeplaced_Logless_Analytics\Services\CustomEventDefinition;
use Primeplaced_Logless_Analytics\Services\EventFeaturePolicy;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Exposes the administrator-only custom-event registry for Free/Core.
 */
class CustomEventsController extends Base {

	/** Custom event configuration storage. */
	private CustomEventRepository $repository;

	/**
	 * Creates the controller with its storage dependency.
	 *
	 * @param CustomEventRepository $repository Custom event configuration storage.
	 */
	public function __construct( CustomEventRepository $repository ) {
		$this->repository = $repository;
	}

	/**
	 * Registers the REST routes after WordPress has loaded the API.
	 *
	 * @return bool True when initialization succeeds.
	 */
	public function initialize(): bool {
		if ( ! parent::initialize() ) {
			return false;
		}

		\add_action( 'rest_api_init', array( $this, 'register_routes' ) );

		return true;
	}

	/** Registers custom-event REST routes. */
	public function register_routes(): void {
		$permission = array( Capabilities::class, 'current_user_can_manage_settings' );

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/custom-events',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_events' ),
					'permission_callback' => $permission,
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create_event' ),
					'permission_callback' => $permission,
					'args'                => $this->get_create_event_args(),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/custom-events/(?P<id>[a-f0-9-]{36})',
			array(
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'update_event' ),
					'permission_callback' => $permission,
					'args'                => array(
						'id'        => $this->get_id_arg(),
						'is_active' => array(
							'type'              => 'boolean',
							'required'          => true,
							'sanitize_callback' => 'rest_sanitize_request_arg',
							'validate_callback' => 'rest_validate_request_arg',
						),
					),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'delete_event' ),
					'permission_callback' => $permission,
					'args'                => array( 'id' => $this->get_id_arg() ),
				),
			)
		);
	}

	/**
	 * Returns every configured event for the admin UI.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response REST response.
	 */
	public function get_events( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response( array( 'events' => $this->repository->get_all() ) );
	}

	/**
	 * Creates one custom-event configuration.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error Created event or a validation/conflict error.
	 */
	public function create_event( WP_REST_Request $request ) {
		$event_name   = CustomEventDefinition::normalize_name( $request->get_param( 'event_name' ) );
		$trigger_type = \sanitize_key( (string) $request->get_param( 'trigger_type' ) );
		$css_selector = $this->normalize_selector( $request->get_param( 'css_selector' ) );

		if ( '' === $event_name || ! $this->is_valid_trigger( $trigger_type ) || ( 'custom' !== $trigger_type && '' === $css_selector ) ) {
			return new WP_Error(
				'ppla_custom_event_invalid',
				__( 'Provide an event name, a supported trigger, and a CSS selector when the trigger needs one.', 'primeplaced-logless-analytics' ),
				array( 'status' => 400 )
			);
		}

		if ( (bool) $request->get_param( 'is_active' ) && $this->active_limit_reached() ) {
			return $this->active_limit_error();
		}

		$event = $this->repository->create(
			array(
				'event_name'   => $event_name,
				'trigger_type' => $trigger_type,
				'css_selector' => $css_selector,
				'is_active'    => (bool) $request->get_param( 'is_active' ),
			)
		);

		if ( null === $event ) {
			return new WP_Error(
				'ppla_custom_event_conflict',
				__( 'The custom event could not be created. Event names must be unique.', 'primeplaced-logless-analytics' ),
				array( 'status' => 409 )
			);
		}

		return new WP_REST_Response( $event, 201 );
	}

	/**
	 * Changes whether a configured event is sent from the browser tracker.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error Updated status or an error.
	 */
	public function update_event( WP_REST_Request $request ) {
		$id    = (string) $request->get_param( 'id' );
		$event = $this->repository->get_by_id( $id );
		if ( null === $event ) {
			return new WP_Error(
				'ppla_custom_event_not_found',
				__( 'The custom event could not be found.', 'primeplaced-logless-analytics' ),
				array( 'status' => 404 )
			);
		}

		if ( (bool) $request->get_param( 'is_active' ) && ! $event['is_active'] && $this->active_limit_reached() ) {
			return $this->active_limit_error();
		}

		$updated = $this->repository->update_active(
			$id,
			(bool) $request->get_param( 'is_active' )
		);

		if ( ! $updated ) {
			return new WP_Error(
				'ppla_custom_event_update_failed',
				__( 'The custom event could not be updated.', 'primeplaced-logless-analytics' ),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response( array( 'updated' => true ) );
	}

	/**
	 * Checks the tracker's cap; past it the policy would silently drop the oldest event.
	 */
	private function active_limit_reached(): bool {
		return \count( $this->repository->get_active() ) >= EventFeaturePolicy::MAX_ACTIVE_CUSTOM_EVENTS;
	}

	/**
	 * Builds the conflict returned when the active-event cap is reached.
	 */
	private function active_limit_error(): WP_Error {
		return new WP_Error(
			'ppla_custom_event_limit',
			\sprintf(
				/* translators: %d: maximum number of active custom events. */
				__( 'You can have at most %d active custom events. Disable or delete one first.', 'primeplaced-logless-analytics' ),
				EventFeaturePolicy::MAX_ACTIVE_CUSTOM_EVENTS
			),
			array( 'status' => 409 )
		);
	}

	/**
	 * Removes one configured event. Repeating the request is safe.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error Deletion status or an error.
	 */
	public function delete_event( WP_REST_Request $request ) {
		$deleted = $this->repository->delete( (string) $request->get_param( 'id' ) );

		if ( ! $deleted ) {
			return new WP_Error(
				'ppla_custom_event_delete_failed',
				__( 'The custom event could not be removed.', 'primeplaced-logless-analytics' ),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response( array( 'deleted' => true ) );
	}

	/**
	 * Returns create-route schema arguments.
	 *
	 * @return array<string,array<string,mixed>> Route arguments.
	 */
	private function get_create_event_args(): array {
		return array(
			'event_name'   => array(
				'type'              => 'string',
				'required'          => true,
				'maxLength'         => CustomEventDefinition::MAX_NAME_LENGTH,
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => 'rest_validate_request_arg',
			),
			'trigger_type' => array(
				'type'              => 'string',
				'required'          => true,
				'enum'              => array( 'click', 'submit', 'custom' ),
				'sanitize_callback' => 'sanitize_key',
				'validate_callback' => 'rest_validate_request_arg',
			),
			'css_selector' => array(
				'type'              => 'string',
				'required'          => false,
				'default'           => '',
				'maxLength'         => 255,
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => 'rest_validate_request_arg',
			),
			'is_active'    => array(
				'type'              => 'boolean',
				'required'          => false,
				'default'           => true,
				'sanitize_callback' => 'rest_sanitize_request_arg',
				'validate_callback' => 'rest_validate_request_arg',
			),
		);
	}

	/**
	 * Returns the schema argument shared by single-event routes.
	 *
	 * @return array<string,mixed> Route argument.
	 */
	private function get_id_arg(): array {
		return array(
			'type'              => 'string',
			'required'          => true,
			'format'            => 'uuid',
			'sanitize_callback' => 'sanitize_text_field',
			'validate_callback' => 'rest_validate_request_arg',
		);
	}

	/**
	 * Limits the selector kept in the public browser configuration.
	 *
	 * @param mixed $value Untrusted selector input.
	 * @return string Sanitized CSS selector.
	 */
	private function normalize_selector( $value ): string {
		return \is_string( $value ) ? \substr( \trim( \sanitize_text_field( $value ) ), 0, 255 ) : '';
	}

	/**
	 * Checks whether a configured browser trigger is supported.
	 *
	 * @param string $trigger_type Candidate trigger type.
	 * @return bool Whether the trigger is supported by the Free tracker.
	 */
	private function is_valid_trigger( string $trigger_type ): bool {
		return \in_array( $trigger_type, array( 'click', 'submit', 'custom' ), true );
	}
}
