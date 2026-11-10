<?php
/**
 * Shared byte limits for public tracking requests.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Enforces a transport-independent logical envelope and an independent wire ceiling.
 */
class TrackingRequestBudget {
	public const MAX_LOGICAL_BYTES = 65536;
	public const MAX_WIRE_BYTES    = 262144;

	/**
	 * Measures the canonical, transport-independent request envelope.
	 *
	 * @param array<string,mixed> $payload Known tracking fields only.
	 * @return int|null Encoded UTF-8 byte count, or null when the envelope is invalid.
	 */
	public function measure_logical_bytes( array $payload ): ?int {
		$normalized = $this->normalize_logical_payload( $payload );
		if ( null === $normalized ) {
			return null;
		}

		if ( \function_exists( 'wp_json_encode' ) ) {
			$encoded = \wp_json_encode( $normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		} else {
			// The isolated unit bootstrap has no WordPress encoder.
			// phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode
			$encoded = \json_encode( $normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		}
		return is_string( $encoded ) ? strlen( $encoded ) : null;
	}

	/**
	 * Produces the shared envelope used by the byte measurement and ingestion.
	 *
	 * @param array<string,mixed> $payload Request fields, including unknown extras.
	 * @return array<string,mixed>|null Canonical fields and preserved extras, or null for invalid input.
	 */
	public function normalize_logical_payload( array $payload ): ?array {
		$normalized = array();
		foreach ( array( 'url', 'referrer', 'hit_id', 'device_hint' ) as $field ) {
			$value = $payload[ $field ] ?? '';
			if ( ! is_string( $value ) ) {
				return null;
			}
			$normalized[ $field ] = $value;
		}

		$pageview = $payload['record_pageview'] ?? false;
		if ( is_bool( $pageview ) ) {
			$normalized['record_pageview'] = $pageview;
		} elseif ( '1' === $pageview || 'true' === $pageview ) {
			$normalized['record_pageview'] = true;
		} elseif ( '0' === $pageview || 'false' === $pageview || '' === $pageview ) {
			$normalized['record_pageview'] = false;
		} else {
			return null;
		}

		$events = $payload['events'] ?? array();
		if ( is_string( $events ) ) {
			if ( '' === $events ) {
				$events = array();
			} else {
				$events = json_decode( $events, true );
			}
		}
		if ( ! is_array( $events ) ) {
			return null;
		}
		$normalized['events'] = $events;

		// Preserve unrecognized input so extension fields cannot bypass the limit.
		foreach ( $payload as $field => $value ) {
			if ( array_key_exists( $field, $normalized ) ) {
				continue;
			}
			$normalized[ $field ] = $value;
		}

		return $normalized;
	}

	/**
	 * Checks raw wire bytes and, when supplied, the server's declared body length.
	 *
	 * @param string      $body            Unmodified request body bytes.
	 * @param string|null $content_length  Content-Length reported by the server.
	 */
	public function allows_wire_body( string $body, ?string $content_length = null ): bool {
		if ( strlen( $body ) > self::MAX_WIRE_BYTES ) {
			return false;
		}

		return null === $content_length || ! ctype_digit( $content_length ) || (int) $content_length <= self::MAX_WIRE_BYTES;
	}
}
