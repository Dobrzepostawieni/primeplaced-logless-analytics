<?php
/**
 * Cron Dispatcher Integration.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Integrations;

use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Services\BufferManager;
use Primeplaced_Logless_Analytics\Services\BufferProcessor;
use Primeplaced_Logless_Analytics\Services\MaintenanceService;
use Primeplaced_Logless_Analytics\Services\RetentionPolicy;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class CronDispatcher
 *
 * Manages WP-Cron schedules, triggers the buffer synchronization, and handles data retention.
 */
class CronDispatcher extends Base {

	/** Custom recurrence used by the buffer worker. */
	public const BUFFER_SCHEDULE = 'ppla_fifteen_minutes';

	/** Buffer aggregation hook. */
	public const BUFFER_HOOK = 'ppla_sync_buffer_cron';

	/** Daily retention hook. */
	public const CLEANUP_HOOK = 'ppla_daily_cleanup_cron';

	/** Follow-up retention hook used while old rows still remain. */
	public const CLEANUP_CONTINUE_HOOK = 'ppla_cleanup_continue_cron';

	/**
	 * Buffer processor service.
	 */
	private BufferProcessor $buffer_processor;

	/**
	 * Maintenance Service instance.
	 */
	private MaintenanceService $maintenance_service;

	/**
	 * Retention Policy service.
	 */
	private RetentionPolicy $retention_policy;

	/**
	 * CronDispatcher constructor.
	 *
	 * @param BufferProcessor    $buffer_processor    Shared bounded buffer processor.
	 * @param MaintenanceService $maintenance_service The maintenance service.
	 * @param RetentionPolicy    $retention_policy    Effective retention policy service.
	 */
	public function __construct( BufferProcessor $buffer_processor, MaintenanceService $maintenance_service, RetentionPolicy $retention_policy ) {
		$this->buffer_processor    = $buffer_processor;
		$this->maintenance_service = $maintenance_service;
		$this->retention_policy    = $retention_policy;
	}

	/**
	 * Initialize the class and register hooks.
	 *
	 * @return bool True on success.
	 */
	public function initialize(): bool {
		if ( ! parent::initialize() ) {
			return false;
		}

		\add_filter( 'cron_schedules', array( self::class, 'register_cron_interval' ) );
		\add_action( self::BUFFER_HOOK, array( $this, 'process_buffer_sync' ) );
		\add_action( BufferManager::DRAIN_HOOK, array( $this, 'process_buffer_sync' ) );
		\add_action( self::CLEANUP_HOOK, array( $this, 'process_data_cleanup' ) );
		\add_action( self::CLEANUP_CONTINUE_HOOK, array( $this, 'process_data_cleanup' ) );

		self::ensure_scheduled_events();

		return true;
	}

	/**
	 * Adds a custom 15-minute interval to WP-Cron to comply with WPCS.
	 *
	 * @param array<string, mixed> $schedules Existing schedules.
	 * @return array<string, mixed> Modified schedules.
	 */
	public static function register_cron_interval( array $schedules ): array {
		$schedules[ self::BUFFER_SCHEDULE ] = array(
			'interval' => 15 * MINUTE_IN_SECONDS,
			'display'  => \esc_html__( 'Every 15 Minutes', 'primeplaced-logless-analytics' ),
		);
		return $schedules;
	}

	/**
	 * Ensures recurring workers exist after activation and repairs missing events.
	 */
	public static function ensure_scheduled_events(): void {
		if ( ! \wp_next_scheduled( self::BUFFER_HOOK ) ) {
			\wp_schedule_event( \time(), self::BUFFER_SCHEDULE, self::BUFFER_HOOK );
		}

		if ( ! \wp_next_scheduled( self::CLEANUP_HOOK ) ) {
			\wp_schedule_event( \time(), 'daily', self::CLEANUP_HOOK );
		}
	}

	/**
	 * Removes every Core scheduled worker.
	 */
	public static function clear_scheduled_events(): void {
		\wp_clear_scheduled_hook( self::BUFFER_HOOK );
		\wp_clear_scheduled_hook( BufferManager::DRAIN_HOOK );
		\wp_clear_scheduled_hook( self::CLEANUP_HOOK );
		\wp_clear_scheduled_hook( self::CLEANUP_CONTINUE_HOOK );
	}

	/**
	 * Flushes queued hits into analytics tables and keeps draining a backlog.
	 */
	public function process_buffer_sync(): void {
		try {
			$result = $this->buffer_processor->flush();
		} catch ( \RuntimeException $exception ) {
			\do_action( 'ppla_buffer_flush_failed', $exception->getMessage() );
			return;
		}

		if ( ! empty( $result['has_more'] ) && ! \wp_next_scheduled( BufferManager::DRAIN_HOOK ) ) {
			\wp_schedule_single_event( \time(), BufferManager::DRAIN_HOOK );
		}
	}

	/**
	 * Callback for the daily cron event. Purges old records based on data retention settings.
	 */
	public function process_data_cleanup(): void {
		$retention = $this->retention_policy->get_effective_days();

		if ( $retention > 0 ) {
			try {
				$has_more = $this->maintenance_service->purge_old_data( $retention );
			} catch ( \RuntimeException $exception ) {
				\do_action( 'ppla_maintenance_failed', $exception->getMessage() );
				return;
			}

			if ( $has_more && ! \wp_next_scheduled( self::CLEANUP_CONTINUE_HOOK ) ) {
				\wp_schedule_single_event( \time() + MINUTE_IN_SECONDS, self::CLEANUP_CONTINUE_HOOK );
			}
		}
	}
}
