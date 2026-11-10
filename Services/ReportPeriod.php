<?php
/**
 * Neutral, site-timezone-aware reporting period.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Represents an inclusive date range as full site-local calendar days.
 *
 * The end boundary is exclusive internally, so repositories can use it directly
 * in `created_at >= start AND created_at < end` queries without losing the
 * final calendar day.
 */
final class ReportPeriod {

	public const PRESET_LAST_7_DAYS  = 'last_7_days';
	public const PRESET_LAST_30_DAYS = 'last_30_days';
	public const PRESET_LAST_90_DAYS = 'last_90_days';
	public const PRESET_THIS_MONTH   = 'this_month';
	public const PRESET_LAST_MONTH   = 'last_month';

	public const COMPARISON_NONE            = 'none';
	public const COMPARISON_PREVIOUS_PERIOD = 'previous_period';
	public const COMPARISON_PREVIOUS_YEAR   = 'previous_year';
	public const COMPARISON_CUSTOM          = 'custom';

	private const MAX_DAYS = 3660;

	/** Inclusive first day at 00:00:00 in the site timezone. */
	private \DateTimeImmutable $start;

	/** Exclusive day after the final included day at 00:00:00. */
	private \DateTimeImmutable $end;

	private ?self $comparison_period;

	/**
	 * Creates a full-day reporting period.
	 *
	 * @param \DateTimeImmutable $start             Inclusive local start boundary.
	 * @param \DateTimeImmutable $end               Exclusive local end boundary.
	 * @param self|null          $comparison_period Optional comparison period.
	 */
	private function __construct( \DateTimeImmutable $start, \DateTimeImmutable $end, ?self $comparison_period = null ) {
		$this->start             = $start;
		$this->end               = $end;
		$this->comparison_period = $comparison_period;
	}

	/**
	 * Builds a period from REST-safe scalar input without depending on a route.
	 *
	 * `start_date` and `end_date` take precedence over the numeric `range`.
	 * Both dates are inclusive and must be supplied together. Supported presets
	 * are useful to UI callers; API callers normally send the resolved dates.
	 *
	 * @param array<string,mixed>     $input    Request-like scalar input.
	 * @param \DateTimeZone           $timezone Site timezone.
	 * @param \DateTimeImmutable|null $now      Testable current time override.
	 * @throws \InvalidArgumentException When input cannot form a safe full-day period.
	 */
	public static function from_input( array $input, \DateTimeZone $timezone, ?\DateTimeImmutable $now = null ): self {
		$start_date = self::input_string( $input, 'start_date' );
		$end_date   = self::input_string( $input, 'end_date' );

		if ( '' !== $start_date || '' !== $end_date ) {
			if ( '' === $start_date || '' === $end_date ) {
				throw new \InvalidArgumentException( 'Both start_date and end_date are required.' );
			}

			$primary = self::from_dates( $start_date, $end_date, $timezone );
		} else {
			$preset  = self::input_string( $input, 'preset' );
			$primary = '' !== $preset
				? self::from_preset( $preset, $timezone, $now )
				: self::from_range( self::input_range( $input ), $timezone, $now );
		}

		$comparison        = self::input_string( $input, 'comparison' );
		$comparison_period = self::build_comparison_period( $primary, $comparison, $input, $timezone );

		return new self( $primary->start, $primary->end, $comparison_period );
	}

	/**
	 * Builds one custom period from two inclusive ISO dates.
	 *
	 * @param string        $start_date Inclusive ISO start date.
	 * @param string        $end_date   Inclusive ISO end date.
	 * @param \DateTimeZone $timezone   Site timezone.
	 * @throws \InvalidArgumentException When dates are invalid, reversed or too long.
	 */
	public static function from_dates( string $start_date, string $end_date, \DateTimeZone $timezone ): self {
		$start = self::parse_date( $start_date, $timezone );
		$end   = self::parse_date( $end_date, $timezone );

		if ( $end < $start ) {
			throw new \InvalidArgumentException( 'end_date must not precede start_date.' );
		}

		return self::from_boundaries( $start, $end->modify( '+1 day' ), $timezone );
	}

	/**
	 * Builds a predefined site-local period.
	 *
	 * @param string                  $preset   Supported period preset.
	 * @param \DateTimeZone           $timezone Site timezone.
	 * @param \DateTimeImmutable|null $now      Testable current time override.
	 * @throws \InvalidArgumentException When the preset is unsupported.
	 */
	public static function from_preset( string $preset, \DateTimeZone $timezone, ?\DateTimeImmutable $now = null ): self {
		$today = ( $now ?? new \DateTimeImmutable( 'now', $timezone ) )
			->setTimezone( $timezone )
			->setTime( 0, 0, 0 );

		switch ( $preset ) {
			case self::PRESET_LAST_7_DAYS:
				return self::from_boundaries( $today->modify( '-6 days' ), $today->modify( '+1 day' ), $timezone );
			case self::PRESET_LAST_30_DAYS:
				return self::from_boundaries( $today->modify( '-29 days' ), $today->modify( '+1 day' ), $timezone );
			case self::PRESET_LAST_90_DAYS:
				return self::from_boundaries( $today->modify( '-89 days' ), $today->modify( '+1 day' ), $timezone );
			case self::PRESET_THIS_MONTH:
				$start = $today->modify( 'first day of this month' )->setTime( 0, 0, 0 );
				return self::from_boundaries( $start, $start->modify( '+1 month' ), $timezone );
			case self::PRESET_LAST_MONTH:
				$end = $today->modify( 'first day of this month' )->setTime( 0, 0, 0 );
				return self::from_boundaries( $end->modify( '-1 month' ), $end, $timezone );
			default:
				throw new \InvalidArgumentException( 'Unsupported report-period preset.' );
		}
	}

	/**
	 * Returns the inclusive start date in the site timezone.
	 */
	public function get_start_date(): string {
		return $this->start->format( 'Y-m-d' );
	}

	/**
	 * Returns the inclusive final date in the site timezone.
	 */
	public function get_end_date(): string {
		return $this->end->modify( '-1 day' )->format( 'Y-m-d' );
	}

	/**
	 * Returns the SQL-safe inclusive start boundary.
	 */
	public function get_start_datetime(): string {
		return $this->start->format( 'Y-m-d H:i:s' );
	}

	/**
	 * Returns the SQL-safe exclusive end boundary.
	 */
	public function get_end_datetime(): string {
		return $this->end->format( 'Y-m-d H:i:s' );
	}

	/**
	 * Returns the number of included calendar days.
	 */
	public function get_day_count(): int {
		return (int) $this->start->diff( $this->end )->days;
	}

	/**
	 * Returns the configured comparison period, if any.
	 */
	public function get_comparison_period(): ?self {
		return $this->comparison_period;
	}

	/**
	 * Converts the period into an additive REST response value.
	 *
	 * @return array{start_date:string,end_date:string,start_datetime:string,end_datetime:string,days:int}
	 */
	public function to_array(): array {
		return array(
			'start_date'     => $this->get_start_date(),
			'end_date'       => $this->get_end_date(),
			'start_datetime' => $this->get_start_datetime(),
			'end_datetime'   => $this->get_end_datetime(),
			'days'           => $this->get_day_count(),
		);
	}

	/**
	 * Builds a numeric range as full days ending today.
	 *
	 * @param int                     $range    Number of included days.
	 * @param \DateTimeZone           $timezone Site timezone.
	 * @param \DateTimeImmutable|null $now      Testable current time override.
	 */
	private static function from_range( int $range, \DateTimeZone $timezone, ?\DateTimeImmutable $now ): self {
		$today = ( $now ?? new \DateTimeImmutable( 'now', $timezone ) )
			->setTimezone( $timezone )
			->setTime( 0, 0, 0 );

		return self::from_boundaries( $today->modify( '-' . ( $range - 1 ) . ' days' ), $today->modify( '+1 day' ), $timezone );
	}

	/**
	 * Builds one optional comparison period from safe primary boundaries.
	 *
	 * @param self                $primary  Primary period without comparison.
	 * @param string              $mode     Requested comparison mode.
	 * @param array<string,mixed> $input    Request-like scalar input.
	 * @param \DateTimeZone       $timezone Site timezone.
	 * @throws \InvalidArgumentException When comparison input is invalid.
	 */
	private static function build_comparison_period( self $primary, string $mode, array $input, \DateTimeZone $timezone ): ?self {
		if ( '' === $mode || self::COMPARISON_NONE === $mode ) {
			return null;
		}

		if ( self::COMPARISON_PREVIOUS_PERIOD === $mode ) {
			$end   = $primary->start;
			$start = $end->modify( '-' . $primary->get_day_count() . ' days' );
			return self::from_boundaries( $start, $end, $timezone );
		}

		if ( self::COMPARISON_PREVIOUS_YEAR === $mode ) {
			return self::from_boundaries(
				$primary->start->modify( '-1 year' ),
				$primary->end->modify( '-1 year' ),
				$timezone
			);
		}

		if ( self::COMPARISON_CUSTOM === $mode ) {
			$start_date = self::input_string( $input, 'comparison_start_date' );
			$end_date   = self::input_string( $input, 'comparison_end_date' );
			if ( '' === $start_date || '' === $end_date ) {
				throw new \InvalidArgumentException( 'Both comparison dates are required for a custom comparison.' );
			}

			return self::from_dates( $start_date, $end_date, $timezone );
		}

		throw new \InvalidArgumentException( 'Unsupported report-period comparison.' );
	}

	/**
	 * Creates one period from already validated exclusive boundaries.
	 *
	 * @param \DateTimeImmutable $start    Inclusive local start boundary.
	 * @param \DateTimeImmutable $end      Exclusive local end boundary.
	 * @param \DateTimeZone      $timezone Site timezone.
	 * @throws \InvalidArgumentException When boundaries do not represent 1–3660 full days.
	 */
	private static function from_boundaries( \DateTimeImmutable $start, \DateTimeImmutable $end, \DateTimeZone $timezone ): self {
		$start = $start->setTimezone( $timezone )->setTime( 0, 0, 0 );
		$end   = $end->setTimezone( $timezone )->setTime( 0, 0, 0 );
		$days  = (int) $start->diff( $end )->days;

		if ( $end <= $start || $days > self::MAX_DAYS ) {
			throw new \InvalidArgumentException( 'Report periods must cover between 1 and 3660 full days.' );
		}

		return new self( $start, $end );
	}

	/**
	 * Parses one strict ISO calendar date in the site timezone.
	 *
	 * @param string        $value    ISO calendar date.
	 * @param \DateTimeZone $timezone Site timezone.
	 * @throws \InvalidArgumentException When the value is not an ISO date.
	 */
	private static function parse_date( string $value, \DateTimeZone $timezone ): \DateTimeImmutable {
		if ( 1 !== \preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
			throw new \InvalidArgumentException( 'Dates must use the YYYY-MM-DD format.' );
		}

		$date   = \DateTimeImmutable::createFromFormat( '!Y-m-d', $value, $timezone );
		$errors = \DateTimeImmutable::getLastErrors();
		if ( false === $date || ( \is_array( $errors ) && ( $errors['warning_count'] > 0 || $errors['error_count'] > 0 ) ) ) {
			throw new \InvalidArgumentException( 'Dates must be valid calendar dates.' );
		}

		return $date->setTime( 0, 0, 0 );
	}

	/**
	 * Reads one scalar input as trimmed text.
	 *
	 * @param array<string,mixed> $input Request-like scalar input.
	 * @param string              $key   Input key.
	 */
	private static function input_string( array $input, string $key ): string {
		$value = $input[ $key ] ?? '';
		return \is_string( $value ) || \is_numeric( $value ) ? \trim( (string) $value ) : '';
	}

	/**
	 * Validates the current numeric range input: zero falls back to 30 and high values clamp.
	 *
	 * @param array<string,mixed> $input Request-like scalar input.
	 */
	private static function input_range( array $input ): int {
		$value = $input['range'] ?? 30;
		$range = \is_numeric( $value ) ? (int) $value : 30;
		if ( $range < 1 ) {
			return 30;
		}

		return \min( self::MAX_DAYS, $range );
	}
}
