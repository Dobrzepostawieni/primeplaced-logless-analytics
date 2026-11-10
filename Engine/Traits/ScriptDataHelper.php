<?php
/**
 * Script Data Helper Trait.
 *
 * Provides shared utility methods for preparing base localized JavaScript data.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Engine\Traits;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Primeplaced_Logless_Analytics\Integrations\Capabilities;
use Primeplaced_Logless_Analytics\Services\EventFeaturePolicy;

/**
 * Trait ScriptDataHelper
 */
trait ScriptDataHelper {

	/**
	 * Returns the foundational data required by almost all React apps in the plugin.
	 *
	 * @return array<string, mixed> Base script data array.
	 */
	protected function get_common_data(): array {
		$event_policy = new EventFeaturePolicy();
		$features     = $event_policy->get_public_features();

		return array(
			'rest_url'       => \esc_url_raw( \rest_url( \PPLA_API_NAMESPACE ) ),
			'admin_ajax_url' => \esc_url_raw( \admin_url( 'admin-ajax.php' ) ),
			'active_plan'    => isset( $features['plan'] ) && \is_string( $features['plan'] ) ? $features['plan'] : 'free',
			'event_features' => $features,
		);
	}

	/**
	 * Returns the foundational data required by backend/admin React apps.
	 *
	 * @return array<string, mixed> Base script data array.
	 */
	protected function get_admin_base_data(): array {
		return \array_merge(
			$this->get_common_data(),
			array(
				'nonce'               => \wp_create_nonce( 'wp_rest' ),
				'can_manage_settings' => Capabilities::current_user_can_manage_settings(),
				'is_premium'          => false,
				'has_fs_error'        => false,
				'site_url'            => \esc_url_raw( \home_url( '/' ) ),
			)
		);
	}

	/**
	 * Returns the safe, restricted data required by frontend React apps.
	 *
	 * @return array<string, mixed> Base public script data array.
	 */
	protected function get_frontend_base_data(): array {
		return $this->get_common_data();
	}
}
