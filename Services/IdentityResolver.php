<?php
/**
 * Identity Resolver Service.
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
 * Class IdentityResolver
 *
 * Generates cookieless pseudonymized session hashes with daily salt rotation.
 */
class IdentityResolver extends Base {

	/**
	 * Transient key for storing the daily salt.
	 */
	private const SALT_TRANSIENT_KEY = 'ppla_daily_salt';

	/**
	 * Generate a unique session hash for the current visitor.
	 *
	 * Formula: hash(daily_salt + site_domain + IP_address + User-Agent)
	 *
	 * @param string $ip_address Visitor IP address.
	 * @param string $user_agent Visitor User-Agent string.
	 * @return string The 64-character session hash.
	 */
	public function generate_session_hash( string $ip_address, string $user_agent ): string {
		$salt   = $this->get_daily_salt();
		$domain = isset( $_SERVER['HTTP_HOST'] ) ? \sanitize_text_field( \wp_unslash( $_SERVER['HTTP_HOST'] ) ) : '';

		return \hash( 'sha256', $salt . $domain . $ip_address . $user_agent );
	}

	/**
	 * Returns today's random salt, creating a new one after local midnight.
	 *
	 * The salt expires at the next site-local midnight, so session hashes from
	 * different days cannot be linked.
	 *
	 * @return string Cryptographically secure salt.
	 */
	private function get_daily_salt(): string {
		$salt = \get_transient( self::SALT_TRANSIENT_KEY );

		if ( false !== $salt && \is_string( $salt ) ) {
			return $salt;
		}

		$salt = \bin2hex( \random_bytes( 32 ) );

		$now    = \current_datetime();
		$target = $now->modify( 'tomorrow midnight' );

		$seconds_to_live = $target ? $target->getTimestamp() - $now->getTimestamp() : DAY_IN_SECONDS;

		if ( $seconds_to_live <= 0 ) {
			$seconds_to_live = DAY_IN_SECONDS;
		}

		\set_transient( self::SALT_TRANSIENT_KEY, $salt, $seconds_to_live );

		return $salt;
	}

	/**
	 * Immediately forces salt rotation by deleting the current transient.
	 * This invalidates all current session hashes.
	 */
	public function rotate_salt(): void {
		\delete_transient( self::SALT_TRANSIENT_KEY );
	}
}
