<?php
/**
 * Buffer Manager Service.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Services;

use Primeplaced_Logless_Analytics\Engine\Base;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class BufferManager
 *
 * Handles buffering of analytics events using a dedicated queue table to prevent MySQL database bloat
 * while avoiding Object Cache race conditions.
 */
class BufferManager extends Base {

	/** Maximum serialized size accepted for one buffered hit. */
	private const MAX_PAYLOAD_BYTES = 16384;

	/** Maximum number of queued hits retained during a stalled flush worker. */
	private const MAX_QUEUE_ROWS = 50000;

	/** Queue depth that schedules an immediate drain instead of waiting for the 15-minute worker. */
	private const DRAIN_THRESHOLD_ROWS = 2000;

	/** Single-event hook that drains a growing queue before the recurring worker runs. */
	public const DRAIN_HOOK = 'ppla_buffer_drain_cron';

	/** Capacity checks are intentionally amortized to keep ingestion inexpensive. */
	private const CAPACITY_CHECK_TRANSIENT = 'ppla_buffer_capacity_check';

	/** Database-backed lock shared by cron, REST, WP-CLI, and MainWP workers. */
	private const LOCK_OPTION = 'ppla_buffer_lock';

	/** Maximum lifetime of an abandoned worker lock. */
	private const LOCK_TTL = 5 * MINUTE_IN_SECONDS;

	/** Token owned by this service instance after a successful lock acquisition. */
	private ?string $lock_token = null;

	/**
	 * Pushes a new hit into the database buffer and updates the rolling real-time buffer.
	 *
	 * @param array<string, mixed> $hit_data The tracking data.
	 */
	public function push_hit( array $hit_data ): bool {
		global $wpdb;

		$table   = $wpdb->prefix . 'ppla_buffer';
		$payload = \wp_json_encode( $hit_data );
		if ( ! \is_string( $payload ) || \strlen( $payload ) > self::MAX_PAYLOAD_BYTES ) {
			return false;
		}

		if ( ! $this->enforce_capacity( $table ) ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$inserted = $wpdb->insert(
			$table,
			array(
				'payload'    => $payload,
				'created_at' => \current_datetime()->format( 'Y-m-d H:i:s' ),
			)
		);

		return false !== $inserted;
	}

	/**
	 * Trims stale queue overflow at most once per minute.
	 *
	 * @param string $table Buffer table name.
	 */
	private function enforce_capacity( string $table ): bool {
		if ( false !== \get_transient( self::CAPACITY_CHECK_TRANSIENT ) ) {
			return true;
		}

		\set_transient( self::CAPACITY_CHECK_TRANSIENT, true, MINUTE_IN_SECONDS );

		global $wpdb;
		// Find the oldest row that belongs to the newest retained window.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$cutoff_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM %i ORDER BY id DESC LIMIT 1 OFFSET %d',
				$table,
				self::MAX_QUEUE_ROWS - 1
			)
		);
		if ( '' !== $wpdb->last_error ) {
			\delete_transient( self::CAPACITY_CHECK_TRANSIENT );
			return false;
		}

		$this->schedule_drain_when_backlogged( $table );

		if ( $cutoff_id <= 0 ) {
			return true;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$deleted = $wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE id < %d', $table, $cutoff_id ) );
		if ( false === $deleted ) {
			\delete_transient( self::CAPACITY_CHECK_TRANSIENT );
			return false;
		}

		/**
		 * Fires when a stalled worker forced the queue to drop its oldest hits.
		 *
		 * @param int $dropped_hits Number of queued hits removed.
		 */
		\do_action( 'ppla_buffer_overflow', (int) $deleted );

		return true;
	}

	/**
	 * Schedules an immediate drain once the queue outgrows a normal 15-minute window.
	 *
	 * @param string $table Buffer table name.
	 */
	private function schedule_drain_when_backlogged( string $table ): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$backlog_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM %i ORDER BY id DESC LIMIT 1 OFFSET %d',
				$table,
				self::DRAIN_THRESHOLD_ROWS - 1
			)
		);

		if ( $backlog_id > 0 && ! \wp_next_scheduled( self::DRAIN_HOOK ) ) {
			\wp_schedule_single_event( \time(), self::DRAIN_HOOK );
		}
	}

	/**
	 * Retrieves a batch of buffered hits without deleting them, purging corrupted payloads automatically.
	 *
	 * @throws \RuntimeException When the queue cannot be read or repaired.
	 * @return array{ids: array<int, int>, hits: array<int, array<string, mixed>>} Array containing IDs and parsed hits.
	 */
	public function get_buffer_batch(): array {
		if ( ! $this->acquire_buffer_lock() ) {
			return array(
				'ids'  => array(),
				'hits' => array(),
			);
		}

		global $wpdb;
		$table = $wpdb->prefix . 'ppla_buffer';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$results = $wpdb->get_results(
			$wpdb->prepare( 'SELECT id, payload, created_at FROM %i ORDER BY id ASC LIMIT 5000', $table ),
			ARRAY_A
		);

		if ( ! \is_array( $results ) ) {
			$this->unlock_buffer();
			throw new \RuntimeException( 'Unable to read the analytics buffer.' );
		}

		if ( empty( $results ) ) {
			$this->unlock_buffer();
			return array(
				'ids'  => array(),
				'hits' => array(),
			);
		}

		$ids         = array();
		$hits        = array();
		$corrupt_ids = array();

		foreach ( $results as $row ) {
			$id   = (int) $row['id'];
			$data = \json_decode( $row['payload'], true );

			if ( \is_array( $data ) ) {
				// The receipt time is server-owned; it dates the pageview, not the batch run.
				$data['received_at'] = isset( $row['created_at'] ) ? (string) $row['created_at'] : '';
				$ids[]               = $id;
				$hits[]              = $data;
			} else {
				$corrupt_ids[] = $id;
			}
		}

		// Purge corrupted payloads immediately so they don't permanently block the queue.
		if ( ! empty( $corrupt_ids ) ) {
			$placeholders   = \implode( ',', \array_fill( 0, \count( $corrupt_ids ), '%d' ) );
			$prepare_values = \array_merge( array( $table ), $corrupt_ids );

			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$deleted = $wpdb->query(
				$wpdb->prepare(
					"DELETE FROM %i WHERE id IN ($placeholders)",
					...$prepare_values
				)
			);
			// phpcs:enable

			if ( \count( $corrupt_ids ) !== $deleted ) {
				$this->unlock_buffer();
				throw new \RuntimeException( 'Unable to remove corrupted analytics buffer rows.' );
			}
		}

		if ( empty( $ids ) ) {
			$this->unlock_buffer();
		}

		return array(
			'ids'  => $ids,
			'hits' => $hits,
		);
	}

	/**
	 * Releases the buffer aggregation lock.
	 */
	public function unlock_buffer(): void {
		if ( null === $this->lock_token ) {
			return;
		}

		$lock = \get_option( self::LOCK_OPTION, array() );
		if ( \is_array( $lock ) && isset( $lock['token'] ) && \is_string( $lock['token'] ) && \hash_equals( $lock['token'], $this->lock_token ) ) {
			\delete_option( self::LOCK_OPTION );
		}

		$this->lock_token = null;
	}

	/**
	 * Atomically acquires the shared buffer worker lock.
	 */
	private function acquire_buffer_lock(): bool {
		$token = \wp_generate_uuid4();
		$lock  = array(
			'token'      => $token,
			'expires_at' => \time() + self::LOCK_TTL,
		);

		if ( $this->add_buffer_lock( $lock ) ) {
			$this->lock_token = $token;
			return true;
		}

		$current_lock = \get_option( self::LOCK_OPTION, array() );
		$expires_at   = \is_array( $current_lock ) && isset( $current_lock['expires_at'] ) ? (int) $current_lock['expires_at'] : 0;

		if ( $expires_at > \time() ) {
			return false;
		}

		\delete_option( self::LOCK_OPTION );
		$token = \wp_generate_uuid4();
		$lock  = array(
			'token'      => $token,
			'expires_at' => \time() + self::LOCK_TTL,
		);
		if ( ! $this->add_buffer_lock( $lock ) ) {
			return false;
		}

		$this->lock_token = $token;
		return true;
	}

	/**
	 * Creates the non-autoloaded lock option atomically.
	 *
	 * @param array{token: string, expires_at: int} $lock Lock payload.
	 */
	private function add_buffer_lock( array $lock ): bool {
		return \add_option( self::LOCK_OPTION, $lock, '', false );
	}
}
