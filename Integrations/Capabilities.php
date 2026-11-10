<?php
/**
 * Capabilities Integration (Core).
 *
 * Disconnects the plugin's access from the global 'manage_options' capability.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Integrations;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Primeplaced_Logless_Analytics\Engine\Base;

/**
 * Class Capabilities
 */
class Capabilities extends Base {


	/**
	 * Capability required to access global settings (Menu).
	 */
	public const CAP_MANAGE_SETTINGS = 'manage_ppla_settings';

	/**
	 * Capability required to access analytics features.
	 */
	public const CAP_MANAGE_ANALYTICS = 'manage_ppla_analytics';

	/**
	 * Initialize the class and register hooks.
	 *
	 * @return bool True on success, false on failure.
	 */
	public function initialize(): bool {
		if ( ! parent::initialize() ) {
			return false;
		}

		\add_filter( 'user_has_cap', array( $this, 'map_core_permissions' ), 10, 4 );

		return true;
	}

	/**
	 * Grants basic plugin capability to administrators.
	 *
	 * @param array<string, bool> $allcaps All capabilities of the user.
	 * @param array<int, string>  $caps    Requested capabilities.
	 * @param array<int, mixed>   $args    Capability check arguments.
	 * @param \WP_User|null       $user    User being checked.
	 * @return array<string, bool> Modified capabilities.
	 */
	public function map_core_permissions( array $allcaps, array $caps, array $args = array(), ?\WP_User $user = null ): array {
		if ( ! empty( $allcaps['manage_options'] ) ) {
			$allcaps[ self::CAP_MANAGE_SETTINGS ]  = true;
			$allcaps[ self::CAP_MANAGE_ANALYTICS ] = true;
			return $allcaps;
		}

		if ( ! \in_array( self::CAP_MANAGE_ANALYTICS, $caps, true ) || ! $user instanceof \WP_User ) {
			return $allcaps;
		}

		$allowed_roles = \apply_filters( 'ppla_analytics_roles_with_access', array(), $user, $args );
		$allowed_roles = \is_array( $allowed_roles ) ? \array_map( 'sanitize_key', $allowed_roles ) : array();

		if ( array() !== \array_intersect( $user->roles, $allowed_roles ) ) {
			$allcaps[ self::CAP_MANAGE_ANALYTICS ] = true;
		}

		return $allcaps;
	}

	/**
	 * Checks if the current user can manage global plugin settings (Admin).
	 *
	 * @return bool True if the user has the required capability.
	 */
	public static function current_user_can_manage_settings(): bool {
		return \current_user_can( self::CAP_MANAGE_SETTINGS );
	}

	/**
	 * Helper: Check if current user can access analytics.
	 *
	 * @return bool True if the user has the required capability.
	 */
	public static function current_user_can_manage_analytics(): bool {
		return \current_user_can( self::CAP_MANAGE_ANALYTICS );
	}
}
