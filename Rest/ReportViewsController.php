<?php
/**
 * Report-view REST controller.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Rest;

use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Integrations\Capabilities;
use Primeplaced_Logless_Analytics\Services\ReportViewService;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Exposes server-backed personal report preferences and saved views.
 */
class ReportViewsController extends Base {

	/** Report-view application service. */
	private ReportViewService $service;

	/**
	 * Creates the report-view REST controller.
	 *
	 * @param ReportViewService $service Report-view application service.
	 */
	public function __construct( ReportViewService $service ) {
		$this->service = $service;
	}

	/**
	 * Registers REST routes after the API has loaded.
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

	/** Registers report-view REST routes. */
	public function register_routes(): void {
		$permission = array( Capabilities::class, 'current_user_can_manage_analytics' );

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/report-preferences',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_preferences' ),
					'permission_callback' => $permission,
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/report-preferences/(?P<storage_key>[a-z0-9_-]{1,100})',
			array(
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'save_preference' ),
					'permission_callback' => $permission,
					'args'                => $this->get_preference_args(),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/saved-views',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_saved_views' ),
					'permission_callback' => $permission,
					'args'                => array( 'storage_key' => $this->get_storage_key_arg( false ) ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create_saved_view' ),
					'permission_callback' => $permission,
					'args'                => $this->get_saved_view_args(),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/saved-views/(?P<id>[a-f0-9-]{36})',
			array(
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'update_saved_view' ),
					'permission_callback' => $permission,
					'args'                => \array_merge( array( 'id' => $this->get_id_arg() ), $this->get_saved_view_args() ),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'delete_saved_view' ),
					'permission_callback' => $permission,
					'args'                => array( 'id' => $this->get_id_arg() ),
				),
			)
		);
	}

	/**
	 * Gets all defaults owned by the current user.
	 *
	 * @param WP_REST_Request $request REST request.
	 */
	public function get_preferences( WP_REST_Request $request ): WP_REST_Response {
		unset( $request );

		return new WP_REST_Response(
			array( 'preferences' => $this->service->get_preferences( \get_current_user_id() ) )
		);
	}

	/**
	 * Saves one report default for the current user.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error Updated preference or validation error.
	 */
	public function save_preference( WP_REST_Request $request ) {
		$preference = $this->service->save_preference(
			\get_current_user_id(),
			(string) $request->get_param( 'storage_key' ),
			$request->get_param( 'range' ),
			$request->get_param( 'table_state' ),
			$request->get_param( 'query_state' )
		);

		return \is_wp_error( $preference ) ? $preference : new WP_REST_Response( array( 'preference' => $preference ) );
	}

	/**
	 * Gets private current-user views and shared team views.
	 *
	 * @param WP_REST_Request $request REST request.
	 */
	public function get_saved_views( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response(
			array(
				'views' => $this->service->get_saved_views(
					\get_current_user_id(),
					(string) $request->get_param( 'storage_key' )
				),
			)
		);
	}

	/**
	 * Creates a saved view authored by the current user.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error Created saved view or failure.
	 */
	public function create_saved_view( WP_REST_Request $request ) {
		$view = $this->service->create_saved_view( \get_current_user_id(), $this->get_view_input( $request ) );

		return \is_wp_error( $view ) ? $view : new WP_REST_Response( array( 'view' => $view ), 201 );
	}

	/**
	 * Updates a saved view when the request user is its author or an administrator.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error Updated saved view or failure.
	 */
	public function update_saved_view( WP_REST_Request $request ) {
		$view = $this->service->update_saved_view(
			\get_current_user_id(),
			(string) $request->get_param( 'id' ),
			$this->get_view_input( $request )
		);

		return \is_wp_error( $view ) ? $view : new WP_REST_Response( array( 'view' => $view ) );
	}

	/**
	 * Removes a saved view when the request user is its author or an administrator.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error Deletion state or failure.
	 */
	public function delete_saved_view( WP_REST_Request $request ) {
		$deleted = $this->service->delete_saved_view( \get_current_user_id(), (string) $request->get_param( 'id' ) );

		return \is_wp_error( $deleted ) ? $deleted : new WP_REST_Response( array( 'deleted' => true ) );
	}

	/**
	 * Returns REST arguments for one report preference.
	 *
	 * @return array<string,array<string,mixed>> Preference endpoint arguments.
	 */
	private function get_preference_args(): array {
		return array(
			'storage_key' => $this->get_storage_key_arg( true ),
			'range'       => $this->get_range_arg(),
			'table_state' => $this->get_table_state_arg(),
			'query_state' => $this->get_query_state_arg(),
		);
	}

	/**
	 * Returns REST arguments for a saved view.
	 *
	 * @return array<string,array<string,mixed>> Saved-view endpoint arguments.
	 */
	private function get_saved_view_args(): array {
		return array(
			'storage_key' => $this->get_storage_key_arg( true ),
			'name'        => array(
				'type'              => 'string',
				'required'          => true,
				'minLength'         => 1,
				'maxLength'         => 120,
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => 'rest_validate_request_arg',
			),
			'visibility'  => array(
				'type'              => 'string',
				'required'          => false,
				'default'           => 'private',
				'enum'              => array( 'private', 'shared' ),
				'sanitize_callback' => 'sanitize_key',
				'validate_callback' => 'rest_validate_request_arg',
			),
			'range_days'  => $this->get_range_arg(),
			'table_state' => $this->get_table_state_arg(),
			'query_state' => $this->get_query_state_arg(),
		);
	}

	/**
	 * Returns the storage-key argument schema.
	 *
	 * @param bool $required Whether the parameter is required.
	 * @return array<string,mixed> Storage-key argument schema.
	 */
	private function get_storage_key_arg( bool $required ): array {
		return array(
			'type'              => 'string',
			'required'          => $required,
			'pattern'           => '^[a-z0-9_-]{1,100}$',
			'sanitize_callback' => 'sanitize_key',
			'validate_callback' => 'rest_validate_request_arg',
		);
	}

	/**
	 * Returns the report-range argument schema.
	 *
	 * @return array<string,mixed> Range argument schema.
	 */
	private function get_range_arg(): array {
		return array(
			'type'              => 'integer',
			'required'          => true,
			'enum'              => array( 7, 30, 90 ),
			'sanitize_callback' => 'absint',
			'validate_callback' => 'rest_validate_request_arg',
		);
	}

	/**
	 * Returns the serialized table-state argument schema.
	 *
	 * @return array<string,mixed> Table-state argument schema.
	 */
	private function get_table_state_arg(): array {
		return array(
			'type'              => 'string',
			'required'          => false,
			'default'           => '',
			'maxLength'         => 65535,
			'validate_callback' => array( $this, 'validate_state_arg' ),
			'sanitize_callback' => array( $this, 'sanitize_state_arg' ),
		);
	}

	/**
	 * Returns the serialized report-query-state argument schema.
	 *
	 * @return array<string,mixed> Report-query state argument schema.
	 */
	private function get_query_state_arg(): array {
		return array(
			'type'              => 'string',
			'required'          => false,
			'default'           => '',
			'maxLength'         => 65535,
			'validate_callback' => array( $this, 'validate_state_arg' ),
			'sanitize_callback' => array( $this, 'sanitize_state_arg' ),
		);
	}

	/**
	 * Accepts an empty value or a JSON object or array within the schema limits.
	 *
	 * @param mixed           $value   Serialized report state.
	 * @param WP_REST_Request $request REST request.
	 * @param string          $param   Parameter name.
	 * @return true|WP_Error True when valid.
	 */
	public function validate_state_arg( $value, WP_REST_Request $request, string $param ) {
		$valid = \rest_validate_request_arg( $value, $request, $param );
		if ( true !== $valid || '' === $value ) {
			return $valid;
		}

		if ( ! \is_array( \json_decode( (string) $value, true ) ) ) {
			return new WP_Error(
				'rest_invalid_param',
				/* translators: %s: Request parameter name. */
				\sprintf( \__( '%s must be a JSON object.', 'primeplaced-logless-analytics' ), $param ),
				array( 'status' => 400 )
			);
		}

		return true;
	}

	/**
	 * Re-encodes a validated report state as canonical JSON.
	 *
	 * @param mixed $value Serialized report state.
	 * @return string Canonical JSON, or an empty string.
	 */
	public function sanitize_state_arg( $value ): string {
		$decoded = \is_string( $value ) ? \json_decode( $value, true ) : null;
		if ( ! \is_array( $decoded ) ) {
			return '';
		}

		$encoded = \wp_json_encode( $decoded, JSON_UNESCAPED_SLASHES );

		return \is_string( $encoded ) ? $encoded : '';
	}

	/**
	 * Returns the saved-view ID argument schema.
	 *
	 * @return array<string,mixed> Saved-view ID argument schema.
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
	 * Extracts the saved-view payload from one REST request.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return array<string,mixed> Request values passed to the service.
	 */
	private function get_view_input( WP_REST_Request $request ): array {
		return array(
			'storage_key' => $request->get_param( 'storage_key' ),
			'name'        => $request->get_param( 'name' ),
			'visibility'  => $request->get_param( 'visibility' ),
			'range_days'  => $request->get_param( 'range_days' ),
			'table_state' => $request->get_param( 'table_state' ),
			'query_state' => $request->get_param( 'query_state' ),
		);
	}
}
