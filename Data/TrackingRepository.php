<?php
/**
 * Tracking Repository.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Data;

use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Services\EventFeaturePolicy;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class TrackingRepository
 *
 * Handles direct database inserts and session tracking logic.
 */
class TrackingRepository extends Base {

	/** Inactivity, in seconds, after which a visitor starts a new session. */
	private const SESSION_TIMEOUT = 30 * MINUTE_IN_SECONDS;

	/** Object cache group for analytics operations. */
	private const CACHE_GROUP = 'ppla_analytics';

	/** Neutral policy controlling event-specific storage privacy. */
	private EventFeaturePolicy $event_feature_policy;

	/**
	 * Creates the repository.
	 *
	 * @param EventFeaturePolicy|null $event_feature_policy Active event policy.
	 */
	public function __construct( ?EventFeaturePolicy $event_feature_policy = null ) {
		$this->event_feature_policy = $event_feature_policy ?? new EventFeaturePolicy();
	}

	// phpcs:disable Squiz.Commenting.FunctionCommentThrowTag.Missing -- Transaction failures are caught and returned as false.
	/**
	 * Saves a batch of hits from the buffer into the database.
	 *
	 * @param array<int, array<string, mixed>> $hits       Array of hits to save.
	 * @param array<int, int>                  $buffer_ids Queue rows represented by the batch.
	 * @return bool True on successful processing.
	 */
	public function save_batch( array $hits, array $buffer_ids ): bool {
		global $wpdb;

		if ( empty( $hits ) || \count( $hits ) !== \count( $buffer_ids ) ) {
			return false;
		}

		$buffer_ids = \array_values( \array_filter( \array_map( 'absint', $buffer_ids ) ) );
		if ( \count( $hits ) !== \count( $buffer_ids ) ) {
			return false;
		}

		$pageviews_table = $wpdb->prefix . 'ppla_pageviews';
		$contracts_table = $wpdb->prefix . 'ppla_event_contracts';
		$buffer_table    = $wpdb->prefix . 'ppla_buffer';
		$current_time    = \current_datetime()->format( 'Y-m-d H:i:s' );
		$session_cache   = array();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		if ( false === $wpdb->query( 'START TRANSACTION' ) ) {
			return false;
		}

		try {
			foreach ( $hits as $hit ) {
				$hit_id              = isset( $hit['hit_id'] ) && \is_string( $hit['hit_id'] ) ? $hit['hit_id'] : '';
				$hash                = isset( $hit['session_hash'] ) && \is_string( $hit['session_hash'] ) ? $hit['session_hash'] : '';
				$device_type         = isset( $hit['device_type'] ) && \is_string( $hit['device_type'] ) ? $hit['device_type'] : '';
				$url                 = isset( $hit['url'] ) && \is_string( $hit['url'] ) ? \mb_substr( $hit['url'], 0, 500 ) : '';
				$referrer            = isset( $hit['referrer'] ) && \is_string( $hit['referrer'] ) ? \mb_substr( $hit['referrer'], 0, 500 ) : '';
				$raw_channel         = isset( $hit['acquisition_channel'] ) && \is_string( $hit['acquisition_channel'] ) ? $hit['acquisition_channel'] : '';
				$acquisition_channel = \in_array( $raw_channel, array( 'google_ads', 'meta_ads' ), true ) ? $raw_channel : '';
				$is_strict           = isset( $hit['privacy_mode'] ) && 'strict_anonymous' === $hit['privacy_mode'];
				$record_pageview     = ! empty( $hit['record_pageview'] );
				if ( $record_pageview && 1 !== \preg_match( '/^[a-zA-Z0-9_-]{16,64}$/', $hit_id ) ) {
					throw new \RuntimeException( 'Invalid analytics pageview idempotency key.' );
				}

				$hit_time         = $this->get_hit_time( $hit, $current_time );
				$requires_session = $record_pageview || $this->hit_events_require_session( $hit['events'] ?? array() );
				$session_id       = ( $is_strict || ! $requires_session ) ? 0 : $this->get_session_id( $hash, $device_type, $hit_time, $session_cache );
				if ( ! $is_strict && $requires_session && $session_id <= 0 ) {
					throw new \RuntimeException( 'Unable to persist analytics session.' );
				}

				if ( $record_pageview ) {
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
					$inserted = $wpdb->insert(
						$pageviews_table,
						array(
							'hit_id'              => $hit_id,
							'session_id'          => $session_id,
							'url'                 => $url,
							'referrer'            => $referrer,
							'acquisition_channel' => $acquisition_channel,
							'device_type'         => '' !== $device_type ? $device_type : 'desktop',
							'created_at'          => $hit_time,
						)
					);
					if ( false === $inserted && ! $this->pageview_exists( $pageviews_table, $hit_id ) ) {
						throw new \RuntimeException( 'Unable to persist analytics pageview.' );
					}

					if ( false !== $inserted ) {
						\do_action( 'ppla_save_buffer_hit', $session_id, $hit );
					}
				}

				if ( ! empty( $hit['events'] ) && \is_array( $hit['events'] ) ) {
					foreach ( $hit['events'] as $event ) {
						if ( ! \is_array( $event ) ) {
							continue;
						}

						$event_id = isset( $event['event_id'] ) && \is_string( $event['event_id'] ) ? $event['event_id'] : '';
						if ( '' === $event_id ) {
							continue;
						}

						$event_session_id = $this->event_feature_policy->event_uses_session( $event ) ? $session_id : 0;
						$contract_id      = $this->save_event_contract( $contracts_table, $event_session_id, $event, $hit_time, $device_type );

						if ( $contract_id <= 0 ) {
							if ( $this->event_contract_exists( $contracts_table, $event_id ) ) {
								continue;
							}

							throw new \RuntimeException( 'Unable to persist analytics event.' );
						}

						/**
						 * Fires after a neutral Core event envelope is durably stored.
						 * Premium modules may project their own data without Core importing Pro.
						 */
						\do_action( 'ppla_event_contract_persisted', $contract_id, $event_session_id, $event, $hit );
					}
				}
			}

			$placeholders   = \implode( ',', \array_fill( 0, \count( $buffer_ids ), '%d' ) );
			$prepare_values = \array_merge( array( $buffer_table ), $buffer_ids );

			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$deleted = $wpdb->query(
				$wpdb->prepare(
					"DELETE FROM %i WHERE id IN ($placeholders)",
					...$prepare_values
				)
			);
			// phpcs:enable

			if ( \count( $buffer_ids ) !== $deleted ) {
				throw new \RuntimeException( 'Unable to remove the persisted analytics batch from the queue.' );
			}

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			if ( false === $wpdb->query( 'COMMIT' ) ) {
				throw new \RuntimeException( 'Unable to commit analytics batch.' );
			}
		} catch ( \Throwable $error ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->query( 'ROLLBACK' );
			return false;
		}

		foreach ( $session_cache as $ppla_cache_key => $session_state ) {
			\wp_cache_set( $ppla_cache_key, $session_state, self::CACHE_GROUP, 30 * MINUTE_IN_SECONDS );
		}

		$this->clear_analytics_cache();

		return true;
	}
	// phpcs:enable Squiz.Commenting.FunctionCommentThrowTag.Missing

	/**
	 * Determines whether at least one event in a hit needs a session.
	 *
	 * @param mixed $events Normalized event list from the buffered hit.
	 */
	private function hit_events_require_session( $events ): bool {
		if ( ! \is_array( $events ) || array() === $events ) {
			return false;
		}

		foreach ( $events as $event ) {
			if ( ! \is_array( $event ) || $this->event_feature_policy->event_uses_session( $event ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Checks idempotency before creating the contract row.
	 *
	 * @param string $table Contract table name.
	 * @param string $event_id Event idempotency key.
	 */
	private function event_contract_exists( string $table, string $event_id ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (bool) $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM %i WHERE event_id = %s LIMIT 1', $table, $event_id ) );
	}

	/**
	 * Checks whether a pageview hit has already been persisted.
	 *
	 * @param string $table Pageview table name.
	 * @param string $hit_id Hit idempotency key.
	 */
	private function pageview_exists( string $table, string $hit_id ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (bool) $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM %i WHERE hit_id = %s LIMIT 1', $table, $hit_id ) );
	}

	/**
	 * Persists the neutral event-contract projection.
	 *
	 * @param string               $table Contract table name.
	 * @param int                  $session_id Internal session ID.
	 * @param array<string, mixed> $event Normalized EventContract envelope.
	 * @param string               $received_at Server receipt timestamp.
	 * @param string               $device_type Server-derived device category.
	 */
	private function save_event_contract( string $table, int $session_id, array $event, string $received_at, string $device_type = '' ): int {
		global $wpdb;

		$source          = isset( $event['source'] ) && \is_array( $event['source'] ) ? $event['source'] : array();
		$subject         = isset( $event['subject'] ) && \is_array( $event['subject'] ) ? $event['subject'] : array();
		$metrics         = isset( $event['metrics'] ) && \is_array( $event['metrics'] ) ? $event['metrics'] : array();
		$attributes      = isset( $event['attributes'] ) && \is_array( $event['attributes'] ) ? $event['attributes'] : array();
		$attributes_json = \wp_json_encode( $attributes );
		if ( ! \is_string( $attributes_json ) ) {
			return 0;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$inserted = $wpdb->insert(
			$table,
			array(
				'session_id'       => $session_id,
				'event_id'         => (string) ( $event['event_id'] ?? '' ),
				'contract_version' => (int) ( $event['contract_version'] ?? 1 ),
				'event_type'       => (string) ( $event['type'] ?? '' ),
				'source_channel'   => (string) ( $source['channel'] ?? 'browser' ),
				'provider_id'      => (string) ( $source['provider_id'] ?? '' ),
				'device_type'      => in_array( $device_type, array( 'desktop', 'tablet', 'mobile' ), true ) ? $device_type : '',
				'subject_kind'     => (string) ( $subject['kind'] ?? '' ),
				'subject_key'      => (string) ( $subject['key'] ?? '' ),
				'occurred_at'      => (string) ( $event['occurred_at'] ?? $received_at ),
				'received_at'      => $received_at,
				'amount'           => $metrics['amount'] ?? null,
				'currency'         => (string) ( $metrics['currency'] ?? '' ),
				'quantity'         => $metrics['quantity'] ?? null,
				'attributes'       => $attributes_json,
			)
		);

		return false === $inserted ? 0 : (int) $wpdb->insert_id;
	}

	/**
	 * Returns the site-local receipt time of a buffered hit.
	 *
	 * @param array<string, mixed> $hit          Buffered hit.
	 * @param string               $current_time Fallback for hits queued before receipt times were stored.
	 */
	private function get_hit_time( array $hit, string $current_time ): string {
		$received_at = isset( $hit['received_at'] ) && \is_string( $hit['received_at'] ) ? $hit['received_at'] : '';
		$parsed      = \DateTimeImmutable::createFromFormat( 'Y-m-d H:i:s', $received_at, \wp_timezone() );

		return false !== $parsed && $parsed->format( 'Y-m-d H:i:s' ) === $received_at ? $received_at : $current_time;
	}

	/**
	 * Resolves the session for a hit, starting a new one after 30 minutes of inactivity.
	 *
	 * Inactivity is measured between hit receipt times, so delayed or batched
	 * queue processing never merges or splits visits.
	 *
	 * @param string                                   $session_hash  The 64-character session hash.
	 * @param string                                   $device_type   The detected device type.
	 * @param string                                   $hit_time      Site-local receipt time of the hit.
	 * @param array<string, array{id: int, last: int}> $session_cache Transaction-local session cache.
	 * @return int The internal session ID.
	 */
	private function get_session_id( string $session_hash, string $device_type, string $hit_time, array &$session_cache ): int {
		global $wpdb;

		$ppla_cache_key = 'ppla_session_id_' . $session_hash;
		$hit_timestamp  = \strtotime( $hit_time );
		$hit_timestamp  = false === $hit_timestamp ? \time() : $hit_timestamp;
		$cached         = $session_cache[ $ppla_cache_key ] ?? \wp_cache_get( $ppla_cache_key, self::CACHE_GROUP );

		if ( \is_array( $cached ) && isset( $cached['id'], $cached['last'] ) && \abs( $hit_timestamp - (int) $cached['last'] ) <= self::SESSION_TIMEOUT ) {
			$session_cache[ $ppla_cache_key ] = array(
				'id'   => (int) $cached['id'],
				'last' => \max( $hit_timestamp, (int) $cached['last'] ),
			);

			return (int) $cached['id'];
		}

		$sessions_table  = $wpdb->prefix . 'ppla_sessions';
		$pageviews_table = $wpdb->prefix . 'ppla_pageviews';
		$contracts_table = $wpdb->prefix . 'ppla_event_contracts';
		$session_id      = 0;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$recent_sessions = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT id, created_at FROM %i WHERE session_hash = %s ORDER BY id DESC LIMIT 1',
				$sessions_table,
				$session_hash
			),
			ARRAY_A
		);
		if ( ! \is_array( $recent_sessions ) ) {
			return 0;
		}
		$recent_session = $recent_sessions[0] ?? null;

		if ( \is_array( $recent_session ) ) {
			$recent_session_id = isset( $recent_session['id'] ) ? (int) $recent_session['id'] : 0;
			$activity_times    = array();
			if ( isset( $recent_session['created_at'] ) && \is_string( $recent_session['created_at'] ) ) {
				$activity_times[] = $recent_session['created_at'];
			}

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$pageview_rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT created_at FROM %i WHERE session_id = %d ORDER BY id DESC LIMIT 1',
					$pageviews_table,
					$recent_session_id
				),
				ARRAY_A
			);
			if ( ! \is_array( $pageview_rows ) ) {
				return 0;
			}
			$last_pageview = isset( $pageview_rows[0]['created_at'] ) ? $pageview_rows[0]['created_at'] : '';
			if ( \is_string( $last_pageview ) && '' !== $last_pageview ) {
				$activity_times[] = $last_pageview;
			}

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$event_rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT received_at FROM %i WHERE session_id = %d ORDER BY id DESC LIMIT 1',
					$contracts_table,
					$recent_session_id
				),
				ARRAY_A
			);
			if ( ! \is_array( $event_rows ) ) {
				return 0;
			}
			$last_event = isset( $event_rows[0]['received_at'] ) ? $event_rows[0]['received_at'] : '';
			if ( \is_string( $last_event ) && '' !== $last_event ) {
				$activity_times[] = $last_event;
			}

			$last_activity      = empty( $activity_times ) ? '' : \max( $activity_times );
			$activity_timestamp = \strtotime( $last_activity );
			if ( $recent_session_id > 0 && false !== $activity_timestamp && $hit_timestamp - $activity_timestamp <= self::SESSION_TIMEOUT ) {
				$session_id = $recent_session_id;
			}
		}

		if ( 0 === $session_id ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$inserted = $wpdb->insert(
				$sessions_table,
				array(
					'session_hash' => $session_hash,
					'device_type'  => $device_type,
					'created_at'   => $hit_time,
				)
			);
			if ( false === $inserted ) {
				return 0;
			}
			$session_id = (int) $wpdb->insert_id;
		}

		$session_cache[ $ppla_cache_key ] = array(
			'id'   => $session_id,
			'last' => $hit_timestamp,
		);

		return $session_id;
	}

	/**
	 * Invalidates global dashboard statistics cache.
	 */
	public function clear_analytics_cache(): void {
		\update_option( 'ppla_stats_version', \uniqid( 'v_', true ), false );
	}
}
