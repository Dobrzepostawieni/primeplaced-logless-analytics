<?php
/**
 * Report period boundaries in the site time zone.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Computes report boundaries as site-local DATETIME strings.
 *
 * Analytics rows store `created_at` in the WordPress time zone, while MySQL
 * `NOW()` follows the database server zone. Every report therefore receives
 * its boundaries from PHP. A period of N days covers today and the N - 1
 * preceding calendar days, so KPI totals equal the sum of the daily chart.
 */
final class ReportClock {

	private const FORMAT = 'Y-m-d H:i:s';

	private const OPEN_END = '9999-12-31 23:59:59';

	/** Prevents instantiation. */
	private function __construct() {}

	/** Returns the current site-local time. */
	public static function now(): string {
		return \current_datetime()->format( self::FORMAT );
	}

	/**
	 * Returns the inclusive start of a period that ends today.
	 *
	 * The previous period of the same length starts at `period_start( 2 * $days )`
	 * and ends, exclusively, at `period_start( $days )`.
	 *
	 * @param int $days Number of calendar days, including today.
	 */
	public static function period_start( int $days ): string {
		$days     = \max( 1, $days );
		$midnight = \current_datetime()->setTime( 0, 0 );
		$start    = $midnight->modify( '-' . ( $days - 1 ) . ' days' );

		return ( false === $start ? $midnight : $start )->format( self::FORMAT );
	}

	/**
	 * Returns the exclusive end of a period that ended a number of days ago.
	 *
	 * Zero means the period is still open, so no upper bound applies.
	 *
	 * @param int $days_ago Length of the newer periods that follow this one.
	 */
	public static function period_end( int $days_ago ): string {
		return $days_ago > 0 ? self::period_start( $days_ago ) : self::OPEN_END;
	}

	/**
	 * Returns the site-local time exactly a number of days ago.
	 *
	 * Retention uses this rolling cutoff; zero days means "now".
	 *
	 * @param int $days Days before now.
	 */
	public static function days_ago( int $days ): string {
		return self::minutes_ago( \max( 0, $days ) * 24 * 60 );
	}

	/**
	 * Returns the site-local time a number of minutes ago.
	 *
	 * @param int $minutes Minutes before now.
	 */
	public static function minutes_ago( int $minutes ): string {
		$now   = \current_datetime();
		$value = $now->modify( '-' . \max( 0, $minutes ) . ' minutes' );

		return ( false === $value ? $now : $value )->format( self::FORMAT );
	}
}
