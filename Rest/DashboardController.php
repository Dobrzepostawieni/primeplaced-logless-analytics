<?php
/**
 * Dashboard Controller.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Rest;

use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Integrations\Capabilities;
use Primeplaced_Logless_Analytics\Data\DashboardRepository;
use Primeplaced_Logless_Analytics\Services\ReportQuery;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DashboardController
 *
 * Handles direct requests for retrieving analytics data securely.
 */
class DashboardController extends Base {

	/**
	 * Dashboard Repository instance.
	 */
	private DashboardRepository $repository;

	/**
	 * DashboardController constructor.
	 *
	 * @param DashboardRepository $repository Service managing database read operations.
	 */
	public function __construct( DashboardRepository $repository ) {
		$this->repository = $repository;
	}

	/**
	 * Initializes the controller and hooks dashboard REST API routes registration.
	 *
	 * @return bool True on success, false on failure.
	 */
	public function initialize(): bool {
		if ( ! parent::initialize() ) {
			return false;
		}

		\add_action( 'rest_api_init', array( $this, 'register_dashboard_routes' ) );

		return true;
	}

	/**
	 * Registers dashboard-related REST endpoints.
	 */
	public function register_dashboard_routes(): void {
		$common_args = array(
			'range' => array(
				'type'              => 'integer',
				'required'          => false,
				'default'           => 30,
				'minimum'           => 1,
				'sanitize_callback' => 'absint',
				'validate_callback' => 'rest_validate_request_arg',
			),
		);

		$pagination_args = array(
			'per_page' => array(
				'type'              => 'integer',
				'required'          => false,
				'default'           => 10,
				'minimum'           => 1,
				'maximum'           => 100,
				'sanitize_callback' => 'absint',
				'validate_callback' => 'rest_validate_request_arg',
			),
			'page'     => array(
				'type'              => 'integer',
				'required'          => false,
				'default'           => 1,
				'minimum'           => 1,
				'sanitize_callback' => 'absint',
				'validate_callback' => 'rest_validate_request_arg',
			),
			'search'   => array(
				'type'              => 'string',
				'required'          => false,
				'default'           => '',
				'maxLength'         => 100,
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => 'rest_validate_request_arg',
			),
			'orderby'  => array(
				'type'              => 'string',
				'required'          => false,
				'default'           => '',
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => 'rest_validate_request_arg',
			),
			'order'    => array(
				'type'              => 'string',
				'required'          => false,
				'default'           => 'desc',
				'enum'              => array( 'asc', 'desc' ),
				'sanitize_callback' => 'sanitize_key',
				'validate_callback' => 'rest_validate_request_arg',
			),
		);

		$comparison_arg    = array(
			'type'              => 'string',
			'required'          => false,
			'default'           => ReportQuery::COMPARISON_NONE,
			'enum'              => array( ReportQuery::COMPARISON_NONE, ReportQuery::COMPARISON_PREVIOUS_PERIOD ),
			'sanitize_callback' => 'sanitize_key',
			'validate_callback' => 'rest_validate_request_arg',
		);
		$page_filter_arg   = array(
			'type'              => 'string',
			'required'          => false,
			'default'           => '',
			'maxLength'         => 500,
			'sanitize_callback' => 'sanitize_text_field',
			'validate_callback' => 'rest_validate_request_arg',
		);
		$source_filter_arg = array(
			'type'              => 'string',
			'required'          => false,
			'default'           => '',
			'maxLength'         => 500,
			'sanitize_callback' => 'sanitize_text_field',
			'validate_callback' => 'rest_validate_request_arg',
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/dashboard/status',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_status' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_analytics' ),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/dashboard/charts',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_charts_data' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_analytics' ),
					'args'                => $common_args,
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/dashboard/content',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_content_stats' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_analytics' ),
					'args'                => \array_merge(
						$common_args,
						$pagination_args,
						array(
							'comparison'    => $comparison_arg,
							'filter_page'   => $page_filter_arg,
							'filter_source' => $source_filter_arg,
						),
						array(
							'type' => array(
								'type'              => 'string',
								'required'          => false,
								'default'           => 'pages',
								'enum'              => array( 'pages', 'referrers' ),
								'sanitize_callback' => 'sanitize_key',
								'validate_callback' => 'rest_validate_request_arg',
							),
						)
					),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/dashboard/404-errors',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_404_stats' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_analytics' ),
					'args'                => \array_merge(
						$common_args,
						$pagination_args,
						array(
							'comparison'  => $comparison_arg,
							'filter_page' => $page_filter_arg,
						)
					),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/dashboard/realtime',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_realtime_stats' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_analytics' ),
				),
			)
		);

		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/dashboard/events',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_events_stats' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_analytics' ),
					'args'                => \array_merge( $common_args, $pagination_args ),
				),
			)
		);
	}

	/**
	 * Returns the current measurement and queue state for the Overview workflow.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response Operational dashboard status.
	 */
	public function get_status( WP_REST_Request $request ): WP_REST_Response {
		unset( $request );

		return new WP_REST_Response(
			array(
				'success' => true,
				'data'    => $this->repository->get_dashboard_status(),
			),
			200
		);
	}

	/**
	 * Handles the request to retrieve top 404 errors.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object containing 404 statistics.
	 */
	public function get_404_stats( WP_REST_Request $request ): WP_REST_Response {
		$query      = ReportQuery::from_request( $request, array( 'page' => 'path' ) );
		$range      = $query->get_range();
		$args       = $this->get_source_table_args( $request, $query );
		$errors     = $this->repository->get_top_404_errors( $range, $args );
		$summary    = array(
			'errors' => $this->repository->get_source_summary( '404-errors', $range, $args ),
		);
		$comparison = $query->compares_previous_period()
			? array(
				'range'   => $range,
				'summary' => array(
					'errors' => $this->repository->get_source_summary( '404-errors', $range, $args, 1 ),
				),
			)
			: null;

		return new WP_REST_Response(
			array_merge(
				array(
					'success'        => true,
					'range'          => $range,
					'404_errors'     => $errors,
					'query'          => array(
						'comparison' => $query->get_comparison(),
						'filters'    => $query->get_filters(),
					),
					'filter_options' => array(
						'page' => $this->repository->get_source_filter_options( '404-errors', $range, $query->get_filter( 'page' ) ),
					),
					'summary'        => $summary,
					'comparison'     => $comparison,
					'meta'           => array(
						'filters'    => array(
							'search' => $args['search'],
						),
						'pagination' => array(
							'page'        => $args['page'],
							'per_page'    => $args['per_page'],
							'total_items' => $errors['total_items'],
						),
					),
				),
				$this->get_measurement_meta( $range )
			),
			200
		);
	}

	/**
	 * Handles the request to retrieve aggregated chart data.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object containing traffic and devices data.
	 */
	public function get_charts_data( WP_REST_Request $request ): WP_REST_Response {
		$range_param = $request->get_param( 'range' );
		$range       = ! empty( $range_param ) ? (int) $range_param : 30;

		if ( ! \in_array( $range, array( 7, 30, 90 ), true ) ) {
			$range = 30;
		}

		$traffic = $this->repository->get_daily_traffic( $range );
		$devices = $this->repository->get_devices_share( $range );

		return new WP_REST_Response(
			array_merge(
				array(
					'success'      => true,
					'range'        => $range,
					'privacy_mode' => $this->repository->get_privacy_mode(),
					'traffic'      => $traffic,
					'devices'      => $devices,
				),
				$this->get_measurement_meta( $range )
			),
			200
		);
	}

	/**
	 * Handles the request to retrieve top pages and referrers.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object containing content statistics.
	 */
	public function get_content_stats( WP_REST_Request $request ): WP_REST_Response {
		$type   = 'referrers' === $request->get_param( 'type' ) ? 'referrers' : 'pages';
		$query  = ReportQuery::from_request(
			$request,
			'referrers' === $type ? array( 'source' => 'text' ) : array( 'page' => 'path' )
		);
		$range  = $query->get_range();
		$args   = $this->get_source_table_args( $request, $query );
		$metric = 'referrers' === $type ? 'visits' : 'pageviews';

		$response_data = array_merge(
			array(
				'success' => true,
				'range'   => $range,
			),
			$this->get_measurement_meta( $range )
		);

		if ( 'referrers' === $type ) {
			$report_data                = $this->repository->get_top_referrers( $range, $args );
			$response_data['referrers'] = $report_data;
		} else {
			$report_data            = $this->repository->get_top_pages( $range, $args );
			$response_data['pages'] = $report_data;
		}

		$response_data['query']          = array(
			'comparison' => $query->get_comparison(),
			'filters'    => $query->get_filters(),
		);
		$filter_id                       = 'referrers' === $type ? 'source' : 'page';
		$filter_value                    = 'referrers' === $type ? $query->get_filter( 'source' ) : $query->get_filter( 'page' );
		$response_data['filter_options'] = array(
			$filter_id => $this->repository->get_source_filter_options(
				$type,
				$range,
				$filter_value
			),
		);
		$response_data['summary']        = array(
			$metric => $this->repository->get_source_summary( $type, $range, $args ),
		);
		$response_data['comparison']     = $query->compares_previous_period()
			? array(
				'range'   => $range,
				'summary' => array(
					$metric => $this->repository->get_source_summary( $type, $range, $args, 1 ),
				),
			)
			: null;

		$response_data['meta'] = array(
			'filters'    => array(
				'search' => $args['search'],
			),
			'pagination' => array(
				'page'        => $args['page'],
				'per_page'    => $args['per_page'],
				'total_items' => $report_data['total_items'],
			),
		);

		return new WP_REST_Response( $response_data, 200 );
	}

	/**
	 * Extracts the paginated table state shared by all Source reports.
	 *
	 * @param WP_REST_Request $request Current REST request.
	 * @param ReportQuery     $query   Normalized segment and comparison state.
	 * @return array<string,mixed> Sanitized repository arguments.
	 */
	private function get_source_table_args( WP_REST_Request $request, ReportQuery $query ): array {
		$per_page = (int) $request->get_param( 'per_page' );
		$page     = (int) $request->get_param( 'page' );
		$orderby  = \sanitize_key( (string) $request->get_param( 'orderby' ) );
		$order    = \sanitize_key( (string) $request->get_param( 'order' ) );
		$filters  = $query->get_filters();

		// Repository arguments reserve `page` for pagination, while the neutral
		// report contract exposes the Sources path filter as `page`.
		if ( isset( $filters['page'] ) ) {
			$filters['filter_page'] = $filters['page'];
			unset( $filters['page'] );
		}

		if ( isset( $filters['source'] ) ) {
			$filters['filter_source'] = $filters['source'];
			unset( $filters['source'] );
		}

		return array_merge(
			array(
				'per_page'   => $per_page > 0 ? \min( $per_page, 100 ) : 10,
				'page'       => $page > 0 ? $page : 1,
				'search'     => \sanitize_text_field( (string) $request->get_param( 'search' ) ),
				'orderby'    => $orderby,
				'order'      => '' !== $order ? $order : 'desc',
				'comparison' => $query->get_comparison(),
			),
			$filters
		);
	}

	/**
	 * Handles the request to retrieve real-time analytics from recent buffered and stored hits.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object containing live traffic metrics.
	 */
	public function get_realtime_stats( WP_REST_Request $request ): WP_REST_Response {
		$rt_buffer = $this->repository->get_realtime_data();

		$now        = \time();
		$cutoff_20m = $now - 1200;
		$cutoff_5m  = $now - 300;

		$events_history  = \array_fill( 0, 20, 0 );
		$active_sessions = array();

		foreach ( $rt_buffer as $hit ) {
			if ( ! isset( $hit['timestamp'] ) || $hit['timestamp'] < $cutoff_20m ) {
				continue;
			}

			$ts           = (int) $hit['timestamp'];
			$diff_minutes = (int) \floor( ( $now - $ts ) / 60 );
			if ( $diff_minutes >= 0 && $diff_minutes < 20 ) {
				++$events_history[ 19 - $diff_minutes ];
			}

			if ( $ts >= $cutoff_5m ) {
				if ( ! isset( $hit['session_hash'] ) ) {
					continue;
				}
				$hash = $hit['session_hash'];
				if ( ! isset( $active_sessions[ $hash ] ) ) {
					$raw_ref                  = ! empty( $hit['referrer'] ) ? (string) $hit['referrer'] : '';
					$parsed_host              = '' !== $raw_ref ? \wp_parse_url( $raw_ref, PHP_URL_HOST ) : '';
					$source                   = $parsed_host ? $parsed_host : ( '' !== $raw_ref ? $raw_ref : 'direct' );
					$active_sessions[ $hash ] = \apply_filters(
						'ppla_active_session_data',
						array(
							'url'         => $hit['url'],
							'device_type' => $hit['device_type'],
							'source'      => $source,
							'first_hit'   => $ts,
							'last_hit'    => $ts,
						),
						$hit
					);
				} else {
					$active_sessions[ $hash ]['first_hit'] = \min( $active_sessions[ $hash ]['first_hit'], $ts );
					if ( $ts >= $active_sessions[ $hash ]['last_hit'] ) {
						$active_sessions[ $hash ]['last_hit'] = $ts;
						$active_sessions[ $hash ]['url']      = $hit['url'];
					}
				}
			}
		}

		$hits_output = array();
		foreach ( $active_sessions as $session ) {
			$source        = (string) $session['source'];
			$hits_output[] = \apply_filters(
				'ppla_realtime_hit_row',
				array(
					'url'          => $session['url'],
					'device_type'  => $session['device_type'],
					'source'       => 'direct' === $source ? 'direct' : \preg_replace( '/^www\./', '', $source ),
					'time_on_page' => $now - $session['first_hit'],
				),
				$session
			);
		}

		return new WP_REST_Response(
			array_merge(
				array(
					'success'        => true,
					'users_online'   => \count( $active_sessions ),
					'hits'           => $hits_output,
					'events_history' => $events_history,
				),
				$this->get_measurement_meta( 1 )
			),
			200
		);
	}

	/**
	 * Handles the request to retrieve tracked events.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object containing events statistics.
	 */
	public function get_events_stats( WP_REST_Request $request ): WP_REST_Response {
		$range_param = $request->get_param( 'range' );
		$range       = ! empty( $range_param ) ? (int) $range_param : 30;
		if ( $range <= 0 ) {
			$range = 30;
		}

		$param_per_page = $request->get_param( 'per_page' );
		$param_page     = $request->get_param( 'page' );
		$param_search   = $request->get_param( 'search' );
		$param_orderby  = $request->get_param( 'orderby' );
		$param_order    = $request->get_param( 'order' );

		$args = array(
			'per_page' => ! empty( $param_per_page ) ? (int) $param_per_page : 10,
			'page'     => ! empty( $param_page ) ? (int) $param_page : 1,
			'search'   => ! empty( $param_search ) ? \sanitize_text_field( $param_search ) : '',
			'orderby'  => ! empty( $param_orderby ) ? \sanitize_text_field( $param_orderby ) : '',
			'order'    => ! empty( $param_order ) ? \sanitize_text_field( $param_order ) : 'desc',
		);

		$events = $this->repository->get_top_events( $range, $args );

		return new WP_REST_Response(
			array_merge(
				array(
					'success' => true,
					'range'   => $range,
					'events'  => $events,
				),
				$this->get_measurement_meta( $range )
			),
			200
		);
	}

	/**
	 * Returns the shared measurement context for report empty states.
	 *
	 * Report endpoints keep their existing response shapes and add only
	 * operational metadata. The metadata contains no payloads or visitor
	 * identifiers and lets the UI distinguish an empty result from a blocked,
	 * queued, stale or misconfigured measurement.
	 *
	 * @param int $range Report range in days.
	 * @return array<string, mixed> Measurement metadata.
	 */
	private function get_measurement_meta( int $range = 30 ): array {
		return $this->repository->get_measurement_context( $range );
	}
}
