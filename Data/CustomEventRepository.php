<?php
/**
 * Custom event configuration persistence.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Persists the Free/Core custom-event configuration registry.
 */
class CustomEventRepository {

	/**
	 * Returns every configured custom event, newest first.
	 *
	 * @return array<int,array{id:string,event_name:string,trigger_type:string,css_selector:string,is_active:bool}>
	 */
	public function get_all(): array {
		global $wpdb;

		$table = $wpdb->prefix . 'ppla_custom_event_configurations';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT id, event_name, trigger_type, css_selector, is_active FROM %i ORDER BY created_at DESC',
				$table
			),
			ARRAY_A
		);

		return \is_array( $rows ) ? \array_map( array( $this, 'normalize_row' ), $rows ) : array();
	}

	/**
	 * Returns only active events suitable for the public tracker configuration.
	 *
	 * @return array<int,array{id:string,event_name:string,trigger_type:string,css_selector:string,is_active:bool}>
	 */
	public function get_active(): array {
		global $wpdb;

		$table = $wpdb->prefix . 'ppla_custom_event_configurations';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT id, event_name, trigger_type, css_selector, is_active FROM %i WHERE is_active = 1 ORDER BY created_at DESC',
				$table
			),
			ARRAY_A
		);

		return \is_array( $rows ) ? \array_map( array( $this, 'normalize_row' ), $rows ) : array();
	}

	/**
	 * Returns one configured event by its identifier.
	 *
	 * @param string $id Event identifier.
	 * @return array{id:string,event_name:string,trigger_type:string,css_selector:string,is_active:bool}|null Event configuration, or null when absent.
	 */
	public function get_by_id( string $id ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'ppla_custom_event_configurations';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Reads one configuration before a requested mutation.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT id, event_name, trigger_type, css_selector, is_active FROM %i WHERE id = %s',
				$table,
				$id
			),
			ARRAY_A
		);

		return \is_array( $row ) ? $this->normalize_row( $row ) : null;
	}

	/**
	 * Persists a normalized custom-event configuration.
	 *
	 * @param array{event_name:string,trigger_type:string,css_selector:string,is_active:bool} $event Normalized event configuration.
	 * @return array{id:string,event_name:string,trigger_type:string,css_selector:string,is_active:bool}|null Created event, or null on database failure.
	 */
	public function create( array $event ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'ppla_custom_event_configurations';
		$id    = \wp_generate_uuid4();
		$now   = \current_time( 'mysql', true );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$created = $wpdb->insert(
			$table,
			array(
				'id'           => $id,
				'event_name'   => $event['event_name'],
				'trigger_type' => $event['trigger_type'],
				'css_selector' => $event['css_selector'],
				'is_active'    => $event['is_active'] ? 1 : 0,
				'created_at'   => $now,
				'updated_at'   => $now,
			),
			array( '%s', '%s', '%s', '%s', '%d', '%s', '%s' )
		);

		return false === $created ? null : array_merge( array( 'id' => $id ), $event );
	}

	/**
	 * Enables or disables an existing custom event.
	 *
	 * @param string $id Event identifier.
	 * @param bool   $is_active Whether the event is active.
	 * @return bool False only when the database operation fails.
	 */
	public function update_active( string $id, bool $is_active ): bool {
		global $wpdb;

		$table = $wpdb->prefix . 'ppla_custom_event_configurations';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$updated = $wpdb->update(
			$table,
			array(
				'is_active'  => $is_active ? 1 : 0,
				'updated_at' => \current_time( 'mysql', true ),
			),
			array( 'id' => $id ),
			array( '%d', '%s' ),
			array( '%s' )
		);

		return false !== $updated;
	}

	/**
	 * Deletes a custom event configuration. The operation is idempotent.
	 *
	 * @param string $id Event identifier.
	 * @return bool False only when the database operation fails.
	 */
	public function delete( string $id ): bool {
		global $wpdb;

		$table = $wpdb->prefix . 'ppla_custom_event_configurations';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return false !== $wpdb->delete( $table, array( 'id' => $id ), array( '%s' ) );
	}

	/**
	 * Converts database scalar values into the public configuration shape.
	 *
	 * @param array<string,mixed> $row Database row.
	 * @return array{id:string,event_name:string,trigger_type:string,css_selector:string,is_active:bool} Normalized row.
	 */
	private function normalize_row( array $row ): array {
		return array(
			'id'           => (string) $row['id'],
			'event_name'   => (string) $row['event_name'],
			'trigger_type' => (string) $row['trigger_type'],
			'css_selector' => (string) $row['css_selector'],
			'is_active'    => (bool) $row['is_active'],
		);
	}
}
