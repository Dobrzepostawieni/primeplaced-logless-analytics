<?php
/**
 * Retention Policy Service.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Services;

use Primeplaced_Logless_Analytics\Engine\Base;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves how long analytics data is kept, as chosen by the site administrator.
 */
class RetentionPolicy extends Base {

	/** Retention used until the administrator chooses another period. */
	public const DEFAULT_DAYS = 30;

	/**
	 * Retention periods offered in the settings, in days. Zero keeps data until
	 * the administrator deletes it.
	 */
	public const ALLOWED_DAYS = array( 30, 90, 180, 365, 0 );

	/**
	 * Returns the number of days to keep analytics data, or zero to keep it indefinitely.
	 */
	public function get_effective_days(): int {
		$settings = \get_option( 'ppla_settings', array() );
		$days     = \is_array( $settings ) && isset( $settings['data_retention'] ) && \is_numeric( $settings['data_retention'] )
			? (int) $settings['data_retention']
			: self::DEFAULT_DAYS;

		return \in_array( $days, self::ALLOWED_DAYS, true ) ? $days : self::DEFAULT_DAYS;
	}
}
