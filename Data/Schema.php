<?php
/**
 * Database Schema Definition.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Data;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Schema
 *
 * Handles the creation and updates of custom database tables for analytics.
 */
class Schema {
	/** Core analytics schema version, independent of the plugin release version. */
	public const VERSION = '6';

	/**
	 * Create or update custom database tables using dbDelta.
	 */
	public function create_tables(): bool {
		global $wpdb;

		$charset_collate = $wpdb->get_charset_collate();

		if ( ! \function_exists( '\dbDelta' ) ) {
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		}

		$sessions_table      = $wpdb->prefix . 'ppla_sessions';
		$pageviews_table     = $wpdb->prefix . 'ppla_pageviews';
		$buffer_table        = $wpdb->prefix . 'ppla_buffer';
		$custom_events_table = $wpdb->prefix . 'ppla_custom_event_configurations';
		$saved_views_table   = $wpdb->prefix . 'ppla_saved_views';

		$sql_sessions = "CREATE TABLE {$sessions_table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			session_hash char(64) NOT NULL,
			device_type varchar(20) NOT NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY session_hash (session_hash(10)),
			KEY created_device (created_at, device_type)
		) {$charset_collate};";

		$sql_pageviews = "CREATE TABLE {$pageviews_table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			hit_id varchar(64) NULL DEFAULT NULL,
			session_id bigint(20) unsigned NOT NULL,
			url varchar(500) NOT NULL,
			referrer varchar(500) NOT NULL DEFAULT '',
			acquisition_channel varchar(20) NOT NULL DEFAULT '',
			device_type varchar(20) NOT NULL DEFAULT 'desktop',
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY hit_id (hit_id),
			KEY session_calc (session_id, created_at),
			KEY created_device (created_at, device_type),
			KEY lookup_optimized (created_at, url(255))
		) {$charset_collate};";

		$sql_buffer = "CREATE TABLE {$buffer_table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			payload longtext NOT NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY created_at (created_at)
		) {$charset_collate};";

		$sql_custom_events = "CREATE TABLE {$custom_events_table} (
			id char(36) NOT NULL,
			event_name varchar(80) NOT NULL,
			trigger_type varchar(12) NOT NULL,
			css_selector varchar(255) NOT NULL DEFAULT '',
			is_active tinyint(1) NOT NULL DEFAULT 1,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY event_name (event_name),
			KEY active_trigger (is_active, trigger_type)
		) {$charset_collate};";

		$sql_saved_views = "CREATE TABLE {$saved_views_table} (
			id char(36) NOT NULL,
			storage_key varchar(100) NOT NULL,
			name varchar(120) NOT NULL,
			author_user_id bigint(20) unsigned NOT NULL,
			visibility varchar(12) NOT NULL DEFAULT 'private',
			range_days smallint(5) unsigned NOT NULL DEFAULT 30,
			table_state longtext NULL,
			query_state longtext NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY author_storage (author_user_id, storage_key),
			KEY visibility_storage (visibility, storage_key),
			KEY updated_at (updated_at)
		) {$charset_collate};";

		\dbDelta( $sql_sessions );
		\dbDelta( $sql_pageviews );
		\dbDelta( $sql_buffer );
		\dbDelta( $sql_custom_events );
		\dbDelta( $sql_saved_views );

		foreach ( array( $sessions_table, $pageviews_table, $buffer_table, $custom_events_table, $saved_views_table ) as $table ) {
			if ( ! SchemaInspector::table_exists( $table ) ) {
				return false;
			}
		}

		if ( ! SchemaInspector::column_exists( $pageviews_table, 'hit_id' ) || ! SchemaInspector::index_exists( $pageviews_table, 'hit_id' ) || ! SchemaInspector::column_exists( $pageviews_table, 'acquisition_channel' ) || ! SchemaInspector::column_exists( $saved_views_table, 'query_state' ) ) {
			return false;
		}

		return true;
	}
}
