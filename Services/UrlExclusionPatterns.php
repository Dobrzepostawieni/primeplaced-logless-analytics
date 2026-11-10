<?php
/**
 * Excluded URL patterns.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Sanitizes and matches the URL paths an administrator excludes from tracking.
 *
 * A pattern is a site path such as `/checkout/`. An asterisk matches any run of
 * characters, so `/blog/*` excludes every post below `/blog/`. Matching is
 * case-insensitive, ignores the query string and treats a trailing slash as
 * optional.
 */
final class UrlExclusionPatterns {

	/** Maximum number of stored patterns. */
	public const MAX_PATTERNS = 100;

	/** Maximum length of one pattern. */
	public const MAX_LENGTH = 255;

	/** Prevents instantiation. */
	private function __construct() {}

	/**
	 * Sanitizes the pattern list submitted in the plugin settings.
	 *
	 * @param mixed $value Untrusted pattern list.
	 * @return array<int, string> Unique, normalized patterns.
	 */
	public static function sanitize( $value ): array {
		if ( ! \is_array( $value ) ) {
			return array();
		}

		$patterns = array();
		foreach ( $value as $candidate ) {
			if ( ! \is_string( $candidate ) ) {
				continue;
			}

			$candidate = \trim( \sanitize_text_field( $candidate ) );
			if ( false !== \strpos( $candidate, '://' ) ) {
				$candidate = (string) \wp_parse_url( $candidate, PHP_URL_PATH );
			}

			$pattern = self::normalize_path( $candidate );
			if ( '' !== \trim( $candidate ) && \strlen( $pattern ) <= self::MAX_LENGTH ) {
				$patterns[] = $pattern;
			}
		}

		return \array_slice( \array_values( \array_unique( $patterns ) ), 0, self::MAX_PATTERNS );
	}

	/**
	 * Checks whether a tracked URL matches any excluded pattern.
	 *
	 * @param array<int, mixed> $patterns Stored patterns.
	 * @param string            $url      Tracked URL or path.
	 */
	public static function matches_any( array $patterns, string $url ): bool {
		$path = self::normalize_path( (string) \wp_parse_url( $url, PHP_URL_PATH ) );

		foreach ( $patterns as $pattern ) {
			if ( \is_string( $pattern ) && '' !== $pattern && 1 === \preg_match( self::to_regex( $pattern ), $path ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Converts a wildcard pattern into an anchored regular expression.
	 *
	 * Every character except the asterisk is quoted, so the result is always valid.
	 *
	 * @param string $pattern Stored pattern.
	 */
	private static function to_regex( string $pattern ): string {
		$parts = \array_map(
			static function ( string $part ): string {
				return \preg_quote( $part, '~' );
			},
			\explode( '*', self::normalize_path( $pattern ) )
		);

		return '~^' . \implode( '.*', $parts ) . '$~i';
	}

	/**
	 * Returns a path with one leading slash and no trailing slash, except for the site root.
	 *
	 * @param string $path Raw path or pattern.
	 */
	private static function normalize_path( string $path ): string {
		$path = '/' . \ltrim( \trim( $path ), '/' );

		return '/' === $path ? $path : \rtrim( $path, '/' );
	}
}
