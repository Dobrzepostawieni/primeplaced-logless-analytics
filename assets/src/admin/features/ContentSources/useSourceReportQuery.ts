/**
 * Independent segment and comparison state for a Sources report.
 *
 * @package
 */
import { useCallback, useEffect, useMemo, useState } from '@wordpress/element';
import {
	getReportQueryState,
	getReportQueryUrlOverrides,
	getStoredReportQueryState,
	persistReportQueryState,
} from '@admin/components/ReportQuery/reportQueryState';
import type { ReportQueryState } from '@admin/components/ReportQuery/types';

interface UseSourceReportQueryOptions {
	storageKey: string;
	filterId: string;
	urlKeyPrefix: string;
}

export const useSourceReportQuery = ({
	storageKey,
	filterId,
	urlKeyPrefix,
}: UseSourceReportQueryOptions) => {
	const filterIds = useMemo(() => [filterId], [filterId]);
	const [initialUrlOverrides] = useState(() =>
		typeof window === 'undefined'
			? {}
			: getReportQueryUrlOverrides([filterId], urlKeyPrefix)
	);
	const getInitialQuery = useCallback((): ReportQueryState => {
		if (typeof window === 'undefined') {
			return { comparison: 'none', filters: {} };
		}

		return getReportQueryState(storageKey, filterIds, urlKeyPrefix, true);
	}, [filterIds, storageKey, urlKeyPrefix]);
	const [query, setQuery] = useState<ReportQueryState>(() =>
		getInitialQuery()
	);

	const updateQuery = useCallback(
		(nextQuery: ReportQueryState): void => {
			setQuery(nextQuery);
			persistReportQueryState(
				storageKey,
				filterIds,
				nextQuery,
				urlKeyPrefix
			);
		},
		[filterIds, storageKey, urlKeyPrefix]
	);

	const selectFilterValue = useCallback(
		(value: string): void => {
			updateQuery({
				...query,
				filters: value
					? { ...query.filters, [filterId]: value }
					: Object.fromEntries(
						Object.entries(query.filters).filter(
							([id]) => id !== filterId
						)
					),
			});
		},
		[filterId, query, updateQuery]
	);

	useEffect(() => {
		const applySavedQuery = (event: Event): void => {
			const detail = (event as CustomEvent<{ storageKey?: unknown }>).detail;
			if (detail?.storageKey === storageKey) {
				const nextQuery = getStoredReportQueryState(storageKey, filterIds);
				setQuery(nextQuery);
				// SavedViews writes the snapshot before dispatching this event. Sync
				// the report-specific URL keys too, so a later reload cannot resurrect
				// stale filters from the pre-navigation URL.
				persistReportQueryState(
					storageKey,
					filterIds,
					nextQuery,
					urlKeyPrefix,
					false
				);
			}
		};

		window.addEventListener('ppla:apply-report-query-state', applySavedQuery);
		return () =>
			window.removeEventListener(
				'ppla:apply-report-query-state',
				applySavedQuery
			);
	}, [filterIds, storageKey, urlKeyPrefix]);

	return { query, updateQuery, selectFilterValue, initialUrlOverrides };
};
