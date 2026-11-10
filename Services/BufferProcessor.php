<?php
/**
 * Buffered analytics processor.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Services;

use Primeplaced_Logless_Analytics\Data\TrackingRepository;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Flushes queued analytics hits through one shared, bounded workflow. */
class BufferProcessor {

	private const DEFAULT_MAX_BATCHES = 20;

	private BufferManager $buffer_manager;
	private TrackingRepository $tracking_repository;

	/**
	 * Creates the shared buffer processor.
	 *
	 * @param BufferManager      $buffer_manager Buffered ingestion queue.
	 * @param TrackingRepository $tracking_repository Analytics persistence.
	 */
	public function __construct( BufferManager $buffer_manager, TrackingRepository $tracking_repository ) {
		$this->buffer_manager      = $buffer_manager;
		$this->tracking_repository = $tracking_repository;
	}

	/**
	 * Persists queued hits in bounded batches.
	 *
	 * @param int $max_batches Maximum number of batches to process.
	 * @throws \RuntimeException When the queue cannot be read or a batch cannot be persisted.
	 * @return array{flushed_hits:int,has_more:bool}
	 */
	public function flush( int $max_batches = self::DEFAULT_MAX_BATCHES ): array {
		$max_batches = \max( 1, \min( 100, $max_batches ) );
		$flushed     = 0;

		for ( $batch_number = 0; $batch_number < $max_batches; $batch_number++ ) {
			try {
				$batch = $this->buffer_manager->get_buffer_batch();
				if ( empty( $batch['hits'] ) || empty( $batch['ids'] ) ) {
					return array(
						'flushed_hits' => $flushed,
						'has_more'     => false,
					);
				}

				if ( ! $this->tracking_repository->save_batch( $batch['hits'], $batch['ids'] ) ) {
					throw new \RuntimeException( 'Unable to persist the buffered analytics batch.' );
				}

				$flushed += \count( $batch['hits'] );
			} finally {
				$this->buffer_manager->unlock_buffer();
			}
		}

		return array(
			'flushed_hits' => $flushed,
			'has_more'     => true,
		);
	}
}
