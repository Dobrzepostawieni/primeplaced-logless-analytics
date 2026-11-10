export const REPORT_RANGE_QUERY = 'ppla_report_range';

export const REPORT_RANGE_OPTIONS = [7, 30, 90] as const;

export type ReportExportFormat = 'csv' | 'xlsx';

export type ReportTab = 'general' | 'content' | 'events' | 'realtime';

export interface ReportNavigationTarget {
	tab: ReportTab;
	section?: string;
	/** Optional extension-owned report within the Events workspace. */
	eventPanel?: string;
}

export const normalizeReportRange = (
	value: string | number | null,
	fallback = 30
): number => {
	const range = Number(value);

	return REPORT_RANGE_OPTIONS.includes(
		range as (typeof REPORT_RANGE_OPTIONS)[number]
	)
		? range
		: fallback;
};

export const getReportRangeFromUrl = (fallback = 30): number => {
	if (typeof window === 'undefined') return fallback;

	const params = new URLSearchParams(window.location.search);
	const requestedRange = params.get(REPORT_RANGE_QUERY);

	if (requestedRange !== null) {
		return normalizeReportRange(requestedRange, fallback);
	}

	return fallback;
};

/**
 * Move from the catalog to the canonical report surface.
 *
 * The tab hook listens for popstate, so this preserves the existing browser
 * Back/Forward behavior while still allowing a catalog card to be a direct
 * entry point.
 */
export const navigateToReport = (target: ReportNavigationTarget): void => {
	if (typeof window === 'undefined') {
		return;
	}

	const url = new URL(window.location.href);
	url.searchParams.set('tab', target.tab);
	url.hash = target.section
		? `#ppla-section-${encodeURIComponent(target.section)}`
		: '';
	window.history.pushState({}, '', url);
	window.dispatchEvent(new PopStateEvent('popstate'));
	if (target.eventPanel) {
		window.setTimeout(() => {
			window.dispatchEvent(new CustomEvent(
				'ppla:event-workspace-open-report',
				{ detail: target.eventPanel }
			));
		}, 0);
	}

	if (target.section) {
		window.setTimeout(() => {
			const section = document.querySelector(
				`.ppla-sticky-section-${CSS.escape(target.section as string)}`
			);
			section?.scrollIntoView({ block: 'start' });
		}, 0);
	}
};
