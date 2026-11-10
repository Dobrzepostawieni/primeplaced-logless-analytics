<?php
/**
 * Maintenance Service.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Services;

use Primeplaced_Logless_Analytics\Data\ReportClock;
use Primeplaced_Logless_Analytics\Engine\Base;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class MaintenanceService
 *
 * Handles database cleanups and optimization routines.
 */
class MaintenanceService extends Base {

	/**
	 * Purges analytics data older than the specified number of days.
	 * Utilizes chunked deletions to prevent MySQL table locks.
	 *
	 * @param int $days Number of days to retain data (0 means clear all).
	 * @throws \RuntimeException When an analytics table cannot be purged.
	 * @return bool True if there are more chunks to process.
	 */
	public function purge_old_data( int $days ): bool {
		global $wpdb;

		$sessions  = $wpdb->prefix . 'ppla_sessions';
		$pageviews = $wpdb->prefix . 'ppla_pageviews';
		$events    = $wpdb->prefix . 'ppla_event_contracts';
		$buffer    = $wpdb->prefix . 'ppla_buffer';

		if ( $days <= 0 ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$events_result = $wpdb->query( $wpdb->prepare( 'TRUNCATE TABLE %i', $events ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$pageviews_result = $wpdb->query( $wpdb->prepare( 'TRUNCATE TABLE %i', $pageviews ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$sessions_result = $wpdb->query( $wpdb->prepare( 'TRUNCATE TABLE %i', $sessions ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$buffer_result = $wpdb->query( $wpdb->prepare( 'TRUNCATE TABLE %i', $buffer ) );

			if ( \in_array( false, array( $events_result, $pageviews_result, $sessions_result, $buffer_result ), true ) ) {
				throw new \RuntimeException( 'Unable to clear all analytics data.' );
			}

			\do_action( 'ppla_analytics_data_purged', 0 );
			$this->clear_analytics_cache();
			return false;
		} else {
			$chunk_size = 5000;

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$deleted_pv = $wpdb->query(
				$wpdb->prepare(
					'DELETE FROM %i WHERE created_at < %s LIMIT %d',
					$pageviews,
					ReportClock::days_ago( $days ),
					$chunk_size
				)
			);

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$deleted_events = $wpdb->query(
				$wpdb->prepare(
					'DELETE FROM %i WHERE occurred_at < %s LIMIT %d',
					$events,
					ReportClock::days_ago( $days ),
					$chunk_size
				)
			);

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$deleted_sessions = $wpdb->query(
				$wpdb->prepare(
					'DELETE FROM %i WHERE created_at < %s AND id NOT IN (SELECT session_id FROM %i) AND id NOT IN (SELECT session_id FROM %i) LIMIT %d',
					$sessions,
					ReportClock::days_ago( $days ),
					$pageviews,
					$events,
					$chunk_size
				)
			);

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$deleted_buffer = $wpdb->query(
				$wpdb->prepare(
					'DELETE FROM %i WHERE created_at < %s LIMIT %d',
					$buffer,
					ReportClock::days_ago( $days ),
					$chunk_size
				)
			);

			if ( \in_array( false, array( $deleted_pv, $deleted_events, $deleted_sessions, $deleted_buffer ), true ) ) {
				throw new \RuntimeException( 'Unable to purge expired analytics data.' );
			}

			$has_more = ( $deleted_pv === $chunk_size || $deleted_sessions === $chunk_size || $deleted_events === $chunk_size || $deleted_buffer === $chunk_size );

			if ( ! $has_more ) {
				\do_action( 'ppla_analytics_data_purged', $days );
				$this->clear_analytics_cache();
			}

			return $has_more;
		}
	}

	/**
	 * Retrieves physical database sizes and overhead.
	 *
	 * @throws \RuntimeException When analytics table statistics cannot be read.
	 * @return array{pageviews_size: string, sessions_size: string, total_size: string, overhead: string, is_optimized: boolean} Database statistics.
	 */
	public function get_db_stats(): array {
		global $wpdb;

		$like_pattern = $wpdb->esc_like( $wpdb->prefix . 'ppla_' ) . '%';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$tables = $wpdb->get_results( $wpdb->prepare( 'SHOW TABLE STATUS LIKE %s', $like_pattern ), ARRAY_A );

		$total_size     = 0;
		$overhead       = 0;
		$pageviews_size = 0;
		$sessions_size  = 0;

		$target_pageviews = $wpdb->prefix . 'ppla_pageviews';
		$target_sessions  = $wpdb->prefix . 'ppla_sessions';

		if ( ! \is_array( $tables ) ) {
			throw new \RuntimeException( 'Unable to read analytics database statistics.' );
		}

		foreach ( $tables as $table ) {
			$table_name = isset( $table['Name'] ) ? (string) $table['Name'] : '';
			$data_len   = isset( $table['Data_length'] ) ? (int) $table['Data_length'] : 0;
			$index_len  = isset( $table['Index_length'] ) ? (int) $table['Index_length'] : 0;
			$data_free  = isset( $table['Data_free'] ) ? (int) $table['Data_free'] : 0;

			$combined_size = $data_len + $index_len;
			$total_size   += $combined_size;
			$overhead     += $data_free;

			if ( $target_pageviews === $table_name ) {
				$pageviews_size = $combined_size;
			} elseif ( $target_sessions === $table_name ) {
				$sessions_size = $combined_size;
			}
		}

		return array(
			'pageviews_size' => (string) \size_format( $pageviews_size, 2 ),
			'sessions_size'  => (string) \size_format( $sessions_size, 2 ),
			'total_size'     => (string) \size_format( $total_size, 2 ),
			'overhead'       => (string) \size_format( $overhead, 2 ),
			'is_optimized'   => 0 === $overhead,
		);
	}

	/**
	 * Optimizes custom tables.
	 *
	 * @throws \RuntimeException When an analytics table cannot be optimized.
	 */
	public function optimize_db(): void {
		global $wpdb;

		$pageviews = $wpdb->prefix . 'ppla_pageviews';
		$sessions  = $wpdb->prefix . 'ppla_sessions';
		$events    = $wpdb->prefix . 'ppla_event_contracts';
		$buffer    = $wpdb->prefix . 'ppla_buffer';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$result = $wpdb->query( $wpdb->prepare( 'OPTIMIZE TABLE %i, %i, %i, %i', $pageviews, $sessions, $events, $buffer ) );
		if ( false === $result ) {
			throw new \RuntimeException( 'Unable to optimize analytics tables.' );
		}
	}

	/**
	 * Invalidates global dashboard cache.
	 */
	private function clear_analytics_cache(): void {
		\update_option( 'ppla_stats_version', \uniqid( 'v_', true ), false );
	}
}
