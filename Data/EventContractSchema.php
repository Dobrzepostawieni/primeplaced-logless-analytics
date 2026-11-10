<?php
/**
 * Event Contract Schema.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Creates the neutral Core event envelope store. */
class EventContractSchema {

	private const VERSION = '3';

	/** Registers the schema migration after WordPress is ready. */
	public function initialize(): bool {
		\add_action( 'init', array( $this, 'maybe_create_table' ), 1 );
		return true;
	}

	/** Creates the versioned Core event-contract table when needed. */
	public function maybe_create_table(): void {
		global $wpdb;
		$table = $wpdb->prefix . 'ppla_event_contracts';
		if ( self::VERSION === \get_option( 'ppla_event_contract_schema_version', '' ) && SchemaInspector::table_exists( $table ) ) {
			return;
		}

		if ( ! \function_exists( '\dbDelta' ) ) {
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		}

		$charset = $wpdb->get_charset_collate();
		$sql     = "CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			session_id bigint(20) unsigned NOT NULL DEFAULT 0,
			event_id varchar(64) NOT NULL,
			contract_version tinyint(3) unsigned NOT NULL,
			event_type varchar(100) NOT NULL,
			source_channel varchar(20) NOT NULL,
			provider_id varchar(50) NOT NULL DEFAULT '',
			device_type varchar(20) NOT NULL DEFAULT '',
			subject_kind varchar(32) NOT NULL DEFAULT '',
			subject_key varchar(64) NOT NULL DEFAULT '',
			occurred_at datetime NOT NULL,
			received_at datetime NOT NULL,
			amount decimal(18,4) NULL,
			currency char(3) NOT NULL DEFAULT '',
			quantity decimal(18,4) NULL,
			attributes longtext NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY event_id (event_id),
			KEY event_type_date (event_type, occurred_at),
			KEY provider_date (provider_id, occurred_at),
			KEY event_report_device_lookup (provider_id, event_type, subject_kind, subject_key, device_type, occurred_at),
			KEY session_date (session_id, occurred_at)
		) {$charset};";

		\dbDelta( $sql );

		if ( SchemaInspector::table_exists( $table ) ) {
			\update_option( 'ppla_event_contract_schema_version', self::VERSION, false );
		}
	}
}
