<?php
/**
 * Device Detector Service.
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
 * Class DeviceDetector
 *
 * Parses User-Agent headers to segment traffic into Desktop, Tablet, and Mobile.
 */
class DeviceDetector extends Base {

	/**
	 * Detect device category from a User-Agent string.
	 *
	 * @param string $user_agent Raw User-Agent header value.
	 * @return string Device type: 'desktop', 'tablet', or 'mobile'.
	 */
	public function detect_device( string $user_agent ): string {
		$ua = \strtolower( $user_agent );

		if ( \preg_match( '/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i', $ua ) ) {
			return 'tablet';
		}

		if ( \preg_match( '/(up\.browser|up\.link|mmp|symbian|smartphone|midp|wap|phone|android|iemobile|chtml|blackberry|opera mini)/i', $ua ) ) {
			return 'mobile';
		}

		return 'desktop';
	}
}
