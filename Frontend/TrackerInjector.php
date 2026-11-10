<?php
/**
 * Tracker Injector Service.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Frontend;

use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Engine\Traits\ScriptDataHelper;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class TrackerInjector
 *
 * Injects the frontend tracking script and passes required configuration.
 */
class TrackerInjector extends Base {

	use ScriptDataHelper;

	/**
	 * Initialize the class.
	 *
	 * @return bool True on success.
	 */
	public function initialize(): bool {
		if ( ! parent::initialize() ) {
			return false;
		}

		\add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_tracker' ) );

		return true;
	}

	/**
	 * Enqueues the tracking script on the frontend.
	 */
	public function enqueue_tracker(): void {
		if ( (bool) \apply_filters( 'ppla_tracker_injection_disabled', false ) ) {
			return;
		}

		$settings = \get_option( 'ppla_settings', array() );
		$settings = \is_array( $settings ) ? $settings : array();

		$ignore_admins  = isset( $settings['ignore_admins'] ) ? (bool) $settings['ignore_admins'] : true;
		$ignore_editors = isset( $settings['ignore_editors'] ) ? (bool) $settings['ignore_editors'] : false;
		$ignore_authors = isset( $settings['ignore_authors'] ) ? (bool) $settings['ignore_authors'] : false;
		$track_404      = isset( $settings['track_404'] ) ? (bool) $settings['track_404'] : true;

		if ( $ignore_admins && \current_user_can( 'manage_options' ) ) {
			return;
		}
		if ( $ignore_editors && \current_user_can( 'edit_others_posts' ) && ! \current_user_can( 'manage_options' ) ) {
			return;
		}
		if ( $ignore_authors && \current_user_can( 'publish_posts' ) && ! \current_user_can( 'edit_others_posts' ) ) {
			return;
		}

		if ( ! $track_404 && \is_404() ) {
			return;
		}

		$handle       = \PPLA_TEXTDOMAIN . '-tracker';
		$script_url   = \plugins_url( 'assets/build/primeplaced-logless-analytics-public.js', \PPLA_PLUGIN_ABSOLUTE );
		$asset_file   = \plugin_dir_path( \PPLA_PLUGIN_ABSOLUTE ) . 'assets/build/primeplaced-logless-analytics-public.asset.php';
		$dependencies = array();
		$version      = \PPLA_VERSION;

		if ( \file_exists( $asset_file ) ) {
			$asset = require $asset_file;
			if ( \is_array( $asset ) ) {
				$dependencies = $asset['dependencies'] ?? $dependencies;
				$version      = (string) ( $asset['version'] ?? $version );
			}
		}

		$script_position = isset( $settings['script_position'] ) ? $settings['script_position'] : 'head';
		$in_footer       = ( 'footer' === $script_position );

		\wp_enqueue_script(
			$handle,
			$script_url,
			$dependencies,
			$version,
			$in_footer
		);

		$tracking_mode = isset( $settings['tracking_mode'] ) ? (string) $settings['tracking_mode'] : 'failover';
		$frontend_data = \array_merge(
			$this->get_frontend_base_data(),
			array(
				'tracking_mode'        => $tracking_mode,
				'track_outbound_links' => isset( $settings['track_outbound_links'] ) ? (bool) $settings['track_outbound_links'] : false,
				'track_file_downloads' => isset( $settings['track_file_downloads'] ) ? (bool) $settings['track_file_downloads'] : false,
				'is_404'               => \is_404(),
			)
		);

		\wp_localize_script(
			$handle,
			'pplaFrontendData',
			$frontend_data
		);
	}
}
