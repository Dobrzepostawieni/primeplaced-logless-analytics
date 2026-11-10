<?php
/**
 * Public tracking rate limiter.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Applies an approximate, privacy-safe request limit to public tracking ingress.
 *
 * The transient read/compare/write sequence can admit extra requests when
 * concurrent PHP workers increment the same source bucket at once.
 */
class TrackingRateLimiter {

	private const DEFAULT_MAX_REQUESTS_PER_WINDOW = 600;
	private const WINDOW_SECONDS                  = MINUTE_IN_SECONDS;
	private const TRANSIENT_PREFIX                = 'ppla_tracking_rate_';

	private int $default_max_requests;

	/**
	 * Creates the limiter.
	 *
	 * @param int $default_max_requests Maximum requests per source in one window.
	 */
	public function __construct( int $default_max_requests = self::DEFAULT_MAX_REQUESTS_PER_WINDOW ) {
		$this->default_max_requests = \max( 1, $default_max_requests );
	}

	/**
	 * Consumes one request from an opaque source budget.
	 *
	 * Empty source addresses fail open because a shared anonymous bucket would
	 * otherwise reject unrelated visitors behind an unavailable proxy context.
	 *
	 * @param string $ip_address Valid request IP used only in memory to derive the transient key.
	 * @return bool True when the approximate request budget allows this request.
	 */
	public function allows_request( string $ip_address ): bool {
		if ( '' === $ip_address ) {
			return true;
		}

		$limit = $this->default_max_requests;

		$ppla_rate_key = self::TRANSIENT_PREFIX . \substr( \hash_hmac( 'sha256', $ip_address, \wp_salt( 'nonce' ) ), 0, 40 );
		$bucket        = \get_transient( $ppla_rate_key );
		$now           = \time();
		$count         = \is_array( $bucket ) ? (int) ( $bucket['count'] ?? 0 ) : 0;
		$reset_at      = \is_array( $bucket ) ? (int) ( $bucket['reset_at'] ?? 0 ) : 0;

		// A fixed window: rewriting the transient must not push its expiry forward.
		if ( $reset_at <= $now ) {
			$count    = 0;
			$reset_at = $now + self::WINDOW_SECONDS;
		}

		if ( $count >= $limit ) {
			return false;
		}

		\set_transient(
			$ppla_rate_key,
			array(
				'count'    => $count + 1,
				'reset_at' => $reset_at,
			),
			$reset_at - $now
		);

		return true;
	}
}
