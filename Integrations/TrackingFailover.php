<?php
/**
 * Tracking Failover Integration Bridge.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Integrations;

use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Rest\TrackingController;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class TrackingFailover
 *
 * Routes the admin-ajax tracking fallback to the tracking controller.
 */
class TrackingFailover extends Base {

	/**
	 * Tracking Controller instance.
	 */
	private TrackingController $tracking_controller;

	/**
	 * TrackingFailover constructor.
	 *
	 * @param TrackingController $tracking_controller Tracking request handler.
	 */
	public function __construct( TrackingController $tracking_controller ) {
		$this->tracking_controller = $tracking_controller;
	}

	/**
	 * Registers the admin-ajax tracking actions for visitors and logged-in users.
	 *
	 * @return bool True on success.
	 */
	public function initialize(): bool {
		if ( ! parent::initialize() ) {
			return false;
		}

		\add_action( 'wp_ajax_ppla_track_hit', array( $this->tracking_controller, 'handle_ajax_tracking' ) );
		\add_action( 'wp_ajax_nopriv_ppla_track_hit', array( $this->tracking_controller, 'handle_ajax_tracking' ) );

		return true;
	}
}
