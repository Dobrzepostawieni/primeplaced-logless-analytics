<?php
/**
 * Tracking Context Sanitizer.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Applies the shared privacy boundary to page and referrer context. */
class TrackingContextSanitizer {

	private const ALLOWED_URL_QUERY_KEYS = array(
		's',
	);

	private const MAX_QUERY_VALUE_LENGTH = 120;

	/**
	 * Reduces a tracked URL to its path and supported report parameters.
	 *
	 * @param string $url Raw tracked URL.
	 */
	public function sanitize_url( string $url ): string {
		$parsed_url = \wp_parse_url( UrlPath::encode_non_ascii( $url ) );
		if ( ! \is_array( $parsed_url ) ) {
			return '/';
		}

		$path = isset( $parsed_url['path'] ) && \is_string( $parsed_url['path'] ) ? $parsed_url['path'] : '/';
		$path = UrlPath::encode( $path );
		$path = \mb_substr( $path, 0, 500 );

		if ( empty( $parsed_url['query'] ) || ! \is_string( $parsed_url['query'] ) ) {
			return $path;
		}

		$query_values = array();
		\wp_parse_str( $parsed_url['query'], $query_values );
		$allowed_values = array();

		foreach ( self::ALLOWED_URL_QUERY_KEYS as $key ) {
			if ( ! isset( $query_values[ $key ] ) || ! \is_scalar( $query_values[ $key ] ) ) {
				continue;
			}

			$value = \mb_substr( \sanitize_text_field( (string) $query_values[ $key ] ), 0, self::MAX_QUERY_VALUE_LENGTH );
			if ( '' === $value || $this->contains_obvious_personal_data( $value ) ) {
				continue;
			}

			$allowed_values[ $key ] = $value;
		}

		return empty( $allowed_values ) ? $path : \add_query_arg( $allowed_values, $path );
	}

	/**
	 * Classifies a URL's paid acquisition channel without retaining campaign data.
	 *
	 * This must run before sanitize_url(): campaign parameters are intentionally
	 * discarded from the persisted URL after this finite classification step.
	 *
	 * @param string $url Raw tracked URL.
	 * @return string `google_ads`, `meta_ads`, or an empty value.
	 */
	public function get_acquisition_channel( string $url ): string {
		$parsed_url = \wp_parse_url( $url );
		if ( ! \is_array( $parsed_url ) || empty( $parsed_url['query'] ) || ! \is_string( $parsed_url['query'] ) ) {
			return '';
		}

		$query_values = array();
		\wp_parse_str( $parsed_url['query'], $query_values );
		$gclid  = isset( $query_values['gclid'] ) && \is_scalar( $query_values['gclid'] ) ? \trim( (string) $query_values['gclid'] ) : '';
		$source = isset( $query_values['utm_source'] ) && \is_scalar( $query_values['utm_source'] ) ? \strtolower( \trim( (string) $query_values['utm_source'] ) ) : '';
		$medium = isset( $query_values['utm_medium'] ) && \is_scalar( $query_values['utm_medium'] ) ? \strtolower( \trim( (string) $query_values['utm_medium'] ) ) : '';

		if ( '' !== $gclid || ( \in_array( $source, array( 'google', 'googleads', 'google_ads', 'google-ads', 'adwords' ), true ) && \in_array( $medium, array( 'cpc', 'ppc', 'paid_search', 'paidsearch' ), true ) ) ) {
			return 'google_ads';
		}

		if ( \in_array( $source, array( 'facebook', 'meta', 'instagram' ), true ) && \in_array( $medium, array( 'paid_social', 'paidsocial', 'cpc', 'ppc', 'paid' ), true ) ) {
			return 'meta_ads';
		}

		return '';
	}

	/**
	 * Detects values that are clearly unsuitable for an analytics URL context.
	 *
	 * This is deliberately limited to common e-mail addresses and phone numbers;
	 * the allowlist above remains the primary privacy boundary for query keys.
	 *
	 * @param string $value Sanitized query parameter value.
	 */
	private function contains_obvious_personal_data( string $value ): bool {
		return 1 === \preg_match( '/[^\s@]+@[^\s@]+\.[^\s@]+/', $value )
			|| 1 === \preg_match( '/(?:\+?\d[\s().-]*){8,}/', $value );
	}

	/**
	 * Reduces a referrer to an HTTP(S) origin.
	 *
	 * @param string $referrer Raw referrer URL.
	 */
	public function sanitize_referrer( string $referrer ): string {
		$parsed_referrer = \wp_parse_url( $referrer );
		if ( ! \is_array( $parsed_referrer ) || empty( $parsed_referrer['host'] ) ) {
			return '';
		}

		$scheme = isset( $parsed_referrer['scheme'] ) ? \strtolower( (string) $parsed_referrer['scheme'] ) : '';
		if ( ! \in_array( $scheme, array( 'http', 'https' ), true ) ) {
			return '';
		}

		$host = \sanitize_text_field( (string) $parsed_referrer['host'] );
		$port = isset( $parsed_referrer['port'] ) ? ':' . (int) $parsed_referrer['port'] : '';

		return \mb_substr( $scheme . '://' . $host . $port, 0, 500 );
	}
}
