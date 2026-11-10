<?php
/**
 * Privacy mode history service.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Services;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Keeps a short, privacy-safe record of analytics mode changes.
 *
 * The history contains only mode transitions and UTC timestamps. It is used to
 * explain why reports spanning a transition may not be directly comparable.
 */
class PrivacyModeHistory {

	private const OPTION = 'ppla_privacy_history';

	private const LIMIT = 12;

	/**
	 * Records a mode transition after the settings option has changed.
	 *
	 * @param array<string,mixed>|string|int|float|bool|null $old_value Previous settings value.
	 * @param array<string,mixed>|string|int|float|bool|null $value     New settings value.
	 */
	public function record( $old_value, $value ): void {
		$old_settings = \is_array( $old_value ) ? $old_value : array();
		$new_settings = \is_array( $value ) ? $value : array();
		$old_mode     = $this->get_effective_mode( $old_settings );
		$new_mode     = $this->get_effective_mode( $new_settings );

		if ( $old_mode === $new_mode ) {
			return;
		}

		$history   = $this->get();
		$history[] = array(
			'from'       => $old_mode,
			'to'         => $new_mode,
			'changed_at' => (string) \current_time( 'mysql', true ),
		);

		\update_option( self::OPTION, \array_slice( $history, -self::LIMIT ), false );
	}

	/**
	 * Returns the sanitized transition history.
	 *
	 * @return array<int, array{from: string, to: string, changed_at: string}>
	 */
	public function get(): array {
		$history = \get_option( self::OPTION, array() );
		if ( ! \is_array( $history ) ) {
			return array();
		}

		$sanitized = array();
		foreach ( $history as $entry ) {
			if ( ! \is_array( $entry ) ) {
				continue;
			}

			$from       = isset( $entry['from'] ) ? (string) $entry['from'] : '';
			$to         = isset( $entry['to'] ) ? (string) $entry['to'] : '';
			$changed_at = isset( $entry['changed_at'] ) ? (string) $entry['changed_at'] : '';
			if ( ! \in_array( $from, array( 'strict_anonymous', 'session_hash' ), true ) || ! \in_array( $to, array( 'strict_anonymous', 'session_hash' ), true ) || '' === $changed_at ) {
				continue;
			}

			$sanitized[] = array(
				'from'       => $from,
				'to'         => $to,
				'changed_at' => $changed_at,
			);
		}

		return \array_values( \array_slice( $sanitized, -self::LIMIT ) );
	}

	/**
	 * Returns only transitions that fall inside a report's selected range.
	 *
	 * @param int $range Number of days in the report.
	 * @return array<int, array{from: string, to: string, changed_at: string}>
	 */
	public function get_changes_in_range( int $range ): array {
		$range    = \max( 1, \min( 3660, $range ) );
		$now      = (int) \time();
		$start    = $now - ( $range * DAY_IN_SECONDS );
		$in_range = array();

		foreach ( $this->get() as $entry ) {
			$changed_at = \strtotime( $entry['changed_at'] . ' UTC' );
			if ( false === $changed_at || $changed_at < $start || $changed_at > $now ) {
				continue;
			}

			$in_range[] = $entry;
		}

		return $in_range;
	}

	/**
	 * Resolves the effective mode for settings written before the key existed.
	 *
	 * @param array<string, mixed> $settings Settings array.
	 */
	public function get_effective_mode( array $settings ): string {
		return isset( $settings['strict_anonymous_mode'] ) && false === (bool) $settings['strict_anonymous_mode']
			? 'session_hash'
			: 'strict_anonymous';
	}
}
