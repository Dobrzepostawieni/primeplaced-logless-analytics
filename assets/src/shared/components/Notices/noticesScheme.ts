/**
 * Global Notices Configuration Scheme.
 * Defines standard notifications used throughout the application.
 * 
 * @package
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

export const noticeScheme = {
	FREEMIUS_API_ERROR: {
		status: 'error',
		content: __(
			'Licensing server connection error. Your subscription status could not be verified and some features may be temporarily unavailable.',
			'primeplaced-logless-analytics'
		),
		type: 'default',
	},
	ACTION_UNAVAILABLE: {
		status: 'info',
		content: __( 'This action is not available right now.', 'primeplaced-logless-analytics' ),
		type: 'snackbar',
	},
	SETTINGS_SESSION_TIMEOUT: {
		status: 'error',
		content: __( 'Session expired.', 'primeplaced-logless-analytics' ),
		type: 'default',
	},

	SETTINGS_SAVE_SUCCESS: {
		status: 'success',
		content: __(
			'Settings saved successfully.',
			'primeplaced-logless-analytics'
		),
		type: 'snackbar',
	},
	SETTINGS_SAVE_ERROR: {
		status: 'error',
		content: __(
			'An error occurred while saving.',
			'primeplaced-logless-analytics'
		),
		type: 'default',
	},
	SETTINGS_FETCH_ERROR: {
		status: 'error',
		content: __( 'Error fetching settings.', 'primeplaced-logless-analytics' ),
		type: 'default',
	},
	SETTINGS_RESET_SUCCESS: {
		status: 'success',
		content: __( 'Settings reset. You can undo this change for a short time.', 'primeplaced-logless-analytics' ),
		type: 'snackbar',
	},
	SETTINGS_RESET_ERROR: {
		status: 'error',
		content: __( 'Settings could not be reset.', 'primeplaced-logless-analytics' ),
		type: 'default',
	},
	SETTINGS_RESET_UNDO_SUCCESS: {
		status: 'success',
		content: __( 'Previous settings were restored.', 'primeplaced-logless-analytics' ),
		type: 'snackbar',
	},
	BUFFER_FLUSH_SUCCESS: {
		status: 'success',
		/* translators: 1: number of hits, 2: execution time */
		content: __(
			'Successfully aggregated %1$d queued hits into analytics tables in %2$ss.',
			'primeplaced-logless-analytics'
		),
		type: 'snackbar',
	},
	BUFFER_FLUSH_EMPTY: {
		status: 'info',
		content: __(
			'The buffer queue is currently empty. Nothing to aggregate.',
			'primeplaced-logless-analytics'
		),
		type: 'snackbar',
	},
	BUFFER_FLUSH_ERROR: {
		status: 'error',
		content: __(
			'Failed to force buffer queue aggregation.',
			'primeplaced-logless-analytics'
		),
		type: 'default',
	},
	DB_OPTIMIZE_SUCCESS: {
		status: 'success',
		content: __(
			'Database tables optimized successfully.',
			'primeplaced-logless-analytics'
		),
		type: 'snackbar',
	},
	DB_OPTIMIZE_ERROR: {
		status: 'error',
		content: __(
			'Failed to optimize database tables.',
			'primeplaced-logless-analytics'
		),
		type: 'default',
	},
	DATA_CLEARED_SUCCESS: {
		status: 'success',
		content: __(
			'Selected data has been permanently cleared.',
			'primeplaced-logless-analytics'
		),
		type: 'snackbar',
	},
	DATA_CLEAR_ERROR: {
		status: 'error',
		content: __(
			'Failed to clear data from the database.',
			'primeplaced-logless-analytics'
		),
		type: 'default',
	},
	EXPORT_ERROR: {
		status: 'error',
		content: __(
			'An error occurred while generating the export file.',
			'primeplaced-logless-analytics'
		),
		type: 'default',
	},
	EXPORT_SUCCESS: {
		status: 'success',
		content: __( 'Export started.', 'primeplaced-logless-analytics' ),
		type: 'snackbar',
	},
	COPY_SUCCESS: {
		status: 'success',
		content: __( 'Copied to clipboard.', 'primeplaced-logless-analytics' ),
		type: 'snackbar',
	},
	COPY_ERROR: {
		status: 'error',
		content: __( 'Could not copy to clipboard. Please copy it manually.', 'primeplaced-logless-analytics' ),
		type: 'default',
	},
	SALT_ROTATION_SUCCESS: {
		status: 'success',
		content: __(
			'Cryptographic salt has been successfully rotated.',
			'primeplaced-logless-analytics'
		),
		type: 'snackbar',
	},
	// Report measurement states pass their own message; they stay longer than a
	// save confirmation because they explain what to do next.
	MEASUREMENT_STATE: {
		status: 'info',
		content: '',
		type: 'snackbar',
		duration: 8000,
	},
	MEASUREMENT_STATE_WARNING: {
		status: 'warning',
		content: '',
		type: 'snackbar',
		duration: 8000,
	},
	SALT_ROTATION_ERROR: {
		status: 'error',
		content: __(
			'Failed to rotate cryptographic salt.',
			'primeplaced-logless-analytics'
		),
		type: 'default',
	},
} as const;
