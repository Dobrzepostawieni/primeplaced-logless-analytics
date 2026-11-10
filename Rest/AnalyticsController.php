<?php
/**
 * Analytics Controller.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Rest;

use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Data\DashboardRepository;
use Primeplaced_Logless_Analytics\Integrations\Capabilities;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class AnalyticsController
 *
 * Serves aggregated analytical data to the React dashboard.
 */
class AnalyticsController extends Base {

	/**
	 * Dashboard Repository instance.
	 */
	private DashboardRepository $repository;

	/**
	 * AnalyticsController constructor.
	 *
	 * @param DashboardRepository $repository Database repository.
	 */
	public function __construct( DashboardRepository $repository ) {
		$this->repository = $repository;
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

		\add_action( 'rest_api_init', array( $this, 'register_analytics_routes' ) );

		return true;
	}

	/**
	 * Registers the analytics REST endpoints.
	 */
	public function register_analytics_routes(): void {
		\register_rest_route(
			\PPLA_API_NAMESPACE,
			'/stats/overview',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_overview' ),
					'permission_callback' => array( Capabilities::class, 'current_user_can_manage_analytics' ),
					'args'                => array(
						'range' => array(
							'description'       => \__( 'Number of calendar days, including today.', 'primeplaced-logless-analytics' ),
							'type'              => 'integer',
							'default'           => 30,
							'minimum'           => 1,
							'maximum'           => 365,
							'sanitize_callback' => 'absint',
							'validate_callback' => 'rest_validate_request_arg',
						),
					),
				),
			)
		);
	}

	/**
	 * Handles the request to fetch overview statistics.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response Response object containing stats.
	 */
	public function get_overview( WP_REST_Request $request ): WP_REST_Response {
		$days  = \max( 1, \min( 365, (int) $request->get_param( 'range' ) ) );
		$stats = $this->repository->get_overview_stats( $days );

		return new WP_REST_Response( $stats, 200 );
	}
}
