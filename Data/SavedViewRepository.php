<?php
/**
 * Saved report-view persistence.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Stores report configurations that may be private to one analytics user or
 * shared with the analytics team. No report rows or visitor data are stored.
 */
class SavedViewRepository {

	/**
	 * Returns views a user may open, newest first.
	 *
	 * @param int    $user_id     Current user ID.
	 * @param string $storage_key Optional report storage key.
	 * @return array<int,array<string,mixed>> Raw saved-view rows.
	 */
	public function get_visible_for_user( int $user_id, string $storage_key = '' ): array {
		global $wpdb;

		$table = $wpdb->prefix . 'ppla_saved_views';

		if ( '' !== $storage_key ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT * FROM %i WHERE ( author_user_id = %d OR visibility = %s ) AND storage_key = %s ORDER BY updated_at DESC',
					$table,
					$user_id,
					'shared',
					$storage_key
				),
				ARRAY_A
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT * FROM %i WHERE author_user_id = %d OR visibility = %s ORDER BY updated_at DESC',
					$table,
					$user_id,
					'shared'
				),
				ARRAY_A
			);
		}

		return \is_array( $rows ) ? $rows : array();
	}

	/**
	 * Returns one saved view regardless of visibility.
	 *
	 * @param string $id Saved view UUID.
	 * @return array<string,mixed>|null Raw row, or null when absent.
	 */
	public function get_by_id( string $id ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'ppla_saved_views';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Reads one configuration for authorization.
		$row = $wpdb->get_row(
			$wpdb->prepare( 'SELECT * FROM %i WHERE id = %s', $table, $id ),
			ARRAY_A
		);

		return \is_array( $row ) ? $row : null;
	}

	/**
	 * Creates one saved view.
	 *
	 * @param array<string,mixed> $view Validated view payload.
	 * @return array<string,mixed>|null Created raw row, or null on database failure.
	 */
	public function create( array $view ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'ppla_saved_views';
		$id    = \wp_generate_uuid4();
		$now   = \current_time( 'mysql', true );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Persists an explicit administrator action.
		$created = $wpdb->insert(
			$table,
			array(
				'id'             => $id,
				'storage_key'    => $view['storage_key'],
				'name'           => $view['name'],
				'author_user_id' => $view['author_user_id'],
				'visibility'     => $view['visibility'],
				'range_days'     => $view['range_days'],
				'table_state'    => $view['table_state'],
				'query_state'    => $view['query_state'],
				'created_at'     => $now,
				'updated_at'     => $now,
			),
			array( '%s', '%s', '%s', '%d', '%s', '%d', '%s', '%s', '%s', '%s' )
		);

		return false === $created ? null : $this->get_by_id( $id );
	}

	/**
	 * Updates a saved view owned by an authorized user.
	 *
	 * @param string              $id   Saved view UUID.
	 * @param array<string,mixed> $view Validated view payload.
	 * @return bool False only when the database operation fails.
	 */
	public function update( string $id, array $view ): bool {
		global $wpdb;

		$table = $wpdb->prefix . 'ppla_saved_views';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Persists an explicit administrator action.
		$updated = $wpdb->update(
			$table,
			array(
				'storage_key' => $view['storage_key'],
				'name'        => $view['name'],
				'visibility'  => $view['visibility'],
				'range_days'  => $view['range_days'],
				'table_state' => $view['table_state'],
				'query_state' => $view['query_state'],
				'updated_at'  => \current_time( 'mysql', true ),
			),
			array( 'id' => $id ),
			array( '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s' ),
			array( '%s' )
		);

		return false !== $updated;
	}

	/**
	 * Deletes one saved view. Repeating the request is safe.
	 *
	 * @param string $id Saved view UUID.
	 * @return bool False only when the database operation fails.
	 */
	public function delete( string $id ): bool {
		global $wpdb;

		$table = $wpdb->prefix . 'ppla_saved_views';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Persists an explicit administrator action.
		return false !== $wpdb->delete( $table, array( 'id' => $id ), array( '%s' ) );
	}
}
