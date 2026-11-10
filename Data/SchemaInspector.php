<?php
/**
 * Database schema inspection helpers.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Verifies custom-table migrations before their version is persisted. */
final class SchemaInspector {

	/** Prevents instantiation. */
	private function __construct() {}

	/**
	 * Checks whether a full table name exists in the current site database.
	 *
	 * @param string $table Full table name.
	 */
	public static function table_exists( string $table ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$found = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table ) ) );

		return $table === $found;
	}

	/**
	 * Checks whether a column exists in a custom table.
	 *
	 * @param string $table Full table name.
	 * @param string $column Column name.
	 */
	public static function column_exists( string $table, string $column ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$found = $wpdb->get_var( $wpdb->prepare( 'SHOW COLUMNS FROM %i LIKE %s', $table, $wpdb->esc_like( $column ) ) );

		return $column === $found;
	}

	/**
	 * Checks whether a named index exists in a custom table.
	 *
	 * @param string $table Full table name.
	 * @param string $index Index name.
	 */
	public static function index_exists( string $table, string $index ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$found = $wpdb->get_var( $wpdb->prepare( 'SHOW INDEX FROM %i WHERE Key_name = %s', $table, $index ), 2 );

		return $index === $found;
	}
}
