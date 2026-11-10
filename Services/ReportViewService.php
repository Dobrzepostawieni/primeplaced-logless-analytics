<?php
/**
 * Report-view business rules.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Services;

use Primeplaced_Logless_Analytics\Data\SavedViewRepository;
use Primeplaced_Logless_Analytics\Integrations\Capabilities;
use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Owns user-scoped report preferences and shared saved-view authorization.
 */
class ReportViewService {

	private const MAX_STORAGE_KEY_LENGTH = 100;
	private const MAX_NAME_LENGTH        = 120;
	private const MAX_TABLE_STATE_LENGTH = 65535;
	private const MAX_QUERY_STATE_LENGTH = 65535;

	private const RANGES = array( 7, 30, 90 );

	/** Saved-view storage dependency. */
	private SavedViewRepository $repository;

	/**
	 * Creates the report-view service.
	 *
	 * @param SavedViewRepository $repository Saved-view database repository.
	 */
	public function __construct( SavedViewRepository $repository ) {
		$this->repository = $repository;
	}

	/**
	 * Returns every report preference owned by one user on the current site.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array<string,array{range:int,table_state:string|null,query_state:string|null,updated_at:string}>
	 */
	public function get_preferences( int $user_id ): array {
		$stored = \get_user_meta( $user_id, $this->get_preference_meta_key(), true );
		if ( ! \is_array( $stored ) ) {
			return array();
		}

		$preferences = array();
		foreach ( $stored as $storage_key => $preference ) {
			$key = $this->normalize_storage_key( $storage_key );
			if ( null === $key || ! \is_array( $preference ) ) {
				continue;
			}

			$preferences[ $key ] = array(
				'range'       => $this->normalize_range( $preference['range'] ?? 30 ),
				'table_state' => $this->normalize_table_state( $preference['table_state'] ?? null ),
				'query_state' => $this->normalize_query_state( $preference['query_state'] ?? null ),
				'updated_at'  => isset( $preference['updated_at'] ) && \is_string( $preference['updated_at'] )
					? $preference['updated_at']
					: '',
			);
		}

		return $preferences;
	}

	/**
	 * Saves the current user's default view for one report.
	 *
	 * @param int    $user_id     WordPress user ID.
	 * @param string $storage_key Report storage key.
	 * @param mixed  $range       Requested range.
	 * @param mixed  $table_state Serialized table state.
	 * @param mixed  $query_state Serialized report-query state.
	 * @return array{range:int,table_state:string|null,query_state:string|null,updated_at:string}|WP_Error Updated preference or validation error.
	 */
	public function save_preference( int $user_id, string $storage_key, $range, $table_state, $query_state = null ) {
		$key              = $this->normalize_storage_key( $storage_key );
		$normalized_state = $this->normalize_table_state( $table_state );
		$normalized_query = $this->normalize_query_state( $query_state );

		if ( null === $key || ! $this->is_valid_range( $range ) || ( null === $normalized_state && ! $this->is_empty_table_state( $table_state ) ) || ( null === $normalized_query && ! $this->is_empty_table_state( $query_state ) ) ) {
			return $this->invalid_error();
		}

		$preferences         = $this->get_preferences( $user_id );
		$preference          = array(
			'range'       => (int) $range,
			'table_state' => $normalized_state,
			'query_state' => $normalized_query,
			'updated_at'  => \current_time( 'mysql', true ),
		);
		$preferences[ $key ] = $preference;

		\update_user_meta( $user_id, $this->get_preference_meta_key(), $preferences );

		return $preference;
	}

	/**
	 * Returns private views of the current user plus shared team views.
	 *
	 * @param int    $user_id     WordPress user ID.
	 * @param string $storage_key Optional report storage key.
	 * @return array<int,array<string,mixed>> Public saved-view response data.
	 */
	public function get_saved_views( int $user_id, string $storage_key = '' ): array {
		$key = '' === $storage_key ? '' : $this->normalize_storage_key( $storage_key );
		if ( null === $key ) {
			return array();
		}

		$rows  = $this->repository->get_visible_for_user( $user_id, $key );
		$views = array();

		foreach ( $rows as $row ) {
			$views[] = $this->format_view( $row, $user_id );
		}

		return $views;
	}

	/**
	 * Creates a new view with the current user recorded as author.
	 *
	 * @param int                 $user_id WordPress user ID.
	 * @param array<string,mixed> $input   Untrusted request values.
	 * @return array<string,mixed>|WP_Error Created view or failure.
	 */
	public function create_saved_view( int $user_id, array $input ) {
		$view = $this->normalize_view_input( $input, $user_id );
		if ( null === $view ) {
			return $this->invalid_error();
		}

		$created = $this->repository->create( $view );
		if ( null === $created ) {
			return new WP_Error(
				'ppla_saved_view_create_failed',
				__( 'The saved view could not be created. Please try again.', 'primeplaced-logless-analytics' ),
				array( 'status' => 500 )
			);
		}

		return $this->format_view( $created, $user_id );
	}

	/**
	 * Updates a saved view when the current user owns it or manages settings.
	 *
	 * @param int                 $user_id WordPress user ID.
	 * @param string              $id      Saved view UUID.
	 * @param array<string,mixed> $input   Untrusted request values.
	 * @return array<string,mixed>|WP_Error Updated view or failure.
	 */
	public function update_saved_view( int $user_id, string $id, array $input ) {
		$current = $this->repository->get_by_id( $id );
		if ( null === $current ) {
			return $this->not_found_error();
		}

		if ( ! $this->can_manage_view( $current, $user_id ) ) {
			return $this->forbidden_error();
		}

		$view = $this->normalize_view_input( $input, (int) $current['author_user_id'] );
		if ( null === $view ) {
			return $this->invalid_error();
		}

		if ( ! $this->repository->update( $id, $view ) ) {
			return new WP_Error(
				'ppla_saved_view_update_failed',
				__( 'The saved view could not be updated. Please try again.', 'primeplaced-logless-analytics' ),
				array( 'status' => 500 )
			);
		}

		$updated = $this->repository->get_by_id( $id );
		return null === $updated ? $this->not_found_error() : $this->format_view( $updated, $user_id );
	}

	/**
	 * Deletes a saved view when the current user owns it or manages settings.
	 *
	 * @param int    $user_id WordPress user ID.
	 * @param string $id      Saved view UUID.
	 * @return true|WP_Error Success or failure.
	 */
	public function delete_saved_view( int $user_id, string $id ) {
		$current = $this->repository->get_by_id( $id );
		if ( null === $current ) {
			return $this->not_found_error();
		}

		if ( ! $this->can_manage_view( $current, $user_id ) ) {
			return $this->forbidden_error();
		}

		if ( ! $this->repository->delete( $id ) ) {
			return new WP_Error(
				'ppla_saved_view_delete_failed',
				__( 'The saved view could not be removed. Please try again.', 'primeplaced-logless-analytics' ),
				array( 'status' => 500 )
			);
		}

		return true;
	}

	/**
	 * Normalizes a complete saved-view payload.
	 *
	 * @param array<string,mixed> $input          Untrusted request values.
	 * @param int                 $author_user_id Existing or current author.
	 * @return array<string,mixed>|null Normalized payload or null when invalid.
	 */
	private function normalize_view_input( array $input, int $author_user_id ): ?array {
		$storage_key = $this->normalize_storage_key( $input['storage_key'] ?? '' );
		$name        = $this->normalize_name( $input['name'] ?? '' );
		$table_state = $this->normalize_table_state( $input['table_state'] ?? null );
		$query_state = $this->normalize_query_state( $input['query_state'] ?? null );
		$visibility  = $this->normalize_visibility( $input['visibility'] ?? 'private' );
		$range       = $input['range_days'] ?? 30;

		if ( null === $storage_key || '' === $name || null === $visibility || ! $this->is_valid_range( $range ) || ( null === $table_state && ! $this->is_empty_table_state( $input['table_state'] ?? null ) ) || ( null === $query_state && ! $this->is_empty_table_state( $input['query_state'] ?? null ) ) ) {
			return null;
		}

		return array(
			'storage_key'    => $storage_key,
			'name'           => $name,
			'author_user_id' => $author_user_id,
			'visibility'     => $visibility,
			'range_days'     => (int) $range,
			'table_state'    => $table_state,
			'query_state'    => $query_state,
		);
	}

	/**
	 * Formats a database row for the REST response.
	 *
	 * @param array<string,mixed> $row             Database row.
	 * @param int                 $current_user_id Current WordPress user ID.
	 * @return array<string,mixed> Public view data.
	 */
	private function format_view( array $row, int $current_user_id ): array {
		$author_id = (int) $row['author_user_id'];
		$author    = \get_userdata( $author_id );

		return array(
			'id'          => (string) $row['id'],
			'storage_key' => (string) $row['storage_key'],
			'name'        => (string) $row['name'],
			'range_days'  => $this->normalize_range( $row['range_days'] ?? 30 ),
			'table_state' => $this->normalize_table_state( $row['table_state'] ?? null ),
			'query_state' => $this->normalize_query_state( $row['query_state'] ?? null ),
			'visibility'  => (string) $row['visibility'],
			'author'      => array(
				'id'   => $author_id,
				'name' => $author instanceof \WP_User ? $author->display_name : __( 'Deleted user', 'primeplaced-logless-analytics' ),
			),
			'can_edit'    => $this->can_manage_view( $row, $current_user_id ),
			'can_delete'  => $this->can_manage_view( $row, $current_user_id ),
			'created_at'  => (string) $row['created_at'],
			'updated_at'  => (string) $row['updated_at'],
		);
	}

	/**
	 * Returns whether a user may change another user's saved view.
	 *
	 * @param array<string,mixed> $view    Database row.
	 * @param int                 $user_id Current WordPress user ID.
	 */
	private function can_manage_view( array $view, int $user_id ): bool {
		return $user_id === (int) $view['author_user_id'] || Capabilities::current_user_can_manage_settings();
	}

	/**
	 * Normalizes a report storage key.
	 *
	 * @param mixed $value Untrusted key.
	 */
	private function normalize_storage_key( $value ): ?string {
		$key = \is_string( $value ) ? \sanitize_key( $value ) : '';
		if ( '' === $key || \strlen( $key ) > self::MAX_STORAGE_KEY_LENGTH || 0 !== \strpos( $key, 'ppla_' ) ) {
			return null;
		}

		return $key;
	}

	/**
	 * Normalizes a human-readable saved-view name.
	 *
	 * @param mixed $value Untrusted name.
	 */
	private function normalize_name( $value ): string {
		if ( ! \is_string( $value ) ) {
			return '';
		}

		return \mb_substr( \trim( \sanitize_text_field( $value ) ), 0, self::MAX_NAME_LENGTH );
	}

	/**
	 * Returns canonical JSON for a DataTable preference snapshot.
	 *
	 * @param mixed $value Serialized table state.
	 */
	private function normalize_table_state( $value ): ?string {
		if ( ! \is_string( $value ) || '' === $value ) {
			return null;
		}

		if ( \strlen( $value ) > self::MAX_TABLE_STATE_LENGTH ) {
			return null;
		}

		$decoded = \json_decode( $value, true );
		if ( \JSON_ERROR_NONE !== \json_last_error() || ! \is_array( $decoded ) ) {
			return null;
		}

		$encoded = \wp_json_encode( $decoded, \JSON_UNESCAPED_SLASHES );
		return false === $encoded ? null : $encoded;
	}

	/**
	 * Returns canonical JSON for a report segment and comparison snapshot.
	 *
	 * The shared preference layer preserves this neutral object without knowing
	 * which report owns individual filter names. Each report still validates its
	 * supported filters when calling its REST endpoint.
	 *
	 * @param mixed $value Serialized query state.
	 */
	private function normalize_query_state( $value ): ?string {
		if ( ! \is_string( $value ) || '' === $value ) {
			return null;
		}

		if ( \strlen( $value ) > self::MAX_QUERY_STATE_LENGTH ) {
			return null;
		}

		$decoded = \json_decode( $value, true );
		if ( \JSON_ERROR_NONE !== \json_last_error() || ! \is_array( $decoded ) ) {
			return null;
		}

		$encoded = \wp_json_encode( $decoded, \JSON_UNESCAPED_SLASHES );
		return false === $encoded ? null : $encoded;
	}

	/**
	 * Checks whether a value is one of the supported dashboard ranges.
	 *
	 * @param mixed $value Requested range.
	 */
	private function is_valid_range( $value ): bool {
		return \is_numeric( $value ) && \in_array( (int) $value, self::RANGES, true );
	}

	/**
	 * Normalizes a requested report range.
	 *
	 * @param mixed $value Requested range.
	 */
	private function normalize_range( $value ): int {
		return $this->is_valid_range( $value ) ? (int) $value : 30;
	}

	/**
	 * Normalizes a requested saved-view visibility.
	 *
	 * @param mixed $value Requested visibility.
	 */
	private function normalize_visibility( $value ): ?string {
		$visibility = \is_string( $value ) ? \sanitize_key( $value ) : '';

		return \in_array( $visibility, array( 'private', 'shared' ), true ) ? $visibility : null;
	}

	/**
	 * Checks whether an optional serialized state is empty.
	 *
	 * @param mixed $value Table state input.
	 */
	private function is_empty_table_state( $value ): bool {
		return null === $value || '' === $value;
	}

	/** Returns a blog-scoped user meta key. */
	private function get_preference_meta_key(): string {
		return 'ppla_report_preferences_' . (int) \get_current_blog_id();
	}

	/** Returns a standardized invalid payload error. */
	private function invalid_error(): WP_Error {
		return new WP_Error(
			'ppla_report_view_invalid',
			__( 'Provide a valid report, name, range, and view configuration.', 'primeplaced-logless-analytics' ),
			array( 'status' => 400 )
		);
	}

	/** Returns a standardized not-found error. */
	private function not_found_error(): WP_Error {
		return new WP_Error(
			'ppla_saved_view_not_found',
			__( 'The saved view no longer exists.', 'primeplaced-logless-analytics' ),
			array( 'status' => 404 )
		);
	}

	/** Returns a standardized object-authorization error. */
	private function forbidden_error(): WP_Error {
		return new WP_Error(
			'ppla_saved_view_forbidden',
			__( 'Only the author or a site administrator can change this saved view.', 'primeplaced-logless-analytics' ),
			array( 'status' => 403 )
		);
	}
}
