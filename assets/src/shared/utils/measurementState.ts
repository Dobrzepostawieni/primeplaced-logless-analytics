import { __ } from '@wordpress/i18n';

/**
 * Returns a report-specific empty-state message for a known measurement cause.
 *
 * A report keeps its own fallback for a valid zero-result query (for example,
 * no 404s), while shared processing causes use the same plain-language copy.
 */
export const getMeasurementEmptyMessage = (
	reason: string | undefined,
	fallback: string
): string => {
	const messages: Record<string, string> = {
		no_data_yet: __(
			'Visit the public site in a private or logged-out window, then refresh this report.',
			'primeplaced-logless-analytics'
		),
		buffer_pending: __(
			'Data was received and is waiting for processing. Refresh this report after the queue finishes.',
			'primeplaced-logless-analytics'
		),
		viewer_excluded: __(
			'This administrator preview is excluded from analytics. Use a private or logged-out visitor window, or review Exclusions.',
			'primeplaced-logless-analytics'
		),
		queue_not_scheduled: __(
			'The processing schedule needs attention. Open Maintenance before relying on an empty result.',
			'primeplaced-logless-analytics'
		),
		configuration_error: __(
			'Analytics storage needs attention before this report can show current data. Open Maintenance.',
			'primeplaced-logless-analytics'
		),
		data_stale: __(
			'The latest activity is older than expected. Visit the public site once, then refresh this report.',
			'primeplaced-logless-analytics'
		),
		privacy_restricted: __(
			'This report is limited by the current privacy mode. Review Privacy settings to see which aggregate reports remain available.',
			'primeplaced-logless-analytics'
		),
		session_hash_required: __(
			'This report needs rotating pseudonymous sessions to preserve order. Review Privacy settings to enable session-based measurement.',
			'primeplaced-logless-analytics'
		),
		feature_disabled: __(
			'Tracking is off for this report. Enable it in Settings to collect new data.',
			'primeplaced-logless-analytics'
		),
		permission_denied: __(
			'Your account cannot view this report. Ask an administrator for analytics access.',
			'primeplaced-logless-analytics'
		),
	};

	return messages[ reason || '' ] || fallback;
};

/**
 * Returns a non-blocking notice for a report that still has usable rows while
 * processing is queued, stale, excluded, or needs attention.
 */
export const getMeasurementStatusNotice = (
	reason: string | undefined
): string | null => {
	const notices: Record<string, string> = {
		buffer_pending: __(
			'New measurement data is waiting in the processing queue. The rows below are the last report-visible result and will update after processing.',
			'primeplaced-logless-analytics'
		),
		viewer_excluded: __(
			'This administrator preview is excluded from new measurements. The rows below are existing report data; use a private or logged-out visitor window for a fresh signal.',
			'primeplaced-logless-analytics'
		),
		queue_not_scheduled: __(
			'The processing schedule needs attention. The rows below are existing report data and may not include the latest received signals.',
			'primeplaced-logless-analytics'
		),
		configuration_error: __(
			'Analytics storage needs attention. The rows below are existing report data and cannot be treated as current until maintenance is resolved.',
			'primeplaced-logless-analytics'
		),
		data_stale: __(
			'The latest report-visible activity is older than expected. The rows below are retained while you visit the public site and refresh the report.',
			'primeplaced-logless-analytics'
		),
		privacy_restricted: __(
			'This report is limited by the current privacy mode. Existing aggregate data remains visible, but some session-based dimensions are unavailable.',
			'primeplaced-logless-analytics'
		),
		session_hash_required: __(
			'This report needs rotating pseudonymous sessions to preserve order. Existing aggregate event totals remain available.',
			'primeplaced-logless-analytics'
		),
	};

	return notices[ reason || '' ] || null;
};
