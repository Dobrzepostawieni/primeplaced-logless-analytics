<?php
/**
 * URL path normalizer.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalizes a URL path to the percent-encoded form browsers send.
 *
 * Stored paths, report filters and visual-rule paths share this form, so
 * non-ASCII slugs keep their octets and compare equal however they arrive.
 */
final class UrlPath {

	/**
	 * Percent-encodes raw non-ASCII bytes before a URL is parsed.
	 *
	 * PHP's URL parser replaces some UTF-8 continuation bytes with `_`.
	 *
	 * @param string $url Raw URL or path.
	 */
	public static function encode_non_ascii( string $url ): string {
		return (string) \preg_replace_callback(
			'/[\x80-\xFF]/',
			static fn ( array $found ): string => \rawurlencode( $found[0] ),
			$url
		);
	}

	/**
	 * Percent-encodes a path like the WHATWG path encode set, with uppercase hex.
	 *
	 * Valid `%XX` octets are kept, raw non-ASCII bytes, controls, spaces and
	 * markup-significant characters are encoded, and a leading slash is added.
	 *
	 * @param string $path Raw or encoded path.
	 */
	public static function encode( string $path ): string {
		$encoded = \preg_replace_callback(
			'/%(?![0-9A-Fa-f]{2})|[\x00-\x20"#<>?`{}\x7F-\xFF]/',
			static fn ( array $found ): string => \rawurlencode( $found[0] ),
			$path
		);
		$encoded = \preg_replace_callback(
			'/%[0-9a-f]{2}/i',
			static fn ( array $found ): string => \strtoupper( $found[0] ),
			(string) $encoded
		);

		return '/' . \ltrim( (string) $encoded, '/' );
	}

	/**
	 * Returns the bounded Event Contract key for an encoded path.
	 *
	 * Paths up to the 64-character column limit are stored as-is; longer
	 * paths are stored as their SHA-256 hex digest so they never collide by
	 * prefix. Readers hash a filter path the same way.
	 *
	 * @param string $path Path in UrlPath::encode() form.
	 */
	public static function subject_key( string $path ): string {
		return \strlen( $path ) <= 64 ? $path : \hash( 'sha256', $path );
	}

	/**
	 * Resolves the full path of a stored path subject for display.
	 *
	 * @param string $subject_key Stored subject key.
	 * @param mixed  $attributes  Stored attributes JSON.
	 */
	public static function from_subject( string $subject_key, $attributes ): string {
		$decoded = \is_string( $attributes ) ? \json_decode( $attributes, true ) : null;
		$path    = \is_array( $decoded ) && isset( $decoded['path'] ) && \is_string( $decoded['path'] ) ? $decoded['path'] : '';

		return '' !== $path && self::subject_key( $path ) === $subject_key ? $path : $subject_key;
	}
}
