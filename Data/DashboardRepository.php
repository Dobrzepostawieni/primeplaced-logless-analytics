<?php
/**
 * Dashboard Repository.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Data;

use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Services\PrivacyModeHistory;
use Primeplaced_Logless_Analytics\Services\UrlPath;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DashboardRepository
 *
 * Handles retrieving and aggregating analytical metrics.
 */
class DashboardRepository extends Base {

	private const CACHE_GROUP = 'ppla_analytics';

	/**
	 * Cached URL scope for delegated author analytics users.
	 *
	 * @var array<int, string>|null
	 */
	private ?array $author_scope_urls = null;

	/**
	 * Tracks whether the author scope was resolved for this request.
	 */
	private bool $author_scope_loaded = false;

	/** Privacy transition history used to annotate report ranges. */
	private PrivacyModeHistory $privacy_history;

	/**
	 * Dashboard repository constructor.
	 *
	 * @param PrivacyModeHistory $privacy_history Privacy history service.
	 */
	public function __construct( PrivacyModeHistory $privacy_history ) {
		$this->privacy_history = $privacy_history;
	}

	/**
	 * Retrieves aggregated overview statistics and compares them with the previous period.
	 *
	 * A visit is a session with at least one recorded pageview. Visits, bounce
	 * rate, duration and pages per visit are all derived from the same pageview
	 * rows, so the figures agree with the daily chart and the source reports.
	 * Each metric carries the raw `value`, the `previous` period value, a
	 * `trend` (percentage change, or `null` when the previous period was empty)
	 * and a localized `display` string for PDF and email output.
	 *
	 * @param int $days Number of calendar days, including today.
	 * @return array<string, mixed> Aggregated stats.
	 */
	public function get_overview_stats( int $days = 30 ): array {
		$days           = \max( 1, $days );
		$version        = \get_option( 'ppla_stats_version', '1' );
		$privacy_mode   = $this->get_privacy_mode();
		$scope          = $this->get_pageview_scope_condition();
		$start          = ReportClock::period_start( $days );
		$ppla_cache_key = 'ppla_overview_v2_' . $days . '_' . $start . '_' . $privacy_mode . '_' . \md5( (string) \wp_json_encode( $scope['params'] ) ) . '_' . $version;
		$cached         = \wp_cache_get( $ppla_cache_key, self::CACHE_GROUP );

		if ( false !== $cached && \is_array( $cached ) ) {
			/**
			 * Cached results.
			 *
			 * @var array<string, mixed> $cached
			 */
			return $cached;
		}

		$current  = $this->get_period_totals( $start, '', $scope );
		$previous = $this->get_period_totals( ReportClock::period_start( $days * 2 ), $start, $scope );

		if ( 'strict_anonymous' === $privacy_mode ) {
			$data = array(
				'privacy_mode'    => $privacy_mode,
				'unique_visits'   => $this->count_metric( $current['pageviews'], $previous['pageviews'] ),
				'pageviews'       => $this->count_metric( $current['pageviews'], $previous['pageviews'] ),
				'bounce_rate'     => $this->unavailable_metric(),
				'avg_session'     => $this->unavailable_metric(),
				'pages_per_visit' => $this->unavailable_metric(),
			);

			\wp_cache_set( $ppla_cache_key, $data, self::CACHE_GROUP, HOUR_IN_SECONDS );

			return $data;
		}

		$c_bounce = $current['visits'] > 0 ? \round( ( $current['bounced'] / $current['visits'] ) * 100, 1 ) : 0.0;
		$p_bounce = $previous['visits'] > 0 ? \round( ( $previous['bounced'] / $previous['visits'] ) * 100, 1 ) : 0.0;
		$c_pages  = $current['visits'] > 0 ? \round( $current['pageviews'] / $current['visits'], 1 ) : 0.0;
		$p_pages  = $previous['visits'] > 0 ? \round( $previous['pageviews'] / $previous['visits'], 1 ) : 0.0;

		$bounce_delta   = \round( $c_bounce - $p_bounce, 1 );
		$duration_delta = $current['avg_duration'] - $previous['avg_duration'];
		$pages_trend    = $this->calculate_ratio_trend( $c_pages, $p_pages );

		$data = array(
			'privacy_mode'    => $privacy_mode,
			'unique_visits'   => $this->count_metric( $current['visits'], $previous['visits'] ),
			'pageviews'       => $this->count_metric( $current['pageviews'], $previous['pageviews'] ),
			'bounce_rate'     => array(
				'value'      => $c_bounce,
				'previous'   => $p_bounce,
				'trend'      => $previous['visits'] > 0 ? $bounce_delta : null,
				'trend_unit' => 'points',
				'status'     => $previous['visits'] > 0 ? $this->trend_status( -$bounce_delta ) : 'neutral',
				'display'    => \number_format_i18n( $c_bounce, 1 ) . '%',
			),
			'avg_session'     => array(
				'value'      => $current['avg_duration'],
				'previous'   => $previous['avg_duration'],
				'trend'      => $previous['visits'] > 0 ? $duration_delta : null,
				'trend_unit' => 'seconds',
				'status'     => $previous['visits'] > 0 ? $this->trend_status( $duration_delta ) : 'neutral',
				'display'    => $this->format_duration( $current['avg_duration'] ),
			),
			'pages_per_visit' => array(
				'value'      => $c_pages,
				'previous'   => $p_pages,
				'trend'      => $pages_trend,
				'trend_unit' => 'percent',
				'status'     => null === $pages_trend ? 'neutral' : $this->trend_status( $pages_trend ),
				'display'    => \number_format_i18n( $c_pages, 1 ),
			),
		);

		\wp_cache_set( $ppla_cache_key, $data, self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $data;
	}

	/**
	 * Aggregates pageviews, visits, bounces and visit duration for one period.
	 *
	 * @param string                                   $start Inclusive site-local start.
	 * @param string                                   $end   Exclusive site-local end, or empty for "until now".
	 * @param array{sql: string, params: array<mixed>} $scope Author scope condition.
	 * @return array{pageviews: int, visits: int, bounced: int, avg_duration: int}
	 */
	private function get_period_totals( string $start, string $end, array $scope ): array {
		global $wpdb;

		$table      = $wpdb->prefix . 'ppla_pageviews';
		$range_sql  = 'created_at >= %s' . ( '' !== $end ? ' AND created_at < %s' : '' );
		$range_args = '' !== $end ? array( $start, $end ) : array( $start );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
		$pageviews = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(id) FROM %i WHERE ' . $range_sql . $scope['sql'],
				$table,
				...\array_merge( $range_args, $scope['params'] )
			)
		);
		// phpcs:enable

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
		$sessions = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT COUNT(*) AS visits,
					SUM(CASE WHEN pv_count = 1 THEN 1 ELSE 0 END) AS bounced,
					AVG(duration) AS avg_duration
				 FROM (
					SELECT session_id, COUNT(id) AS pv_count, TIMESTAMPDIFF(SECOND, MIN(created_at), MAX(created_at)) AS duration
					FROM %i
					WHERE session_id > 0 AND ' . $range_sql . $scope['sql'] . '
					GROUP BY session_id
				 ) AS visits',
				$table,
				...\array_merge( $range_args, $scope['params'] )
			),
			ARRAY_A
		);
		// phpcs:enable

		$sessions = \is_array( $sessions ) ? $sessions : array();

		return array(
			'pageviews'    => $pageviews,
			'visits'       => (int) ( $sessions['visits'] ?? 0 ),
			'bounced'      => (int) ( $sessions['bounced'] ?? 0 ),
			'avg_duration' => (int) \round( (float) ( $sessions['avg_duration'] ?? 0 ) ),
		);
	}

	/**
	 * Builds a count metric with its previous value and percentage trend.
	 *
	 * @param int $current  Current period value.
	 * @param int $previous Previous period value.
	 * @return array<string, mixed>
	 */
	private function count_metric( int $current, int $previous ): array {
		$trend = $this->calculate_trend( $current, $previous );

		return array(
			'value'      => $current,
			'previous'   => $previous,
			'trend'      => $trend,
			'trend_unit' => 'percent',
			'status'     => null === $trend ? 'neutral' : $this->trend_status( $trend ),
			'display'    => \number_format_i18n( $current ),
		);
	}

	/**
	 * Describes a metric that the active privacy mode cannot measure.
	 *
	 * @return array<string, mixed>
	 */
	private function unavailable_metric(): array {
		return array(
			'value'      => null,
			'previous'   => null,
			'trend'      => null,
			'trend_unit' => 'percent',
			'status'     => 'neutral',
			'display'    => '—',
		);
	}

	/**
	 * Maps a signed change to a status where an increase is desirable.
	 *
	 * @param float|int $change Signed change.
	 */
	private function trend_status( $change ): string {
		if ( $change > 0 ) {
			return 'positive';
		}

		return $change < 0 ? 'negative' : 'neutral';
	}

	/**
	 * Returns the operational state needed to explain an empty or stale report.
	 *
	 * The response deliberately exposes timestamps and counts, never payloads or
	 * visitor identifiers.
	 *
	 * @return array<string, mixed>
	 */
	public function get_dashboard_status(): array {
		global $wpdb;

		$pageviews_table = $wpdb->prefix . 'ppla_pageviews';
		$buffer_table    = $wpdb->prefix . 'ppla_buffer';
		$events_table    = $wpdb->prefix . 'ppla_event_contracts';
		$required_tables = array( $pageviews_table, $buffer_table, $events_table );

		if ( ! $this->status_tables_exist( $required_tables ) ) {
			return array(
				'status'                      => 'error',
				'reason'                      => 'configuration_error',
				'privacy_mode'                => $this->get_privacy_mode(),
				'last_received_at'            => '',
				'last_received_display'       => '',
				'last_processed_at'           => '',
				'last_processed_display'      => '',
				'last_report_visible_at'      => '',
				'last_report_visible_display' => '',
				'last_pageview_at'            => '',
				'oldest_pending_at'           => '',
				'pending_hits'                => 0,
				'minutes_since_data'          => null,
				'processing_lag_seconds'      => null,
				'cron_scheduled'              => false,
				'storage_ready'               => false,
				'viewer_excluded'             => false,
				'exclusion_reasons'           => array(),
				'privacy_effects'             => $this->get_privacy_effects(),
				'needs_attention'             => array(
					array(
						'id'     => 'ppla_storage_configuration',
						'kind'   => 'configuration',
						'label'  => 'configuration_error',
						'target' => 'settings',
					),
				),
				'next_action'                 => 'open_maintenance',
			);
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$last_pageview_at = (string) $wpdb->get_var( $wpdb->prepare( 'SELECT created_at FROM %i ORDER BY id DESC LIMIT 1', $pageviews_table ) );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$last_event_at = (string) $wpdb->get_var( $wpdb->prepare( 'SELECT received_at FROM %i ORDER BY id DESC LIMIT 1', $events_table ) );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$pending_hits = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(id) FROM %i', $buffer_table ) );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$oldest_pending_at = (string) $wpdb->get_var( $wpdb->prepare( 'SELECT created_at FROM %i ORDER BY id ASC LIMIT 1', $buffer_table ) );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$latest_pending_at = (string) $wpdb->get_var( $wpdb->prepare( 'SELECT created_at FROM %i ORDER BY id DESC LIMIT 1', $buffer_table ) );

		$last_processed_at = $this->latest_status_timestamp( array( $last_pageview_at, $last_event_at ) );
		$last_received_at  = $this->latest_status_timestamp( array( $last_processed_at, $latest_pending_at ) );
		// Processed rows are the source used by the current reports. Keep this as
		// an explicit contract so the UI can distinguish processing from report
		// visibility without exposing payloads or visitor identifiers.
		$last_report_visible_at = $last_processed_at;
		$now                    = current_datetime();
		$last_processed         = '' !== $last_processed_at ? strtotime( $last_processed_at ) : false;
		$last_received          = '' !== $last_received_at ? strtotime( $last_received_at ) : false;
		$minutes_since          = false !== $last_processed ? max( 0, (int) \floor( ( $now->getTimestamp() - $last_processed ) / MINUTE_IN_SECONDS ) ) : null;
		$processing_lag         = false !== $last_received && false !== $last_processed ? max( 0, $last_received - $last_processed ) : null;
		$cron_scheduled         = false !== wp_next_scheduled( 'ppla_sync_buffer_cron' );
		$exclusion_reasons      = $this->get_viewer_exclusion_reasons();
		$viewer_excluded        = array() !== $exclusion_reasons;
		$attention              = array();
		$status                 = 'ready';
		$reason                 = 'data_current';

		if ( '' === $last_received_at && $viewer_excluded ) {
			$status = 'excluded';
			$reason = 'viewer_excluded';
		} elseif ( '' === $last_received_at ) {
			$status = 'waiting';
			$reason = 'no_data_yet';
		} elseif ( '' === $last_processed_at && $pending_hits > 0 ) {
			$status = 'processing';
			$reason = 'buffer_pending';
		} elseif ( ! $cron_scheduled ) {
			$status = 'attention';
			$reason = 'queue_not_scheduled';
		} elseif ( $pending_hits > 0 ) {
			$status = 'processing';
			$reason = 'buffer_pending';
		} elseif ( null !== $minutes_since && $minutes_since > ( 24 * 60 ) ) {
			$status = 'stale';
			$reason = 'data_stale';
		}

		if ( 'waiting' === $status || 'excluded' === $status || 'attention' === $status || 'stale' === $status ) {
			$attention[] = array(
				'id'     => 'ppla_measurement_check',
				'kind'   => 'measurement',
				'label'  => 'test_measurement',
				'target' => 'general',
			);
		}
		if ( 'excluded' === $status ) {
			$attention[] = array(
				'id'     => 'ppla_viewer_excluded',
				'kind'   => 'privacy',
				'label'  => 'viewer_excluded',
				'target' => 'settings',
			);
		}
		if ( $pending_hits > 0 ) {
			$attention[] = array(
				'id'     => 'ppla_buffer_processing',
				'kind'   => 'processing',
				'label'  => 'buffer_pending',
				'target' => 'settings',
			);
		}
		if ( ! $cron_scheduled ) {
			$attention[] = array(
				'id'     => 'ppla_cron_schedule',
				'kind'   => 'configuration',
				'label'  => 'queue_not_scheduled',
				'target' => 'settings',
			);
		}

		$status_data = array(
			'status'                      => $status,
			'reason'                      => $reason,
			'privacy_mode'                => $this->get_privacy_mode(),
			'last_received_at'            => $last_received_at,
			'last_received_display'       => $this->get_status_timestamp_display( $last_received_at ),
			'last_processed_at'           => $last_processed_at,
			'last_processed_display'      => $this->get_status_timestamp_display( $last_processed_at ),
			'last_report_visible_at'      => $last_report_visible_at,
			'last_report_visible_display' => $this->get_status_timestamp_display( $last_report_visible_at ),
			'last_pageview_at'            => $last_pageview_at,
			'oldest_pending_at'           => $oldest_pending_at,
			'pending_hits'                => $pending_hits,
			'minutes_since_data'          => $minutes_since,
			'processing_lag_seconds'      => $processing_lag,
			'cron_scheduled'              => $cron_scheduled,
			'storage_ready'               => true,
			'viewer_excluded'             => $viewer_excluded,
			'exclusion_reasons'           => $exclusion_reasons,
			'privacy_effects'             => $this->get_privacy_effects(),
			'needs_attention'             => $attention,
			'next_action'                 => 'queue_not_scheduled' === $reason ? 'open_maintenance' : ( 'viewer_excluded' === $reason ? 'review_exclusions' : 'test_measurement' ),
		);

		return $status_data;
	}

	/**
	 * Formats one storage timestamp in the WordPress site timezone for the UI.
	 *
	 * The raw status fields remain available for programmatic consumers. A local
	 * database timestamp has no offset, so a browser alone cannot reliably turn
	 * it into the configured WordPress time when administrator and site zones
	 * differ.
	 *
	 * @param string $timestamp MySQL timestamp stored in the site timezone.
	 * @return string Localized display value or an empty string.
	 */
	private function get_status_timestamp_display( string $timestamp ): string {
		if ( '' === $timestamp ) {
			return '';
		}

		try {
			$date = new \DateTimeImmutable( $timestamp, \wp_timezone() );
		} catch ( \Exception $exception ) {
			return '';
		}

		return (string) \wp_date(
			(string) \get_option( 'date_format' ) . ' ' . (string) \get_option( 'time_format' ),
			$date->getTimestamp(),
			\wp_timezone()
		);
	}

	/**
	 * Returns privacy-safe operational metadata shared by report endpoints.
	 *
	 * @param int $range Number of days represented by the report.
	 * @return array<string, mixed>
	 */
	public function get_measurement_context( int $range = 30 ): array {
		$status = $this->get_dashboard_status();

		return array(
			'measurement_status'          => isset( $status['status'] ) ? (string) $status['status'] : 'ready',
			'measurement_reason'          => isset( $status['reason'] ) ? (string) $status['reason'] : 'data_current',
			'measurement_viewer_excluded' => ! empty( $status['viewer_excluded'] ),
			'measurement_pending_hits'    => isset( $status['pending_hits'] ) ? (int) $status['pending_hits'] : 0,
			'privacy_mode'                => $this->get_privacy_mode(),
			'privacy_changes'             => $this->privacy_history->get_changes_in_range( $range ),
		);
	}

	/**
	 * Checks whether the Core tables needed for the Overview status exist.
	 *
	 * @param array<int, string> $tables Table names.
	 * @return bool Whether every required table exists.
	 */
	private function status_tables_exist( array $tables ): bool {
		global $wpdb;

		foreach ( $tables as $table ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$found = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table ) ) );
			if ( $table !== $found ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Returns the newest timestamp from a small, already-sanitized set.
	 *
	 * @param array<int, string> $timestamps Candidate database timestamps.
	 * @return string Newest timestamp or an empty string.
	 */
	private function latest_status_timestamp( array $timestamps ): string {
		$latest = '';

		foreach ( $timestamps as $timestamp ) {
			if ( '' === $timestamp || ( '' !== $latest && strtotime( $timestamp ) <= strtotime( $latest ) ) ) {
				continue;
			}

			$latest = $timestamp;
		}

		return $latest;
	}

	/**
	 * Returns privacy-safe reasons why the current administrator preview is excluded.
	 *
	 * @return array<int, string> Exclusion labels, never an address or user payload.
	 */
	private function get_viewer_exclusion_reasons(): array {
		$settings = get_option( 'ppla_settings', array() );
		$settings = is_array( $settings ) ? $settings : array();
		$reasons  = array();

		if ( ! is_user_logged_in() ) {
			return $reasons;
		}

		if ( ! empty( $settings['ignore_admins'] ) && current_user_can( 'manage_options' ) ) {
			$reasons[] = 'administrator';
		}
		if ( ! empty( $settings['ignore_editors'] ) && current_user_can( 'edit_others_posts' ) && ! current_user_can( 'manage_options' ) ) {
			$reasons[] = 'editor';
		}
		if ( ! empty( $settings['ignore_authors'] ) && current_user_can( 'publish_posts' ) && ! current_user_can( 'edit_others_posts' ) ) {
			$reasons[] = 'author';
		}

		return $reasons;
	}

	/**
	 * Lists the visitor filters that currently remove traffic from reports.
	 *
	 * @return array{active_filters: list<string>} Active filters for the admin UI.
	 */
	private function get_privacy_effects(): array {
		$settings = get_option( 'ppla_settings', array() );
		$settings = is_array( $settings ) ? $settings : array();
		$filters  = array();

		if ( ! empty( $settings['filter_bots'] ) ) {
			$filters[] = 'bots';
		}
		if ( ! empty( $settings['ignore_admins'] ) ) {
			$filters[] = 'administrators';
		}
		if ( ! empty( $settings['ignore_editors'] ) ) {
			$filters[] = 'editors';
		}
		if ( ! empty( $settings['ignore_authors'] ) ) {
			$filters[] = 'authors';
		}
		if ( ! empty( $settings['excluded_ips'] ) ) {
			$filters[] = 'excluded_ips';
		}
		if ( ! empty( $settings['excluded_urls'] ) ) {
			$filters[] = 'excluded_urls';
		}

		return array( 'active_filters' => $filters );
	}

	/**
	 * Retrieves aggregated daily traffic.
	 *
	 * @param int $days Number of past days.
	 * @return array<int, array{date: string, date_iso: string, visits: int, pageviews: int}>
	 */
	public function get_daily_traffic( int $days ): array {
		global $wpdb;

		$version        = \get_option( 'ppla_stats_version', '1' );
		$privacy_mode   = $this->get_privacy_mode();
		$scope          = $this->get_pageview_scope_condition();
		$ppla_cache_key = 'ppla_daily_traffic_v4_' . $days . '_' . ReportClock::period_start( $days ) . '_' . $privacy_mode . '_' . \md5( (string) \wp_json_encode( $scope['params'] ) ) . '_' . $version;
		$cached         = \wp_cache_get( $ppla_cache_key, self::CACHE_GROUP );

		if ( false !== $cached && \is_array( $cached ) ) {
			/**
			 * Cached results.
			 *
			 * @var array<int, array{date: string, date_iso: string, visits: int, pageviews: int}> $cached
			 */
			return $cached;
		}

		$pageviews_table = $wpdb->prefix . 'ppla_pageviews';

		$now            = \current_datetime();
		$start_date_str = ReportClock::period_start( $days );
		$end_date_str   = $now->format( 'Y-m-d H:i:s' );

		if ( 'strict_anonymous' === $privacy_mode ) {
			$raw_visits = array();
		} else {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
			$raw_visits = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT DATE(created_at) as log_date, COUNT(DISTINCT session_id) as total_visits FROM %i WHERE session_id > 0 AND created_at >= %s AND created_at <= %s' . $scope['sql'] . ' GROUP BY DATE(created_at)',
					$pageviews_table,
					...\array_merge( array( $start_date_str, $end_date_str ), $scope['params'] )
				),
				ARRAY_A
			);
			// phpcs:enable
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
		$raw_pageviews = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT DATE(created_at) as log_date, COUNT(id) as total_pageviews FROM %i WHERE created_at >= %s AND created_at <= %s' . $scope['sql'] . ' GROUP BY DATE(created_at)',
				$pageviews_table,
				...\array_merge( array( $start_date_str, $end_date_str ), $scope['params'] )
			),
			ARRAY_A
		);
		// phpcs:enable

		$pageviews_map  = \array_column( \is_array( $raw_pageviews ) ? $raw_pageviews : array(), 'total_pageviews', 'log_date' );
		$visits_map     = 'strict_anonymous' === $privacy_mode ? $pageviews_map : \array_column( \is_array( $raw_visits ) ? $raw_visits : array(), 'total_visits', 'log_date' );
		$observed_dates = \array_merge( \array_keys( $visits_map ), \array_keys( $pageviews_map ) );
		sort( $observed_dates, \SORT_STRING );

		if ( empty( $observed_dates ) ) {
			\wp_cache_set( $ppla_cache_key, array(), self::CACHE_GROUP, HOUR_IN_SECONDS );

			return array();
		}

		$first_date = \DateTimeImmutable::createFromFormat( '!Y-m-d', (string) $observed_dates[0], $now->getTimezone() );
		$today_date = $now->setTime( 0, 0, 0 );

		if ( false === $first_date || $first_date > $today_date ) {
			\wp_cache_set( $ppla_cache_key, array(), self::CACHE_GROUP, HOUR_IN_SECONDS );

			return array();
		}

		$timeline = array();

		for ( $target_date = $first_date; $target_date <= $today_date; $target_date = $target_date->modify( '+1 day' ) ) {
			$date_str    = $target_date->format( 'Y-m-d' );
			$display_str = $target_date->format( 'd.m' );

			$timeline[] = array(
				'date'      => $display_str,
				'date_iso'  => $date_str,
				'visits'    => isset( $visits_map[ $date_str ] ) ? (int) $visits_map[ $date_str ] : 0,
				'pageviews' => isset( $pageviews_map[ $date_str ] ) ? (int) $pageviews_map[ $date_str ] : 0,
			);
		}

		\wp_cache_set( $ppla_cache_key, $timeline, self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $timeline;
	}

	/**
	 * Retrieves breakdown of sessions by device types.
	 *
	 * @param int $days Number of past days.
	 * @return array{desktop: int, mobile: int, tablet: int}
	 */
	public function get_devices_share( int $days ): array {
		global $wpdb;

		$version        = \get_option( 'ppla_stats_version', '1' );
		$privacy_mode   = $this->get_privacy_mode();
		$scope          = $this->get_pageview_scope_condition();
		$ppla_cache_key = 'ppla_devices_share_v2_' . $days . '_' . ReportClock::period_start( $days ) . '_' . $privacy_mode . '_' . \md5( (string) \wp_json_encode( $scope['params'] ) ) . '_' . $version;
		$cached         = \wp_cache_get( $ppla_cache_key, self::CACHE_GROUP );

		if ( false !== $cached && \is_array( $cached ) ) {
			/**
			 * Cached results.
			 *
			 * @var array{desktop: int, mobile: int, tablet: int} $cached
			 */
			return $cached;
		}

		$pageviews_table = $wpdb->prefix . 'ppla_pageviews';

		// Visits are counted per session; strict mode has no sessions, so each pageview counts.
		$count_sql = 'strict_anonymous' === $privacy_mode ? 'COUNT(id)' : 'COUNT(DISTINCT session_id)';
		$visit_sql = 'strict_anonymous' === $privacy_mode ? '' : ' AND session_id > 0';

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
		$raw_data = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT device_type, ' . $count_sql . ' as total FROM %i WHERE created_at >= %s' . $visit_sql . $scope['sql'] . ' GROUP BY device_type',
				$pageviews_table,
				...\array_merge( array( ReportClock::period_start( $days ) ), $scope['params'] )
			),
			ARRAY_A
		);
		// phpcs:enable

		$shares = array(
			'desktop' => 0,
			'mobile'  => 0,
			'tablet'  => 0,
		);

		if ( \is_array( $raw_data ) ) {
			foreach ( $raw_data as $row ) {
				$type = ! empty( $row['device_type'] ) ? $row['device_type'] : 'desktop';
				if ( \array_key_exists( $type, $shares ) ) {
					$shares[ $type ] = (int) $row['total'];
				}
			}
		}

		\wp_cache_set( $ppla_cache_key, $shares, self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $shares;
	}

	/**
	 * Retrieves paginated top pages by pageviews.
	 *
	 * @param int                  $days Number of days to look back.
	 * @param array<string, mixed> $args Pagination, sorting, and search arguments.
	 * @return array{items: array<int, array{url: string, title: string, views: int, percentage: float, bounce_rate: float, avg_time: int, previous_period?: array{views: int, percentage: float}}>, total_items: int}
	 */
	public function get_top_pages( int $days = 30, array $args = array() ): array {
		global $wpdb;

		$version        = \get_option( 'ppla_stats_version', '1' );
		$privacy_mode   = $this->get_privacy_mode();
		$scope          = $this->get_pageview_scope_condition();
		$comparison     = 'previous_period' === ( $args['comparison'] ?? '' );
		$ppla_cache_key = 'ppla_top_pages_v2_' . $days . '_' . ReportClock::period_start( $days ) . '_' . $privacy_mode . '_' . \md5( (string) \wp_json_encode( array( $args, $scope['params'] ) ) ) . '_' . $version;

		$cached = \wp_cache_get( $ppla_cache_key, self::CACHE_GROUP );

		if ( false !== $cached && \is_array( $cached ) ) {
			/**
			 * Cached results.
			 *
			 * @var array{items: array<int, array{url: string, title: string, views: int, percentage: float, bounce_rate: float, avg_time: int, previous_period?: array{views: int, percentage: float}}>, total_items: int} $cached
			 */
			return $cached;
		}

		$table         = $wpdb->prefix . 'ppla_pageviews';
		$since         = ReportClock::period_start( $days );
		$search        = ! empty( $args['search'] ) ? $wpdb->esc_like( $args['search'] ) : '';
		$filter_page   = ! empty( $args['filter_page'] ) ? UrlPath::encode( (string) $args['filter_page'] ) : '';
		$filter_sql    = '' === $filter_page ? '' : ' AND url = %s';
		$filter_params = '' === $filter_page ? array() : array( $filter_page );

		$per_page = isset( $args['per_page'] ) ? (int) $args['per_page'] : 10;
		$page     = isset( $args['page'] ) ? (int) $args['page'] : 1;
		$offset   = ( $page - 1 ) * $per_page;
		$orderby  = isset( $args['orderby'] ) && 'url' === $args['orderby'] ? 'url' : 'views';
		$order    = isset( $args['order'] ) && 'asc' === \strtolower( (string) $args['order'] ) ? 'ASC' : 'DESC';

		$total_views  = 0;
		$total_groups = 0;
		$results      = array();

		if ( '' !== $search ) {
			$like = '%' . $search . '%';

			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
			$total_views = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(id) FROM %i WHERE created_at >= %s AND url LIKE %s' . $filter_sql . $scope['sql'], $table, ...\array_merge( array( $since, $like ), $filter_params, $scope['params'] ) ) );
			// phpcs:enable

			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
			$total_groups = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(DISTINCT url) FROM %i WHERE created_at >= %s AND url LIKE %s' . $filter_sql . $scope['sql'], $table, ...\array_merge( array( $since, $like ), $filter_params, $scope['params'] ) ) );
			// phpcs:enable

			if ( 'ASC' === $order ) {
				// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
				$results = $wpdb->get_results(
					$wpdb->prepare(
						'SELECT url, COUNT(id) as views FROM %i WHERE created_at >= %s AND url LIKE %s' . $filter_sql . $scope['sql'] . ' GROUP BY url ORDER BY %i ASC LIMIT %d OFFSET %d',
						$table,
						...\array_merge( array( $since, $like ), $filter_params, $scope['params'], array( $orderby, $per_page, $offset ) )
					),
					ARRAY_A
				);
				// phpcs:enable
			} else {
				// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
				$results = $wpdb->get_results(
					$wpdb->prepare(
						'SELECT url, COUNT(id) as views FROM %i WHERE created_at >= %s AND url LIKE %s' . $filter_sql . $scope['sql'] . ' GROUP BY url ORDER BY %i DESC LIMIT %d OFFSET %d',
						$table,
						...\array_merge( array( $since, $like ), $filter_params, $scope['params'], array( $orderby, $per_page, $offset ) )
					),
					ARRAY_A
				);
				// phpcs:enable
			}
		} else {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
			$total_views = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(id) FROM %i WHERE created_at >= %s' . $filter_sql . $scope['sql'], $table, ...\array_merge( array( $since ), $filter_params, $scope['params'] ) ) );
			// phpcs:enable

			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
			$total_groups = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(DISTINCT url) FROM %i WHERE created_at >= %s' . $filter_sql . $scope['sql'], $table, ...\array_merge( array( $since ), $filter_params, $scope['params'] ) ) );
			// phpcs:enable

			if ( 'ASC' === $order ) {
				// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
				$results = $wpdb->get_results(
					$wpdb->prepare(
						'SELECT url, COUNT(id) as views FROM %i WHERE created_at >= %s' . $filter_sql . $scope['sql'] . ' GROUP BY url ORDER BY %i ASC LIMIT %d OFFSET %d',
						$table,
						...\array_merge( array( $since ), $filter_params, $scope['params'], array( $orderby, $per_page, $offset ) )
					),
					ARRAY_A
				);
				// phpcs:enable
			} else {
				// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
				$results = $wpdb->get_results(
					$wpdb->prepare(
						'SELECT url, COUNT(id) as views FROM %i WHERE created_at >= %s' . $filter_sql . $scope['sql'] . ' GROUP BY url ORDER BY %i DESC LIMIT %d OFFSET %d',
						$table,
						...\array_merge( array( $since ), $filter_params, $scope['params'], array( $orderby, $per_page, $offset ) )
					),
					ARRAY_A
				);
				// phpcs:enable
			}
		}

		$data = array();

		if ( \is_array( $results ) && ! empty( $results ) ) {
			$urls         = \array_column( $results, 'url' );
			$placeholders = \implode( ',', \array_fill( 0, \count( $urls ), '%s' ) );

			$metrics_map  = array();
			$avg_time_map = array();

			if ( 'strict_anonymous' !== $privacy_mode ) {
				$query_metrics = 'SELECT p.url,
					SUM(CASE WHEN s.cnt = 1 THEN 1 ELSE 0 END) as bounces,
					COUNT(s.session_id) as entrances
				FROM %i p
				INNER JOIN (
					SELECT session_id, MIN(id) as first_id, COUNT(id) as cnt
					FROM %i
					WHERE session_id > 0 AND created_at >= %s
					GROUP BY session_id
				) s ON p.id = s.first_id
				WHERE p.url IN (' . $placeholders . ')
				GROUP BY p.url';

				$metrics_prepare_args = \array_merge( array( $table, $table, $since ), $urls );

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
				$metrics_results = $wpdb->get_results( $wpdb->prepare( $query_metrics, $metrics_prepare_args ), ARRAY_A );

				if ( \is_array( $metrics_results ) ) {
					foreach ( $metrics_results as $row ) {
						$metrics_map[ $row['url'] ] = array(
							'entrances' => (int) $row['entrances'],
							'bounces'   => (int) $row['bounces'],
						);
					}
				}

				$query_avg_time = 'SELECT p1.url, AVG(TIMESTAMPDIFF(SECOND, p1.created_at, p2.created_at)) as avg_time
				FROM %i p1
				INNER JOIN %i p2 ON p1.session_id = p2.session_id
					AND p2.id = (
						SELECT MIN(id) FROM %i p3 WHERE p3.session_id = p1.session_id AND p3.id > p1.id
				)
				WHERE p1.session_id > 0 AND p1.url IN (' . $placeholders . ') AND p1.created_at >= %s
				GROUP BY p1.url';

				$avg_time_prepare_args = \array_merge( array( $table, $table, $table ), $urls, array( $since ) );

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
				$avg_time_results = $wpdb->get_results( $wpdb->prepare( $query_avg_time, $avg_time_prepare_args ), ARRAY_A );

				if ( \is_array( $avg_time_results ) ) {
					foreach ( $avg_time_results as $row ) {
						$avg_time_map[ $row['url'] ] = (int) $row['avg_time'];
					}
				}
			}

			foreach ( $results as $row ) {
				$views = (int) $row['views'];
				$url   = (string) $row['url'];

				$entrances   = isset( $metrics_map[ $url ]['entrances'] ) ? $metrics_map[ $url ]['entrances'] : 0;
				$bounces     = isset( $metrics_map[ $url ]['bounces'] ) ? $metrics_map[ $url ]['bounces'] : 0;
				$bounce_rate = $entrances > 0 ? \round( ( $bounces / $entrances ) * 100, 1 ) : 0.0;
				$avg_time    = isset( $avg_time_map[ $url ] ) ? $avg_time_map[ $url ] : 0;

				$page_title = $url;

				if ( '/' === $url || '' === $url ) {
					$page_title = \__( 'Home Page', 'primeplaced-logless-analytics' );
				} else {
					$full_url = \site_url( $url );
					$post_id  = \url_to_postid( $full_url );

					if ( $post_id > 0 ) {
						$resolved_title = \get_the_title( $post_id );

						if ( ! empty( $resolved_title ) ) {
							$page_title = $resolved_title;
						}
					}
				}

				$data[] = array(
					'url'         => $url,
					'title'       => $page_title,
					'views'       => $views,
					'percentage'  => $total_views > 0 ? \round( ( $views / $total_views ) * 100, 1 ) : 0.0,
					'bounce_rate' => $bounce_rate,
					'avg_time'    => $avg_time,
				);
			}
		}

		if ( $comparison && ! empty( $data ) ) {
			$prior_conditions = 'created_at >= %s AND created_at < %s';
			$prior_parameters = array( $table, ReportClock::period_start( $days * 2 ), $since );

			if ( '' !== $search ) {
				$prior_conditions  .= ' AND url LIKE %s';
				$prior_parameters[] = '%' . $search . '%';
			}

			if ( '' !== $filter_page ) {
				$prior_conditions  .= ' AND url = %s';
				$prior_parameters[] = $filter_page;
			}

			$prior_denominator_query = "SELECT COUNT(id) FROM %i WHERE {$prior_conditions}" . $scope['sql'];
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
			$prior_denominator = (int) $wpdb->get_var(
				$wpdb->prepare(
					$prior_denominator_query,
					...array_merge( $prior_parameters, $scope['params'] )
				)
			);
			// phpcs:enable

			$current_urls          = array_column( $data, 'url' );
			$url_placeholders      = implode( ',', array_fill( 0, count( $current_urls ), '%s' ) );
			$prior_rows_query      = "SELECT url, COUNT(id) as views FROM %i WHERE {$prior_conditions} AND url IN ({$url_placeholders})" . $scope['sql'] . ' GROUP BY url';
			$prior_rows_parameters = array_merge( $prior_parameters, $current_urls, $scope['params'] );

			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
			$prior_rows = $wpdb->get_results(
				$wpdb->prepare( $prior_rows_query, $prior_rows_parameters ),
				ARRAY_A
			);
			// phpcs:enable
			$prior_views = array();

			if ( is_array( $prior_rows ) ) {
				foreach ( $prior_rows as $prior_row ) {
					$prior_views[ (string) $prior_row['url'] ] = (int) $prior_row['views'];
				}
			}

			foreach ( $data as &$row ) {
				$url                    = (string) $row['url'];
				$row_prior_views        = $prior_views[ $url ] ?? 0;
				$row['previous_period'] = array(
					'views'      => $row_prior_views,
					'percentage' => $prior_denominator > 0 ? round( ( $row_prior_views / $prior_denominator ) * 100, 1 ) : 0.0,
				);
			}
			unset( $row );
		}

		$output = array(
			'items'       => $data,
			'total_items' => $total_groups,
		);

		\wp_cache_set( $ppla_cache_key, $output, self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $output;
	}

	/**
	 * Retrieves paginated top traffic sources (referrers).
	 *
	 * @param int                  $days Number of days to look back.
	 * @param array<string, mixed> $args Pagination, sorting, and search arguments.
	 * @return array{items: array<int, array{source: string, visits: int, percentage: float, previous_period?: array{visits: int, percentage: float}}>, total_items: int, summary: int}
	 */
	public function get_top_referrers( int $days = 30, array $args = array() ): array {
		global $wpdb;

		$version        = \get_option( 'ppla_stats_version', '1' );
		$privacy_mode   = $this->get_privacy_mode();
		$scope          = $this->get_pageview_scope_condition();
		$ppla_cache_key = 'ppla_top_refs_full_' . $days . '_' . ReportClock::period_start( $days ) . '_' .
			$privacy_mode . '_' . \md5( (string) \wp_json_encode( array( $args, $scope['params'] ) ) ) . '_' . $version;
		$cached         = \wp_cache_get( $ppla_cache_key, self::CACHE_GROUP );

		if ( false !== $cached && \is_array( $cached ) ) {
			/**
			 * Cached results.
			 *
			 * @var array{items: array<int, array{source: string, visits: int, percentage: float}>, total_items: int, summary: int} $cached
			 */
			return $cached;
		}

		$table                 = $wpdb->prefix . 'ppla_pageviews';
		$search                = ! empty( $args['search'] ) ? \strtolower( \sanitize_text_field( $args['search'] ) ) : '';
		$search                = \str_replace( array( 'google ads', 'meta ads' ), array( 'google_ads', 'meta_ads' ), $search );
		$filter_source         = ! empty( $args['filter_source'] ) ? \strtolower( \sanitize_text_field( (string) $args['filter_source'] ) ) : '';
		$period_offset         = isset( $args['period_offset'] ) ? \max( 0, (int) $args['period_offset'] ) : 0;
		$period_start          = $days * ( $period_offset + 1 );
		$period_end            = $days * $period_offset;
		$period_end_condition  = 0 === $period_offset ? '' : ' AND created_at < %s';
		$period_parameters     = 0 === $period_offset ? array( ReportClock::period_start( $period_start ) ) : array( ReportClock::period_start( $period_start ), ReportClock::period_end( $period_end ) );
		$site_url              = \get_option( 'home' );
		$site_host             = \is_string( $site_url ) ? \wp_parse_url( $site_url, PHP_URL_HOST ) : '';
		$site_host             = \is_string( $site_host ) ? \strtolower( \preg_replace( '/^www\./', '', $site_host ) ?? '' ) : '';
		$raw_referrer_host_sql = "LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(referrer, '://', -1), '/', 1), ':', 1))";
		$referrer_host_sql     = "LOWER(CASE WHEN {$raw_referrer_host_sql} LIKE 'www.%' THEN SUBSTRING({$raw_referrer_host_sql}, 5) ELSE {$raw_referrer_host_sql} END)";
		$referrer_source_sql   = '' === $site_host
			? "CASE WHEN acquisition_channel IN ('google_ads','meta_ads') THEN acquisition_channel WHEN referrer = '' THEN 'direct' ELSE {$referrer_host_sql} END"
			: "CASE WHEN acquisition_channel IN ('google_ads','meta_ads') THEN acquisition_channel WHEN referrer = '' OR {$referrer_host_sql} = %s THEN 'direct' ELSE {$referrer_host_sql} END";
		$search_sql            = '';
		$search_params         = array();
		$filter_sql            = '';
		$filter_params         = array();

		if ( '' !== $search ) {
			$search_sql = " AND {$referrer_source_sql} LIKE %s";
			if ( '' !== $site_host ) {
				$search_params[] = $site_host;
			}
			$search_params[] = '%' . $wpdb->esc_like( $search ) . '%';
		}

		if ( '' !== $filter_source ) {
			if ( 'direct' === $filter_source ) {
				$filter_sql    = ' AND (acquisition_channel = %s AND (referrer = %s';
				$filter_params = array( '', '' );

				if ( '' !== $site_host ) {
					$filter_sql     .= " OR {$referrer_host_sql} = %s";
					$filter_params[] = $site_host;
				}

				$filter_sql .= ')';
				$filter_sql .= ')';
			} elseif ( \in_array( $filter_source, array( 'google_ads', 'meta_ads' ), true ) ) {
				$filter_sql    = ' AND acquisition_channel = %s';
				$filter_params = array( $filter_source );
			} else {
				$filter_sql    = " AND acquisition_channel = %s AND {$referrer_host_sql} = %s";
				$filter_params = array( '', $filter_source );
			}
		}

		if ( 'strict_anonymous' === $privacy_mode ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
			$raw_results = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT ' . $referrer_source_sql . ' AS source, COUNT(id) as visits FROM %i WHERE created_at >= %s' . $period_end_condition . $search_sql . $filter_sql . $scope['sql'] . ' GROUP BY ' . $referrer_source_sql,
					...\array_merge( '' !== $site_host ? array( $site_host ) : array(), array( $table ), $period_parameters, $search_params, $filter_params, $scope['params'], '' !== $site_host ? array( $site_host ) : array() )
				),
				ARRAY_A
			);
			// phpcs:enable
		} else {
			$non_strict_source_sql = \str_replace( array( 'acquisition_channel', 'referrer' ), array( 'p.acquisition_channel', 'p.referrer' ), $referrer_source_sql );
			$non_strict_search_sql = \str_replace( array( 'acquisition_channel', 'referrer' ), array( 'p.acquisition_channel', 'p.referrer' ), $search_sql );
			$non_strict_filter_sql = \str_replace( array( 'acquisition_channel', 'referrer' ), array( 'p.acquisition_channel', 'p.referrer' ), $filter_sql );
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
			$raw_results = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT ' . $non_strict_source_sql . ' AS source, COUNT(p.session_id) as visits
					 FROM %i p
					 INNER JOIN (
						SELECT session_id, MIN(id) as first_hit_id 
						FROM %i
						WHERE session_id > 0 AND created_at >= %s' . $period_end_condition . $scope['sql'] . '
						GROUP BY session_id
					 ) as first_hits ON p.id = first_hits.first_hit_id' . $non_strict_search_sql . $non_strict_filter_sql . '
					 GROUP BY ' . $non_strict_source_sql,
					...\array_merge( '' !== $site_host ? array( $site_host ) : array(), array( $table, $table ), $period_parameters, $scope['params'], $search_params, $filter_params, '' !== $site_host ? array( $site_host ) : array() )
				),
				ARRAY_A
			);
			// phpcs:enable
		}

		$grouped      = array();
		$total_visits = 0;

		if ( \is_array( $raw_results ) ) {
			foreach ( $raw_results as $row ) {
				$source = isset( $row['source'] ) ? (string) $row['source'] : '';
				$visits = (int) $row['visits'];
				$host   = '' !== $source ? $source : 'direct';

				if ( ! isset( $grouped[ $host ] ) ) {
					$grouped[ $host ] = 0;
				}

				$grouped[ $host ] += $visits;
				$total_visits     += $visits;
			}
		}

		$data = array();

		foreach ( $grouped as $source => $visits ) {
			$data[] = array(
				'source'     => (string) $source,
				'visits'     => $visits,
				'percentage' => $total_visits > 0 ? \round( ( $visits / $total_visits ) * 100, 1 ) : 0.0,
			);
		}

		$orderby = isset( $args['orderby'] ) && 'source' === $args['orderby'] ? 'source' : 'visits';
		$order   = isset( $args['order'] ) && 'asc' === \strtolower( $args['order'] ) ? 'ASC' : 'DESC';

		\usort(
			$data,
			function ( $a, $b ) use ( $orderby, $order ) {
				$val_a = $a[ $orderby ];
				$val_b = $b[ $orderby ];

				if ( $val_a === $val_b ) {
					return 0;
				}

				if ( 'ASC' === $order ) {
					return $val_a > $val_b ? 1 : -1;
				}
				return $val_a < $val_b ? 1 : -1;
			}
		);

		$total_groups = \count( $data );

		$per_page = isset( $args['per_page'] ) ? \max( 1, (int) $args['per_page'] ) : 10;
		$page     = isset( $args['page'] ) ? \max( 1, (int) $args['page'] ) : 1;
		$offset   = ( $page - 1 ) * $per_page;

		if ( 'previous_period' === ( $args['comparison'] ?? '' ) && 0 === $period_offset && ! empty( $data ) ) {
			$prior_report  = $this->get_top_referrers(
				$days,
				array_merge(
					$args,
					array(
						'comparison'    => 'none',
						'page'          => 1,
						'per_page'      => \PHP_INT_MAX,
						'period_offset' => 1,
					)
				)
			);
			$prior_visits  = array();
			$prior_summary = isset( $prior_report['summary'] ) ? (int) $prior_report['summary'] : 0;

			foreach ( $prior_report['items'] as $prior_row ) {
				$prior_visits[ (string) $prior_row['source'] ] = (int) $prior_row['visits'];
			}

			foreach ( $data as &$row ) {
				$source                 = (string) $row['source'];
				$row_prior_visits       = $prior_visits[ $source ] ?? 0;
				$row['previous_period'] = array(
					'visits'     => $row_prior_visits,
					'percentage' => $prior_summary > 0 ? round( ( $row_prior_visits / $prior_summary ) * 100, 1 ) : 0.0,
				);
			}
			unset( $row );
		}

		$output = array(
			'items'       => \array_slice( $data, $offset, $per_page ),
			'total_items' => $total_groups,
			'summary'     => $total_visits,
		);

		\wp_cache_set( $ppla_cache_key, $output, self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $output;
	}

	/**
	 * Retrieves paginated top 404 errors recorded as system events.
	 *
	 * @param int                  $days Number of days to look back.
	 * @param array<string, mixed> $args Pagination, sorting, and search arguments.
	 * @return array{items: array<int, array{url: string, count: int, previous_period?: array{count: int}}>, total_items: int, summary: int}
	 */
	public function get_top_404_errors( int $days = 30, array $args = array() ): array {
		global $wpdb;

		if ( $this->is_author_scoped() ) {
			return array(
				'items'       => array(),
				'total_items' => 0,
				'summary'     => 0,
			);
		}

		$version        = \get_option( 'ppla_stats_version', '1' );
		$ppla_cache_key = 'ppla_top_404_full_' . $days . '_' . ReportClock::period_start( $days ) . '_' . \md5( (string) \wp_json_encode( $args ) ) . '_' . $version;
		$cached         = \wp_cache_get( $ppla_cache_key, self::CACHE_GROUP );

		if ( false !== $cached && \is_array( $cached ) ) {
			/**
			 * Cached results.
			 *
			 * @var array{items: array<int, array{url: string, count: int}>, total_items: int, summary: int} $cached
			 */
			return $cached;
		}

		$table                = $wpdb->prefix . 'ppla_event_contracts';
		$search               = ! empty( $args['search'] ) ? $wpdb->esc_like( $args['search'] ) : '';
		$filter_page          = ! empty( $args['filter_page'] ) ? UrlPath::encode( (string) $args['filter_page'] ) : '';
		$period_offset        = isset( $args['period_offset'] ) ? \max( 0, (int) $args['period_offset'] ) : 0;
		$period_start         = $days * ( $period_offset + 1 );
		$period_end           = $days * $period_offset;
		$period_end_condition = 0 === $period_offset ? '' : ' AND occurred_at < %s';
		$period_parameters    = 0 === $period_offset ? array( ReportClock::period_start( $period_start ) ) : array( ReportClock::period_start( $period_start ), ReportClock::period_end( $period_end ) );
		$orderby              = isset( $args['orderby'] ) && 'url' === $args['orderby'] ? 'url' : 'count';
		$order                = isset( $args['order'] ) && 'asc' === \strtolower( (string) $args['order'] ) ? 'ASC' : 'DESC';
		$conditions           = "event_type = 'navigation.not_found' AND occurred_at >= %s" . $period_end_condition;
		$parameters           = array( $table, ...$period_parameters );

		if ( '' !== $search ) {
			$conditions  .= ' AND (subject_key LIKE %s OR attributes LIKE %s)';
			$parameters[] = '%' . $search . '%';
			$parameters[] = '%' . $search . '%';
		}

		if ( '' !== $filter_page ) {
			$conditions  .= ' AND subject_key = %s';
			$parameters[] = UrlPath::subject_key( $filter_page );
		}

		$query = "SELECT subject_key as url, MAX(attributes) as attributes, COUNT(id) as count FROM %i WHERE {$conditions} GROUP BY subject_key ORDER BY {$orderby} {$order}";
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
		$results = $wpdb->get_results( $wpdb->prepare( $query, $parameters ), ARRAY_A );
		// phpcs:enable

		$data         = array();
		$total_groups = \is_array( $results ) ? \count( $results ) : 0;

		if ( \is_array( $results ) ) {
			foreach ( $results as $row ) {
				$data[] = array(
					'url'   => UrlPath::from_subject( (string) $row['url'], $row['attributes'] ?? '' ),
					'count' => (int) $row['count'],
				);
			}
		}

		$per_page = isset( $args['per_page'] ) ? \max( 1, (int) $args['per_page'] ) : 10;
		$page     = isset( $args['page'] ) ? \max( 1, (int) $args['page'] ) : 1;
		$offset   = ( $page - 1 ) * $per_page;
		$summary  = \array_sum( \array_column( $data, 'count' ) );

		if ( 'previous_period' === ( $args['comparison'] ?? '' ) && 0 === $period_offset && ! empty( $data ) ) {
			$prior_report = $this->get_top_404_errors(
				$days,
				array_merge(
					$args,
					array(
						'comparison'    => 'none',
						'page'          => 1,
						'per_page'      => \PHP_INT_MAX,
						'period_offset' => 1,
					)
				)
			);
			$prior_counts = array();

			foreach ( $prior_report['items'] as $prior_row ) {
				$prior_counts[ (string) $prior_row['url'] ] = (int) $prior_row['count'];
			}

			foreach ( $data as &$row ) {
				$url                    = (string) $row['url'];
				$row['previous_period'] = array(
					'count' => $prior_counts[ $url ] ?? 0,
				);
			}
			unset( $row );
		}

		$output = array(
			'items'       => \array_slice( $data, $offset, $per_page ),
			'total_items' => $total_groups,
			'summary'     => $summary,
		);

		\wp_cache_set( $ppla_cache_key, $output, self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $output;
	}

	/**
	 * Calculates the selected Source report's aggregate metric.
	 *
	 * @param string              $report_type   `pages`, `referrers` or `404-errors`.
	 * @param int                 $days          Number of days in each reporting period.
	 * @param array<string,mixed> $args          Active search and named-filter arguments.
	 * @param int                 $period_offset Zero for the main period; one for the preceding period.
	 */
	public function get_source_summary( string $report_type, int $days, array $args = array(), int $period_offset = 0 ): int {
		if ( 'pages' === $report_type ) {
			return $this->get_pageviews_source_summary( $days, $args, $period_offset );
		}

		$summary_args = \array_merge(
			$args,
			array(
				'comparison'    => 'none',
				'page'          => 1,
				'per_page'      => \PHP_INT_MAX,
				'period_offset' => $period_offset,
			)
		);

		if ( 'referrers' === $report_type ) {
			$report = $this->get_top_referrers( $days, $summary_args );

			return isset( $report['summary'] ) ? (int) $report['summary'] : 0;
		}

		if ( '404-errors' === $report_type ) {
			$report = $this->get_top_404_errors( $days, $summary_args );

			return isset( $report['summary'] ) ? (int) $report['summary'] : 0;
		}

		return 0;
	}

	/**
	 * Lists the available exact filter values for a selected Source report.
	 *
	 * @param string $report_type `pages`, `referrers` or `404-errors`.
	 * @param int    $days        Number of days to look back.
	 * @param string $selected    Selected value retained when it has no current rows.
	 * @return array<int,array{value:string,label:string}> Safe current-period options.
	 */
	public function get_source_filter_options( string $report_type, int $days, string $selected = '' ): array {
		if ( 'pages' === $report_type ) {
			return $this->get_page_source_filter_options( $days, $selected );
		}

		if ( 'referrers' === $report_type ) {
			$report = $this->get_top_referrers(
				$days,
				array(
					'page'     => 1,
					'per_page' => \PHP_INT_MAX,
				)
			);
			$values = \array_map(
				static function ( array $item ): string {
						return (string) $item['source'];
				},
				$report['items']
			);

			return $this->format_source_filter_options( $values, $selected );
		}

		if ( '404-errors' === $report_type ) {
			$report = $this->get_top_404_errors(
				$days,
				array(
					'page'     => 1,
					'per_page' => \PHP_INT_MAX,
				)
			);
			$values = \array_map(
				static function ( array $item ): string {
						return (string) $item['url'];
				},
				$report['items']
			);

			return $this->format_source_filter_options( $values, $selected );
		}

		return array();
	}

	/**
	 * Counts pageviews matching a Source pages query in one equal-length period.
	 *
	 * @param int                 $days          Number of days in each reporting period.
	 * @param array<string,mixed> $args          Active search and named-filter arguments.
	 * @param int                 $period_offset Zero for the main period; one for the preceding period.
	 */
	private function get_pageviews_source_summary( int $days, array $args, int $period_offset ): int {
		global $wpdb;

		$version        = \get_option( 'ppla_stats_version', '1' );
		$table          = $wpdb->prefix . 'ppla_pageviews';
		$scope          = $this->get_pageview_scope_condition();
		$ppla_cache_key = 'ppla_source_pages_summary_' . $days . '_' . ReportClock::period_start( $days ) . '_' . $period_offset . '_' . \md5( (string) \wp_json_encode( array( $args, $scope['params'] ) ) ) . '_' . $version;
		$cached         = \wp_cache_get( $ppla_cache_key, self::CACHE_GROUP );

		if ( false !== $cached ) {
			return (int) $cached;
		}

		$search        = ! empty( $args['search'] ) ? $wpdb->esc_like( (string) $args['search'] ) : '';
		$filter_page   = ! empty( $args['filter_page'] ) ? UrlPath::encode( (string) $args['filter_page'] ) : '';
		$period_offset = \max( 0, $period_offset );
		$period_start  = $days * ( $period_offset + 1 );
		$period_end    = $days * $period_offset;
		$conditions    = 'created_at >= %s AND created_at < %s';
		$parameters    = array( $table, ReportClock::period_start( $period_start ), ReportClock::period_end( $period_end ) );

		if ( '' !== $search ) {
			$conditions  .= ' AND url LIKE %s';
			$parameters[] = '%' . $search . '%';
		}

		if ( '' !== $filter_page ) {
			$conditions  .= ' AND url = %s';
			$parameters[] = $filter_page;
		}

		$query      = "SELECT COUNT(id) FROM %i WHERE {$conditions}" . $scope['sql'];
		$parameters = \array_merge( $parameters, $scope['params'] );
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
		$summary = (int) $wpdb->get_var( $wpdb->prepare( $query, $parameters ) );
		// phpcs:enable
		\wp_cache_set( $ppla_cache_key, $summary, self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $summary;
	}

	/**
	 * Gets every current-period page path as a safe exact filter option.
	 *
	 * @param int    $days     Number of days to look back.
	 * @param string $selected Selected value retained when it no longer has rows.
	 * @return array<int,array{value:string,label:string}> Current page options.
	 */
	private function get_page_source_filter_options( int $days, string $selected ): array {
		global $wpdb;

		$version        = \get_option( 'ppla_stats_version', '1' );
		$table          = $wpdb->prefix . 'ppla_pageviews';
		$scope          = $this->get_pageview_scope_condition();
		$ppla_cache_key = 'ppla_source_page_options_' . $days . '_' . ReportClock::period_start( $days ) . '_' . \md5( (string) \wp_json_encode( array( $selected, $scope['params'] ) ) ) . '_' . $version;
		$cached         = \wp_cache_get( $ppla_cache_key, self::CACHE_GROUP );

		if ( false !== $cached && \is_array( $cached ) ) {
			return $cached;
		}

		$query      = 'SELECT DISTINCT url FROM %i WHERE created_at >= %s' . $scope['sql'] . ' ORDER BY url ASC';
		$parameters = \array_merge( array( $table, ReportClock::period_start( $days ) ), $scope['params'] );
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
		$results = $wpdb->get_col( $wpdb->prepare( $query, $parameters ) );
		// phpcs:enable
		$values  = \is_array( $results ) ? \array_map( 'strval', $results ) : array();
		$options = $this->format_source_filter_options( $values, $selected );
		\wp_cache_set( $ppla_cache_key, $options, self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $options;
	}

	/**
	 * Produces de-duplicated `{value,label}` exact-filter options.
	 *
	 * @param array<int,string> $values   Candidate option values.
	 * @param string            $selected Selected value retained when absent from candidates.
	 * @return array<int,array{value:string,label:string}> Normalized option list.
	 */
	private function format_source_filter_options( array $values, string $selected ): array {
		$values = \array_values( \array_unique( \array_filter( $values ) ) );
		sort( $values, \SORT_NATURAL | \SORT_FLAG_CASE );

		if ( '' !== $selected && ! \in_array( $selected, $values, true ) ) {
			array_unshift( $values, $selected );
		}

		return \array_map(
			static function ( string $value ): array {
				return array(
					'value' => $value,
					'label' => $value,
				);
			},
			$values
		);
	}

	/**
	 * Retrieves paginated top events.
	 *
	 * @param int                  $days Number of days to look back.
	 * @param array<string, mixed> $args Pagination, sorting, and search arguments.
	 * @return array{items: array<int, array{event_type: string, provider_id: string, total_events: int, total_value: float}>, total_items: int}
	 */
	public function get_top_events( int $days = 30, array $args = array() ): array {
		global $wpdb;

		if ( $this->is_author_scoped() ) {
			return array(
				'items'       => array(),
				'total_items' => 0,
			);
		}

		$version        = \get_option( 'ppla_stats_version', '1' );
		$ppla_cache_key = 'ppla_top_events_' . $days . '_' . ReportClock::period_start( $days ) . '_' . \md5( (string) \wp_json_encode( $args ) ) . '_' . $version;

		$cached = \wp_cache_get( $ppla_cache_key, self::CACHE_GROUP );
		if ( false !== $cached && \is_array( $cached ) ) {
			/**
			 * Cached results.
			 *
				 * @var array{items: array<int, array{event_type: string, provider_id: string, total_events: int, total_value: float}>, total_items: int} $cached
			 */
			return $cached;
		}

		$table = $wpdb->prefix . 'ppla_event_contracts';

		$per_page = isset( $args['per_page'] ) ? (int) $args['per_page'] : 10;
		$page     = isset( $args['page'] ) ? (int) $args['page'] : 1;
		$search   = ! empty( $args['search'] ) ? $wpdb->esc_like( $args['search'] ) : '';

		$allowed_orderby = array( 'event_type', 'provider_id', 'total_events', 'total_value' );
		$orderby         = isset( $args['orderby'] ) && \in_array( $args['orderby'], $allowed_orderby, true ) ? $args['orderby'] : 'total_events';
		$order           = isset( $args['order'] ) && 'asc' === \strtolower( $args['order'] ) ? 'ASC' : 'DESC';

		$offset = ( $page - 1 ) * $per_page;

		$total_groups = 0;
		$results      = array();

		if ( '' !== $search ) {
			$like = '%' . $search . '%';

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$total_groups = (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT COUNT(*) FROM (SELECT event_type FROM %i WHERE occurred_at >= %s AND (event_type LIKE %s OR provider_id LIKE %s) GROUP BY event_type, provider_id) as t',
					$table,
					ReportClock::period_start( $days ),
					$like,
					$like
				)
			);

			if ( 'ASC' === $order ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
				$results = $wpdb->get_results(
					$wpdb->prepare(
						'SELECT event_type, provider_id, COUNT(id) as total_events, COALESCE(SUM(amount), 0) as total_value FROM %i WHERE occurred_at >= %s AND (event_type LIKE %s OR provider_id LIKE %s) GROUP BY event_type, provider_id ORDER BY %i ASC LIMIT %d OFFSET %d',
						$table,
						ReportClock::period_start( $days ),
						$like,
						$like,
						$orderby,
						$per_page,
						$offset
					),
					ARRAY_A
				);
			} else {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
				$results = $wpdb->get_results(
					$wpdb->prepare(
						'SELECT event_type, provider_id, COUNT(id) as total_events, COALESCE(SUM(amount), 0) as total_value FROM %i WHERE occurred_at >= %s AND (event_type LIKE %s OR provider_id LIKE %s) GROUP BY event_type, provider_id ORDER BY %i DESC LIMIT %d OFFSET %d',
						$table,
						ReportClock::period_start( $days ),
						$like,
						$like,
						$orderby,
						$per_page,
						$offset
					),
					ARRAY_A
				);
			}
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$total_groups = (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT COUNT(*) FROM (SELECT event_type FROM %i WHERE occurred_at >= %s GROUP BY event_type, provider_id) as t',
					$table,
					ReportClock::period_start( $days )
				)
			);

			if ( 'ASC' === $order ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
				$results = $wpdb->get_results(
					$wpdb->prepare(
						'SELECT event_type, provider_id, COUNT(id) as total_events, COALESCE(SUM(amount), 0) as total_value FROM %i WHERE occurred_at >= %s GROUP BY event_type, provider_id ORDER BY %i ASC LIMIT %d OFFSET %d',
						$table,
						ReportClock::period_start( $days ),
						$orderby,
						$per_page,
						$offset
					),
					ARRAY_A
				);
			} else {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
				$results = $wpdb->get_results(
					$wpdb->prepare(
						'SELECT event_type, provider_id, COUNT(id) as total_events, COALESCE(SUM(amount), 0) as total_value FROM %i WHERE occurred_at >= %s GROUP BY event_type, provider_id ORDER BY %i DESC LIMIT %d OFFSET %d',
						$table,
						ReportClock::period_start( $days ),
						$orderby,
						$per_page,
						$offset
					),
					ARRAY_A
				);
			}
		}

		$data = array();
		if ( \is_array( $results ) ) {
			foreach ( $results as $row ) {
				$data[] = array(
					'event_type'   => (string) $row['event_type'],
					'provider_id'  => (string) $row['provider_id'],
					'total_events' => (int) $row['total_events'],
					'total_value'  => (float) $row['total_value'],
				);
			}
		}

		$output = array(
			'items'       => $data,
			'total_items' => $total_groups,
		);

		\wp_cache_set( $ppla_cache_key, $output, self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $output;
	}

	/**
	 * Retrieves real-time tracking data spanning the last 20 minutes.
	 * Combines unprocessed buffer items with committed pageviews to prevent data loss.
	 *
	 * @return array<int, array<string, mixed>> Combined real-time hits.
	 */
	public function get_realtime_data(): array {
		global $wpdb;

		$buffer_table    = $wpdb->prefix . 'ppla_buffer';
		$pageviews_table = $wpdb->prefix . 'ppla_pageviews';
		$sessions_table  = $wpdb->prefix . 'ppla_sessions';
		$scope           = $this->get_pageview_scope_condition( 'p.url' );
		$anonymous_scope = $this->get_pageview_scope_condition();
		$since           = ReportClock::minutes_ago( 20 );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$buffered = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT payload, created_at FROM %i WHERE created_at >= %s',
				$buffer_table,
				$since
			),
			ARRAY_A
		);

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
		$saved = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT p.url, p.referrer, s.device_type, s.session_hash, p.created_at 
				 FROM %i p 
				 INNER JOIN %i s ON p.session_id = s.id 
				 WHERE p.created_at >= %s' . $scope['sql'],
				$pageviews_table,
				$sessions_table,
				...\array_merge( array( $since ), $scope['params'] )
			),
			ARRAY_A
		);
		// phpcs:enable

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared -- SQL fragments hold only literals, allowlisted identifiers and placeholders bound by prepare().
		$anonymous_saved = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT id, url, referrer, device_type, created_at 
				 FROM %i
				 WHERE session_id = 0 AND created_at >= %s' . $anonymous_scope['sql'],
				$pageviews_table,
				...\array_merge( array( $since ), $anonymous_scope['params'] )
			),
			ARRAY_A
		);
		// phpcs:enable

		$rt_buffer = array();

		if ( \is_array( $buffered ) ) {
			foreach ( $buffered as $row ) {
				$payload = \json_decode( $row['payload'], true );
				if ( \is_array( $payload ) ) {
					if ( empty( $payload['record_pageview'] ) ) {
						continue;
					}

					if ( $this->is_author_scoped() && ( ! isset( $payload['url'] ) || ! $this->is_url_in_author_scope( (string) $payload['url'] ) ) ) {
						continue;
					}

					if ( ! isset( $payload['session_hash'] ) && isset( $payload['privacy_mode'] ) && 'strict_anonymous' === $payload['privacy_mode'] ) {
						$payload['session_hash'] = 'anonymous_buffer_' . (string) $this->site_timestamp( (string) $row['created_at'] ) . '_' . (string) \count( $rt_buffer );
					}
					$payload['timestamp'] = $this->site_timestamp( (string) $row['created_at'] );
					$rt_buffer[]          = $payload;
				}
			}
		}

		if ( \is_array( $saved ) ) {
			foreach ( $saved as $row ) {
				$rt_buffer[] = array(
					'url'          => (string) $row['url'],
					'referrer'     => (string) $row['referrer'],
					'device_type'  => (string) $row['device_type'],
					'session_hash' => (string) $row['session_hash'],
					'timestamp'    => $this->site_timestamp( (string) $row['created_at'] ),
				);
			}
		}

		if ( \is_array( $anonymous_saved ) ) {
			foreach ( $anonymous_saved as $row ) {
				$rt_buffer[] = array(
					'privacy_mode' => 'strict_anonymous',
					'url'          => (string) $row['url'],
					'referrer'     => (string) $row['referrer'],
					'device_type'  => (string) $row['device_type'],
					'session_hash' => 'anonymous_hit_' . (string) $row['id'],
					'timestamp'    => $this->site_timestamp( (string) $row['created_at'] ),
				);
			}
		}

		return $rt_buffer;
	}

	/**
	 * Returns the active analytics privacy model.
	 */
	public function get_privacy_mode(): string {
		$settings = \get_option( 'ppla_settings', array() );
		$settings = \is_array( $settings ) ? $settings : array();

		return isset( $settings['strict_anonymous_mode'] ) && false === (bool) $settings['strict_anonymous_mode']
			? 'session_hash'
			: 'strict_anonymous';
	}

	/**
	 * Returns whether analytics should be limited to the current user's authored content.
	 */
	public function is_author_scoped(): bool {
		return 0 < $this->get_author_scope_user_id();
	}

	/**
	 * Builds a SQL fragment that limits pageview rows to authored content.
	 *
	 * @param string $url_column SQL column containing the tracked URL path.
	 * @return array{sql: string, params: array<int, string>}
	 */
	private function get_pageview_scope_condition( string $url_column = 'url' ): array {
		if ( ! $this->is_author_scoped() ) {
			return array(
				'sql'    => '',
				'params' => array(),
			);
		}

		$urls = $this->get_author_scope_urls();
		if ( array() === $urls ) {
			return array(
				'sql'    => ' AND 1 = 0',
				'params' => array(),
			);
		}

		$placeholders = \implode( ', ', \array_fill( 0, \count( $urls ), '%s' ) );
		$url_column   = 'p.url' === $url_column ? 'p.url' : 'url';

		return array(
			'sql'    => " AND SUBSTRING_INDEX({$url_column}, '?', 1) IN ({$placeholders})",
			'params' => $urls,
		);
	}

	/**
	 * Checks a tracked URL against the resolved author scope.
	 *
	 * @param string $url Tracked URL or path.
	 */
	private function is_url_in_author_scope( string $url ): bool {
		$urls = $this->get_author_scope_urls();
		if ( array() === $urls ) {
			return false;
		}

		$path = $this->normalize_url_path( $url );

		return \in_array( $path, $urls, true );
	}

	/**
	 * Resolves authored public content URLs for the current delegated analytics user.
	 *
	 * @return array<int, string>
	 */
	private function get_author_scope_urls(): array {
		if ( $this->author_scope_loaded ) {
			return $this->author_scope_urls ?? array();
		}

		$this->author_scope_loaded = true;
		$user_id                   = $this->get_author_scope_user_id();

		if ( $user_id <= 0 ) {
			$this->author_scope_urls = array();
			return array();
		}

		$post_types = \get_post_types( array( 'public' => true ), 'names' );
		$post_types = \is_array( $post_types ) ? $post_types : array( 'post', 'page' );
		unset( $post_types['attachment'] );

		$post_ids = \get_posts(
			array(
				'author'         => $user_id,
				'fields'         => 'ids',
				'no_found_rows'  => true,
				'post_status'    => 'publish',
				'post_type'      => \array_values( $post_types ),
				'posts_per_page' => -1,
			)
		);

		$urls = array();
		foreach ( $post_ids as $post_id ) {
			$permalink = \get_permalink( (int) $post_id );
			if ( ! \is_string( $permalink ) || '' === $permalink ) {
				continue;
			}

			$urls[] = $this->normalize_url_path( $permalink );
		}

		$this->author_scope_urls = \array_values( \array_unique( \array_filter( $urls ) ) );

		return $this->author_scope_urls;
	}

	/**
	 * Returns the current user ID when Pro grants an author-scoped analytics view.
	 */
	private function get_author_scope_user_id(): int {
		$user_id = (int) \apply_filters( 'ppla_analytics_author_scope_user_id', 0 );

		return \max( 0, $user_id );
	}

	/**
	 * Normalizes absolute URLs and tracked paths to the stored pageview path.
	 *
	 * @param string $url URL or path.
	 */
	private function normalize_url_path( string $url ): string {
		$parsed = \wp_parse_url( $url );
		if ( ! \is_array( $parsed ) ) {
			if ( '/' === $url ) {
				return '/';
			}

			$path = \strtok( $url, '?' );

			return \is_string( $path ) && '' !== $path ? $path : $url;
		}

		$path = isset( $parsed['path'] ) && \is_string( $parsed['path'] ) ? $parsed['path'] : '/';

		return '' !== $path ? $path : '/';
	}

	/**
	 * Converts a stored site-local DATETIME to a Unix timestamp.
	 *
	 * @param string $datetime Site-local `Y-m-d H:i:s` value.
	 */
	private function site_timestamp( string $datetime ): int {
		$value = \DateTimeImmutable::createFromFormat( 'Y-m-d H:i:s', $datetime, \wp_timezone() );

		return false === $value ? 0 : $value->getTimestamp();
	}

	/**
	 * Calculates the percentage change between two counts.
	 *
	 * An empty previous period has no meaningful percentage, so the trend is
	 * `null` when anything appeared and `0.0` when both periods are empty.
	 *
	 * @param int $current Current period value.
	 * @param int $prev    Previous period value.
	 * @return float|null Trend percentage.
	 */
	private function calculate_trend( int $current, int $prev ): ?float {
		if ( 0 === $prev ) {
			return $current > 0 ? null : 0.0;
		}

		return (float) \round( ( ( $current - $prev ) / $prev ) * 100, 1 );
	}

	/**
	 * Calculates the percentage change between two ratios.
	 *
	 * @param float $current Current period ratio.
	 * @param float $prev    Previous period ratio.
	 * @return float|null Trend percentage, or null without a previous ratio.
	 */
	private function calculate_ratio_trend( float $current, float $prev ): ?float {
		if ( $prev <= 0.0 ) {
			return $current > 0.0 ? null : 0.0;
		}

		return (float) \round( ( ( $current - $prev ) / $prev ) * 100, 1 );
	}

	/**
	 * Formats a duration as M:SS, or H:MM:SS from one hour.
	 *
	 * @param int $seconds Total seconds.
	 * @return string Formatted duration.
	 */
	private function format_duration( int $seconds ): string {
		$seconds = \max( 0, $seconds );
		$hours   = (int) \floor( $seconds / HOUR_IN_SECONDS );
		$minutes = (int) \floor( ( $seconds % HOUR_IN_SECONDS ) / 60 );

		if ( $hours > 0 ) {
			return \sprintf( '%d:%02d:%02d', $hours, $minutes, $seconds % 60 );
		}

		return \sprintf( '%d:%02d', $minutes, $seconds % 60 );
	}
}
