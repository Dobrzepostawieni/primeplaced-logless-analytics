<?php
/**
 * Tools Controller.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Rest;

use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Integrations\Capabilities;
use Primeplaced_Logless_Analytics\Services\BufferProcessor;
use Primeplaced_Logless_Analytics\Services\IdentityResolver;
use Primeplaced_Logless_Analytics\Services\MaintenanceService;
use Primeplaced_Logless_Analytics\Services\ExportService;
use Primeplaced_Logless_Analytics\Data\DashboardRepository;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class ToolsController
 *
 * Handles manual maintenance tools like buffer queue aggregation, database optimization, and exports.
 */
class ToolsController extends Base {

	/**
	 * Buffer processor instance.
	 */
	private BufferProcessor $buffer_processor;

	/**
	 * Identity Resolver instance.
	 */
	private IdentityResolver $identity_resolver;

	/**
	 * Dashboard Repository instance.
	 */
	private DashboardRepository $dashboard_repo;

	/**
	 * Maintenance Service instance.
	 */
	private MaintenanceService $maintenance_service;

	/**
	 * Export Service instance.
	 */
	private ExportService $export_service;

	/**
	 * ToolsController constructor.
	 *
	 * @param BufferProcessor     $buffer_processor    Shared bounded buffer processor.
	 * @param IdentityResolver    $identity_resolver   Service managing cookieless identities.
	 * @param DashboardRepository $dashboard_repo      Service managing database reads.
	 * @param MaintenanceService  $maintenance_service Service managing database maintenance.
	 * @param ExportService       $export_service      Service managing data exports.
	 */
	public function __construct(
		BufferProcessor $buffer_processor,
		IdentityResolver $identity_resolver,
		DashboardRepository $dashboard_repo,
		MaintenanceService $maintenance_service,
		ExportService $export_service
	) {
		$this->buffer_processor    = $buffer_processor;
		$this->identity_resolver   = $identity_resolver;
		$this->dashboard_repo      = $dashboard_repo;
		$this->maintenance_service = $maintenance_service;
		$this->export_service      = $export_service;
	}

	/**
	 * Initialize the class and register REST routes.
	 *
	 * @return bool True on success.
	 */
	public function initialize(): bool {
		if ( ! parent::initialize() ) {
			return false;
		}

		\add_action( 'rest_api_init', array( $this, 'register_tools_routes' ) );

		return true;
	}

	/**
	 * Registers the tools REST endpoints.
	 */
	public function register_tools_routes(): void {
		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/tools/flush-buffer',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'flush_buffer' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_settings' ),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/tools/buffer-status',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_buffer_status' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_settings' ),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/tools/rotate-salt',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'rotate_salt' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_settings' ),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/tools/clear-data',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'clear_data' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_settings' ),
					'args'                => array(
						'days' => array(
							'type'              => 'string',
							'required'          => true,
							'sanitize_callback' => 'sanitize_text_field',
							'validate_callback' => 'rest_validate_request_arg',
						),
					),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/tools/db-stats',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_db_stats' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_settings' ),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/tools/optimize-db',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'optimize_db' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_settings' ),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/tools/export-csv',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'generate_csv_link' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_settings' ),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/tools/download-csv',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'download_csv' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_settings' ),
				),
			)
		);
	}

	/**
	 * Handles the request to flush queued hits into the analytics tables.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object.
	 */
	public function flush_buffer( WP_REST_Request $request ): WP_REST_Response {
		$start_time = \microtime( true );
		try {
			$result = $this->buffer_processor->flush();
		} catch ( \RuntimeException $exception ) {
			return new WP_REST_Response( array( 'error' => \__( 'Unable to flush the analytics buffer.', 'primeplaced-logless-analytics' ) ), 500 );
		}
		$flushed = $result['flushed_hits'];

		$end_time       = \microtime( true );
		$execution_time = \round( $end_time - $start_time, 3 );

		return new WP_REST_Response(
			array(
				'status'         => 'success',
				'flushed'        => $flushed,
				'execution_time' => $execution_time,
			),
			200
		);
	}

	/**
	 * Handles the request to retrieve the current DB buffer queue and cron status.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object containing status metrics.
	 */
	public function get_buffer_status( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = $wpdb->prefix . 'ppla_buffer';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$count_rows = $wpdb->get_results(
			$wpdb->prepare( 'SELECT COUNT(id) AS events_count FROM %i', $table ),
			ARRAY_A
		);
		if ( ! \is_array( $count_rows ) || ! isset( $count_rows[0]['events_count'] ) ) {
			return new WP_REST_Response( array( 'error' => \__( 'Unable to read the analytics buffer status.', 'primeplaced-logless-analytics' ) ), 500 );
		}
		$events_count = (int) $count_rows[0]['events_count'];

		$timestamp     = \wp_next_scheduled( 'ppla_sync_buffer_cron' );
		$time_to_next  = $timestamp ? \max( 0, $timestamp - \time() ) : 0;
		$cron_disabled = \defined( 'DISABLE_WP_CRON' ) && \constant( 'DISABLE_WP_CRON' );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$status_rows = $wpdb->get_results( $wpdb->prepare( 'SHOW TABLE STATUS LIKE %s', $wpdb->esc_like( $table ) ), ARRAY_A );
		if ( ! \is_array( $status_rows ) || ! isset( $status_rows[0] ) || ! \is_array( $status_rows[0] ) ) {
			return new WP_REST_Response( array( 'error' => \__( 'Unable to read the analytics buffer table.', 'primeplaced-logless-analytics' ) ), 500 );
		}
		$status_row = $status_rows[0];

		$buffer_bytes = isset( $status_row['Data_length'] ) ? (int) $status_row['Data_length'] : $events_count * 250;
		$buffer_kb    = \round( $buffer_bytes / 1024, 2 );

		return new WP_REST_Response(
			array(
				'events_count' => $events_count,
				'time_to_next' => $time_to_next,
				'cron_active'  => ! $cron_disabled && false !== $timestamp,
				'buffer_kb'    => $buffer_kb,
			),
			200
		);
	}

	/**
	 * Forces immediate rotation of the cryptographic salt.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object.
	 */
	public function rotate_salt( WP_REST_Request $request ): WP_REST_Response {
		$this->identity_resolver->rotate_salt();
		return new WP_REST_Response( array( 'status' => 'success' ), 200 );
	}

	/**
	 * Purges old analytical data.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object.
	 */
	public function clear_data( WP_REST_Request $request ): WP_REST_Response {
		$days_param = $request->get_param( 'days' );

		if ( 'all' === $days_param ) {
			$days = 0;
		} elseif ( \is_numeric( $days_param ) ) {
			$days = (int) $days_param;
			if ( $days <= 0 ) {
				return new WP_REST_Response( array( 'error' => \__( 'The number of days must be a positive number or "all".', 'primeplaced-logless-analytics' ) ), 400 );
			}
		} else {
			return new WP_REST_Response( array( 'error' => \__( 'The number of days must be a positive number or "all".', 'primeplaced-logless-analytics' ) ), 400 );
		}

		try {
			$has_more = $this->maintenance_service->purge_old_data( $days );
		} catch ( \RuntimeException $exception ) {
			return new WP_REST_Response( array( 'error' => \__( 'Analytics data could not be cleared.', 'primeplaced-logless-analytics' ) ), 500 );
		}
		return new WP_REST_Response(
			array(
				'status'   => 'success',
				'has_more' => $has_more,
			),
			200
		);
	}

	/**
	 * Retrieves database optimization status.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object.
	 */
	public function get_db_stats( WP_REST_Request $request ): WP_REST_Response {
		try {
			$stats = $this->maintenance_service->get_db_stats();
		} catch ( \RuntimeException $exception ) {
			return new WP_REST_Response( array( 'error' => \__( 'Database statistics could not be read.', 'primeplaced-logless-analytics' ) ), 500 );
		}
		return new WP_REST_Response( $stats, 200 );
	}

	/**
	 * Runs MySQL OPTIMIZE TABLE on analytics tables.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object.
	 */
	public function optimize_db( WP_REST_Request $request ): WP_REST_Response {
		try {
			$this->maintenance_service->optimize_db();
		} catch ( \RuntimeException $exception ) {
			return new WP_REST_Response( array( 'error' => \__( 'Analytics tables could not be optimized.', 'primeplaced-logless-analytics' ) ), 500 );
		}
		return new WP_REST_Response( array( 'status' => 'success' ), 200 );
	}

	/**
	 * Returns the CSV download URL for the current administrator.
	 *
	 * The browser opens this URL directly instead of through fetch(), so it
	 * carries a REST nonce that authenticates the logged-in user. The download
	 * route then requires the same capability as every other tool.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response containing the download URL.
	 */
	public function generate_csv_link( WP_REST_Request $request ): WP_REST_Response {
		$namespace = \trim( \PPLA_API_NAMESPACE, '/' );

		return new WP_REST_Response(
			array(
				'url' => \add_query_arg(
					array( '_wpnonce' => \wp_create_nonce( 'wp_rest' ) ),
					\rest_url( "{$namespace}/tools/download-csv" )
				),
			),
			200
		);
	}

	/**
	 * Streams the CSV export to the browser.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 */
	public function download_csv( WP_REST_Request $request ): void {
		$top_pages = $this->dashboard_repo->get_top_pages( 30, array( 'per_page' => 20 ) );
		$top_refs  = $this->dashboard_repo->get_top_referrers( 30, array( 'per_page' => 20 ) );
		$raw_logs  = $this->export_service->get_raw_export_data( 30 );

		if ( \ob_get_level() > 0 ) {
			\ob_end_clean();
		}

		\header( 'Content-Type: text/csv; charset=utf-8' );
		\header( 'Content-Disposition: attachment; filename=ppla-analytics-export-' . \gmdate( 'Y-m-d' ) . '.csv' );
		\header( 'Pragma: no-cache' );
		\header( 'Expires: 0' );

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$output = \fopen( 'php://output', 'w' );

		if ( ! $output ) {
			\wp_die( \esc_html__( 'Cannot open output stream.', 'primeplaced-logless-analytics' ) );
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
		\fwrite( $output, "\xEF\xBB\xBF" );

		// Helper to prevent CSV Formula Injection (CWE-123).
		$escape_formula = function ( $field ) {
			$field = (string) $field;

			if ( '' !== $field && \in_array( $field[0], array( '=', '+', '-', '@', "\t", "\r" ), true ) ) {
				return "'" . $field;
			}
			return $field;
		};

		\fputcsv( $output, array( '--- TOP PAGES (LAST 30 DAYS) ---' ), ',', '"', '' );
		\fputcsv( $output, array( 'URL', 'Pageviews', 'Share (%)' ), ',', '"', '' );

		if ( isset( $top_pages['items'] ) && \is_array( $top_pages['items'] ) ) {
			foreach ( $top_pages['items'] as $page ) {
				\fputcsv( $output, array( $escape_formula( $page['url'] ), $page['views'], $page['percentage'] ), ',', '"', '' );
			}
		}

		\fputcsv( $output, array( '' ), ',', '"', '' );

		\fputcsv( $output, array( '--- TOP TRAFFIC SOURCES (LAST 30 DAYS) ---' ), ',', '"', '' );
		\fputcsv( $output, array( 'Source', 'Visits', 'Share (%)' ), ',', '"', '' );

		if ( isset( $top_refs['items'] ) && \is_array( $top_refs['items'] ) ) {
			foreach ( $top_refs['items'] as $ref ) {
				\fputcsv( $output, array( $escape_formula( $ref['source'] ), $ref['visits'], $ref['percentage'] ), ',', '"', '' );
			}
		}

		\fputcsv( $output, array( '' ), ',', '"', '' );
		\fputcsv( $output, array( '' ), ',', '"', '' );

		\fputcsv( $output, array( '--- RAW TRAFFIC LOG (LAST 30 DAYS) ---' ), ',', '"', '' );
		\fputcsv( $output, array( 'Datetime', 'URL', 'Referrer', 'Device Type' ), ',', '"', '' );

		$row_count = 0;

		foreach ( $raw_logs as $log ) {
			\fputcsv( $output, array( $log['created_at'], $escape_formula( $log['url'] ), $escape_formula( $log['referrer'] ), $log['device_type'] ), ',', '"', '' );
			++$row_count;

			if ( 0 === $row_count % 500 ) {
				if ( \ob_get_level() > 0 ) {
					\ob_flush();
				}
				\flush();
			}
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		\fclose( $output );
		exit;
	}
}
