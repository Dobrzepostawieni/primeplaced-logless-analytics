<?php
/**
 * Base component definition.
 *
 * @package   Primeplaced_Logless_Analytics
 * @author    Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright 2026 Dobrzepostawieni.pl
 * @license   GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Engine;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Base class for all components.
 */
abstract class Base {

	/**
	 * Initializes the component logic.
	 *
	 * @return bool True on success.
	 */
	public function initialize(): bool {
		return true;
	}
}
