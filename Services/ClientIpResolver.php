<?php
/**
 * Client IP resolver.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves the current request address using the tracker proxy policy.
 *
 * The resolver is deliberately request-scoped: callers must never persist its
 * return value except in an explicitly configured exclusion list.
 */
class ClientIpResolver {

	private const PROXY_HEADERS = array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR' );

	/**
	 * Returns the request IP, respecting the tracker trusted-proxy setting.
	 *
	 * @param array<string, mixed> $settings Plugin settings.
	 * @return string A validated address or an empty string.
	 */
	public static function resolve_from_server( array $settings ): string {
		$remote_address = isset( $_SERVER['REMOTE_ADDR'] ) && \is_string( $_SERVER['REMOTE_ADDR'] )
			? \sanitize_text_field( \wp_unslash( $_SERVER['REMOTE_ADDR'] ) )
			: '';
		$ip_address     = self::sanitize_header_value( $remote_address );
		$trust_proxy    = isset( $settings['trust_proxy_headers'] ) && (bool) $settings['trust_proxy_headers'];

		if ( ! $trust_proxy ) {
			return $ip_address;
		}

		foreach ( self::PROXY_HEADERS as $header ) {
			$header_value = isset( $_SERVER[ $header ] ) && \is_string( $_SERVER[ $header ] )
				? \sanitize_text_field( \wp_unslash( $_SERVER[ $header ] ) )
				: '';
			$proxy_ip     = self::sanitize_header_value( $header_value );
			if ( '' !== $proxy_ip ) {
				return $proxy_ip;
			}
		}

		return $ip_address;
	}

	/**
	 * Detects a proxied request whose forwarding headers are not trusted.
	 *
	 * The resolved address is then the proxy's own, shared by every visitor it serves.
	 *
	 * @param array<string, mixed> $settings Plugin settings.
	 */
	public static function has_untrusted_proxy_headers( array $settings ): bool {
		if ( isset( $settings['trust_proxy_headers'] ) && (bool) $settings['trust_proxy_headers'] ) {
			return false;
		}

		foreach ( self::PROXY_HEADERS as $header ) {
			if ( ! empty( $_SERVER[ $header ] ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Sanitizes the excluded IP address list submitted in the plugin settings.
	 *
	 * @param mixed $value Untrusted address list.
	 * @return array<int, string> Unique, valid IP addresses.
	 */
	public static function sanitize_ip_list( $value ): array {
		if ( ! \is_array( $value ) ) {
			return array();
		}

		$addresses = array();
		foreach ( $value as $candidate ) {
			$address = \is_string( $candidate ) ? \trim( \sanitize_text_field( $candidate ) ) : '';
			if ( false !== \filter_var( $address, FILTER_VALIDATE_IP ) ) {
				$addresses[] = $address;
			}
		}

		return \array_slice( \array_values( \array_unique( $addresses ) ), 0, 500 );
	}

	/**
	 * Allows only a globally routable address for the self-exclusion workflow.
	 *
	 * @param string $ip_address Validated candidate address.
	 * @return bool Whether the address is public.
	 */
	public static function is_public_address( string $ip_address ): bool {
		return false !== \filter_var(
			$ip_address,
			FILTER_VALIDATE_IP,
			FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
		);
	}

	/**
	 * Extracts the first valid address from a direct or comma-separated header.
	 *
	 * @param string $raw_ip Sanitized header value.
	 * @return string Valid IP address or an empty string.
	 */
	private static function sanitize_header_value( string $raw_ip ): string {
		foreach ( \explode( ',', $raw_ip ) as $candidate ) {
			$candidate = \trim( $candidate );
			if ( false !== \filter_var( $candidate, FILTER_VALIDATE_IP ) ) {
				return $candidate;
			}
		}

		return '';
	}
}
