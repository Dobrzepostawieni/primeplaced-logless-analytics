/**
 * URL and local-state helpers for reusable report segments.
 *
 * @package
 */
import type { ReportComparison, ReportQueryState } from './types';

const STORAGE_PREFIX = 'ppla_report_query_';
const COMPARISON_QUERY = 'ppla_report_comparison';
const FILTER_QUERY_PREFIX = 'ppla_report_filter_';

const getUrlKeys = (urlKeyPrefix?: string) => ({
	comparison: urlKeyPrefix ? `${urlKeyPrefix}_comparison` : COMPARISON_QUERY,
	filterPrefix: urlKeyPrefix
		? `${urlKeyPrefix}_filter_`
		: FILTER_QUERY_PREFIX,
});

const emptyState = (): ReportQueryState => ({
	comparison: 'none',
	filters: {},
});

const normalizeComparison = (value: unknown): ReportComparison =>
	value === 'previous_period' ? 'previous_period' : 'none';

const normalizeBreakdown = (value: unknown): string | undefined => {
	if (typeof value !== 'string') return undefined;

	const normalized = value.trim().slice(0, 30);
	return normalized || undefined;
};

const normalizeState = (
	value: unknown,
	filterIds: string[]
): ReportQueryState => {
	if (!value || typeof value !== 'object') return emptyState();

	const candidate = value as Partial<ReportQueryState>;
	const filters = Object.fromEntries(
		filterIds.flatMap((filterId) => {
			const filterValue = candidate.filters?.[filterId];
			return typeof filterValue === 'string' && filterValue.trim()
				? [[filterId, filterValue.trim()]]
				: [];
		})
	);

	const breakdown = normalizeBreakdown(candidate.breakdown);

	return {
		comparison: normalizeComparison(candidate.comparison),
		...(breakdown ? { breakdown } : {}),
		filters,
	};
};

export interface ReportQueryUrlOverrides {
	filterIds?: string[];
	comparison?: ReportQueryState['comparison'];
	filters?: Record<string, string>;
}

export const getReportQueryUrlOverrides = (
	filterIds: string[],
	urlKeyPrefix?: string
): ReportQueryUrlOverrides => {
	if (typeof window === 'undefined') return {};

	const params = new URL(window.location.href).searchParams;
	const urlKeys = getUrlKeys(urlKeyPrefix);
	const overrides: ReportQueryUrlOverrides = { filterIds: [...filterIds] };
	if (params.has(urlKeys.comparison)) {
		overrides.comparison = normalizeComparison(params.get(urlKeys.comparison));
	}

	const filters = Object.fromEntries(
		filterIds.flatMap((filterId) => {
			const key = `${urlKeys.filterPrefix}${filterId}`;
			return params.has(key) ? [[filterId, params.get(key)?.trim() || '']] : [];
		})
	);
	if (Object.keys(filters).length > 0) overrides.filters = filters;

	return overrides;
};

export const mergeReportQueryState = (
	preferredQueryState: string | null,
	fallbackState: ReportQueryState,
	filterIds: string[],
	urlOverrides: ReportQueryUrlOverrides = {}
): ReportQueryState => {
	let preferred: Partial<ReportQueryState> | undefined;
	try {
		const parsed: unknown = preferredQueryState
			? JSON.parse(preferredQueryState)
			: undefined;
		if (parsed && typeof parsed === 'object') {
			preferred = parsed as Partial<ReportQueryState>;
		}
	} catch {
		// Fall back to browser state when a saved preference is malformed.
	}

	const preferredFilters = preferred?.filters;
	const filters = Object.fromEntries(
		filterIds.flatMap((filterId) => {
			const urlValue = urlOverrides.filters?.[filterId];
			if (Object.prototype.hasOwnProperty.call(urlOverrides.filters || {}, filterId)) {
				return urlValue ? [[filterId, urlValue]] : [];
			}

			const preferredValue = preferredFilters?.[filterId];
			if (preferredFilters && typeof preferredFilters === 'object') {
				return typeof preferredValue === 'string' && preferredValue.trim()
					? [[filterId, preferredValue.trim()]]
					: [];
			}

			const fallbackValue = fallbackState.filters[filterId];
			return typeof fallbackValue === 'string' && fallbackValue.trim()
				? [[filterId, fallbackValue.trim()]]
				: [];
		})
	);

	return {
		comparison:
			urlOverrides.comparison ??
			(typeof preferred?.comparison === 'string'
				? normalizeComparison(preferred.comparison)
				: fallbackState.comparison),
		...(normalizeBreakdown(preferred?.breakdown ?? fallbackState.breakdown)
			? { breakdown: normalizeBreakdown(preferred?.breakdown ?? fallbackState.breakdown) }
			: {}),
		filters,
	};
};

export const getStoredReportQueryState = (
	storageKey: string,
	filterIds: string[]
): ReportQueryState => {
	try {
		const stored = window.localStorage.getItem(
			`${STORAGE_PREFIX}${storageKey}`
		);
		return stored
			? normalizeState(JSON.parse(stored), filterIds)
			: emptyState();
	} catch {
		return emptyState();
	}
};

export const getSerializedStoredReportQueryState = (
	storageKey: string
): string | null => {
	try {
		return window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
	} catch {
		return null;
	}
};

export const setSerializedStoredReportQueryState = (
	storageKey: string,
	queryState: string | null
): void => {
	try {
		if (queryState) {
			window.localStorage.setItem(
				`${STORAGE_PREFIX}${storageKey}`,
				queryState
			);
		} else {
			window.localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
		}
	} catch {
		// A report remains usable if browser storage is unavailable.
	}
};

export const getReportQueryState = (
	storageKey: string,
	filterIds: string[],
	urlKeyPrefix?: string,
	preferExplicitUrl = false
): ReportQueryState => {
	if (typeof window === 'undefined') return emptyState();

	const stored = getStoredReportQueryState(storageKey, filterIds);
	if (!preferExplicitUrl && getSerializedStoredReportQueryState(storageKey) !== null) {
		return stored;
	}
	return mergeReportQueryState(
		getSerializedStoredReportQueryState(storageKey),
		stored,
		filterIds,
		getReportQueryUrlOverrides(filterIds, urlKeyPrefix)
	);
};

export const persistReportQueryState = (
	storageKey: string,
	filterIds: string[],
	state: ReportQueryState,
	urlKeyPrefix?: string,
	dispatchChange = true
): void => {
	if (typeof window === 'undefined') return;

	const normalized = normalizeState(state, filterIds);
	const serialized = JSON.stringify(normalized);
	setSerializedStoredReportQueryState(storageKey, serialized);

	const url = new URL(window.location.href);
	const urlKeys = getUrlKeys(urlKeyPrefix);
	if (normalized.comparison === 'previous_period') {
		url.searchParams.set(urlKeys.comparison, normalized.comparison);
	} else {
		url.searchParams.delete(urlKeys.comparison);
	}

	filterIds.forEach((filterId) => {
		const param = `${urlKeys.filterPrefix}${filterId}`;
		const value = normalized.filters[filterId];
		if (value) {
			url.searchParams.set(param, value);
		} else {
			url.searchParams.delete(param);
		}
	});
	window.history.replaceState({}, '', url);
	if (dispatchChange) {
		window.dispatchEvent(
			new CustomEvent('ppla:report-query-changed', {
				detail: { storageKey, queryState: serialized },
			})
		);
	}
};
