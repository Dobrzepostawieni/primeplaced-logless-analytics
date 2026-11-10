<?php
/**
 * Shared report-query value object.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Services;

use WP_REST_Request;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalizes generic report range, comparison and named filter parameters.
 *
 * Core owns the neutral request contract. Premium reports choose which filter
 * names they support, so this class never exposes premium data on its own.
 */
final class ReportQuery {

	public const COMPARISON_NONE            = 'none';
	public const COMPARISON_PREVIOUS_PERIOD = 'previous_period';

	/**
	 * Active normalized filters.
	 *
	 * @var array<string, string>
	 */
	private array $filters;

	/** Number of days in the primary report period. */
	private int $range;

	/** Comparison mode selected by the user. */
	private string $comparison;

	/**
	 * Creates a normalized report-query value object.
	 *
	 * @param int|null             $range      Number of report days; defaults to 30 during container discovery.
	 * @param string               $comparison Comparison mode.
	 * @param array<string,string> $filters    Normalized named filters.
	 */
	public function __construct( ?int $range = null, string $comparison = self::COMPARISON_NONE, array $filters = array() ) {
		$this->range      = \max( 1, \min( 3660, $range ?? 30 ) );
		$this->comparison = self::COMPARISON_PREVIOUS_PERIOD === $comparison
			? self::COMPARISON_PREVIOUS_PERIOD
			: self::COMPARISON_NONE;
		$this->filters    = $filters;
	}

	/**
	 * Builds a report query from standard REST parameters.
	 *
	 * A report declares its supported `$filter_types`, for example
	 * `array( 'source' => 'text', 'provider' => 'key' )`. Values arrive as
	 * `filter_source` and `filter_provider`; unknown parameters are ignored.
	 *
	 * @param WP_REST_Request      $request      Current REST request.
	 * @param array<string,string> $filter_types Allowed filter names and types.
	 */
	public static function from_request( WP_REST_Request $request, array $filter_types = array() ): self {
		$range      = $request->get_param( 'range' );
		$comparison = \sanitize_key( (string) $request->get_param( 'comparison' ) );
		$filters    = array();

		foreach ( $filter_types as $name => $type ) {
			$filter_name = \sanitize_key( $name );
			if ( '' === $filter_name ) {
				continue;
			}

			$value = $request->get_param( 'filter_' . $filter_name );
			if ( ! \is_string( $value ) || '' === \trim( $value ) ) {
				continue;
			}

			$normalized = self::normalize_filter_value( $value, $type );
			if ( '' !== $normalized ) {
				$filters[ $filter_name ] = $normalized;
			}
		}

		return new self(
			\is_numeric( $range ) ? (int) $range : 30,
			$comparison,
			$filters
		);
	}

	/** Primary reporting-window length. */
	public function get_range(): int {
		return $this->range;
	}

	/** Active comparison mode. */
	public function get_comparison(): string {
		return $this->comparison;
	}

	/** Whether the preceding, equal-length period should be returned. */
	public function compares_previous_period(): bool {
		return self::COMPARISON_PREVIOUS_PERIOD === $this->comparison;
	}

	/**
	 * Returns every active named filter.
	 *
	 * @return array<string,string> Normalized active filters.
	 */
	public function get_filters(): array {
		return $this->filters;
	}

	/**
	 * Gets one named filter or an empty string when no filter is active.
	 *
	 * @param string $name Filter name.
	 */
	public function get_filter( string $name ): string {
		return $this->filters[ $name ] ?? '';
	}

	/**
	 * Returns whether any filter in the supplied group is active.
	 *
	 * @param array<int,string> $names Filter names.
	 */
	public function has_any_filter( array $names ): bool {
		foreach ( $names as $name ) {
			if ( '' !== $this->get_filter( $name ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Normalizes one string filter using a report-declared safe type.
	 *
	 * @param string $value Raw request value.
	 * @param string $type  `key`, `path` or `text`.
	 */
	private static function normalize_filter_value( string $value, string $type ): string {
		$value = \trim( $value );
		if ( '(not set)' === $value ) {
			return $value;
		}

		if ( 'key' === $type ) {
			return \mb_substr( \sanitize_key( $value ), 0, 120 );
		}

		if ( 'path' === $type ) {
			$path = \sanitize_text_field( $value );
			return \mb_substr( '/' . \ltrim( $path, '/' ), 0, 500 );
		}

		return \mb_substr( \sanitize_text_field( $value ), 0, 500 );
	}
}
