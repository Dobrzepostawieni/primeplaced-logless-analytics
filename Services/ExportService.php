<?php
/**
 * Export Service.
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
 * Class ExportService
 *
 * Handles streaming large analytics datasets.
 */
class ExportService extends Base {

	/**
	 * Retrieves raw traffic logs for CSV export using memory-efficient Generators.
	 *
	 * @param int $days Number of days to export.
	 *
	 * @return \Generator<int, array{created_at: string, url: string, referrer: string, device_type: string}>
	 */
	public function get_raw_export_data( int $days = 30 ): \Generator {
		global $wpdb;

		$pageviews = $wpdb->prefix . 'ppla_pageviews';
		$limit     = 500;
		$last_id   = 0;
		$is_first  = true;

		while ( true ) {
			if ( $is_first ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$results  = $wpdb->get_results(
					$wpdb->prepare(
						'SELECT p.id, p.created_at, p.url, p.referrer, p.device_type 
						 FROM %i p 
						 WHERE p.created_at >= %s 
						 ORDER BY p.id DESC 
						 LIMIT %d',
						$pageviews,
						ReportClock::period_start( $days ),
						$limit
					),
					ARRAY_A
				);
				$is_first = false;
			} else {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$results = $wpdb->get_results(
					$wpdb->prepare(
						'SELECT p.id, p.created_at, p.url, p.referrer, p.device_type 
						 FROM %i p 
						 WHERE p.created_at >= %s 
						   AND p.id < %d
						 ORDER BY p.id DESC 
						 LIMIT %d',
						$pageviews,
						ReportClock::period_start( $days ),
						$last_id,
						$limit
					),
					ARRAY_A
				);
			}

			if ( empty( $results ) || ! \is_array( $results ) ) {
				break;
			}

			foreach ( $results as $row ) {
				$last_id = (int) $row['id'];

				yield array(
					'created_at'  => (string) $row['created_at'],
					'url'         => (string) $row['url'],
					'referrer'    => (string) $row['referrer'],
					'device_type' => (string) $row['device_type'],
				);
			}
		}
	}
}
