import {
	useState,
	useCallback,
	useEffect,
	useRef,
} from '@wordpress/element';
import { useApi } from '@shared/api/useApi';
import { useAppState } from '@shared/contexts';
import type {
	ContentApiResponse,
	SourceComparison,
	SourceSummary,
} from './types';
import type { PrivacyModeHistoryEntry } from '@shared/types';
import type { DataTableState } from '@admin/components/DataTable/types';
import type {
	ReportQueryFilterOption,
	ReportQueryState,
} from '@admin/components/ReportQuery/types';
import type { ExportProgress } from '@admin/components/ReportTableActions/types';

type SourceReportType = 'pages' | 'referrers' | '404-errors';

interface ReportPageSnapshot {
	type: SourceReportType;
	range: number;
	search: string;
	sortBy: string;
	sortDirection: 'asc' | 'desc';
	comparison: ReportQueryState['comparison'];
	filters: Record<string, string>;
}

const EXPORT_PER_PAGE = 100;
const EXPORT_CONCURRENCY = 4;

export const useServerSideTable = <T extends { id: string }>(
	type: SourceReportType,
	range: number,
	query: ReportQueryState,
	tableState: DataTableState
) => {
	const { fetchApi } = useApi();
	const { dataRefreshKey } = useAppState();
	const requestIdRef = useRef(0);
	const isMountedRef = useRef(true);

	useEffect(() => {
		isMountedRef.current = true;

		return () => {
			isMountedRef.current = false;
			requestIdRef.current += 1;
		};
	}, []);

	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [data, setData] = useState<T[]>([]);
	const [hasError, setHasError] = useState(false);
	const [measurementReason, setMeasurementReason] = useState('no_data_yet');
	const [privacyChanges, setPrivacyChanges] = useState<PrivacyModeHistoryEntry[]>( [] );
	const [totalItems, setTotalItems] = useState(0);
	const [summary, setSummary] = useState<SourceSummary>({});
	const [comparison, setComparison] = useState<SourceComparison | null>(null);
	const [filterOptions, setFilterOptions] = useState<
		Record<string, ReportQueryFilterOption[]>
	>({});
	const getSnapshot = useCallback((): ReportPageSnapshot => ({
		type,
		range,
		search: tableState.searchQuery,
		sortBy: tableState.sortBy,
		sortDirection: tableState.sortDirection,
		comparison: query.comparison,
		filters: { ...query.filters },
	}), [query.comparison, query.filters, range, tableState.searchQuery, tableState.sortBy, tableState.sortDirection, type]);

	const fetchReportPage = useCallback(async (
		page: number,
		perPage: number,
		snapshot: ReportPageSnapshot
	): Promise<{ response: ContentApiResponse; items: T[]; totalItems: number }> => {
		const is404Mode = snapshot.type === '404-errors';
		const pathEndpoint = is404Mode
			? '/ppla/v1/dashboard/404-errors'
			: '/ppla/v1/dashboard/content';

		const params = new URLSearchParams({
			range: snapshot.range.toString(),
			per_page: perPage.toString(),
			page: page.toString(),
			search: snapshot.search,
			orderby: snapshot.sortBy,
			order: snapshot.sortDirection,
			comparison: snapshot.comparison,
		});

		if (!is404Mode) {
			params.append('type', snapshot.type);
		}

		Object.entries(snapshot.filters).forEach(([filterId, value]) => {
			if (value) {
				params.set(`filter_${filterId}`, value);
			}
		});

		const response = await fetchApi<ContentApiResponse>({
			path: `${pathEndpoint}?${params.toString()}`,
			method: 'GET',
		});

		if (!response?.success) {
			throw new Error(
				'The Sources report response was unsuccessful.'
			);
		}

		let result:
			| ContentApiResponse['pages']
			| ContentApiResponse['referrers']
			| ContentApiResponse['404_errors'] = response.pages;

		if (snapshot.type === 'referrers') {
			result = response.referrers;
		} else if (snapshot.type === '404-errors') {
			result = response['404_errors'];
		}

		if (!result || !Array.isArray(result.items)) {
			throw new Error(
				'The Sources report response had an unexpected shape.'
			);
		}

		return {
			response,
			items: result.items.map((item) => ({
				...item,
				id: getSourceRowId(snapshot.type, item),
			})) as unknown as T[],
			totalItems: response.meta?.pagination.total_items ?? result.total_items,
		};
	}, [fetchApi]);

	const getReportPage = useCallback(async (
		page: number,
		perPage: number
	): Promise<{ response: ContentApiResponse; items: T[]; totalItems: number }> => (
		fetchReportPage(page, perPage, getSnapshot())
	), [fetchReportPage, getSnapshot]);

	const loadReportData = useCallback(async () => {
		const requestId = requestIdRef.current + 1;
		requestIdRef.current = requestId;

		if (!isMountedRef.current) {
			return;
		}

		setIsLoading(true);

		try {
			const { response, items, totalItems: nextTotalItems } = await getReportPage(
				tableState.page,
				tableState.perPage
			);

			if (
				requestId !== requestIdRef.current ||
				!isMountedRef.current
			) {
				return;
			}

			setMeasurementReason(response.measurement_reason || 'data_current');
			setPrivacyChanges( Array.isArray( response.privacy_changes ) ? response.privacy_changes : [] );

			setData(items);
			setTotalItems(nextTotalItems);
			setSummary(response.summary || {});
			setComparison(response.comparison || null);
			setFilterOptions(response.filter_options || {});
			setHasError(false);
		} catch (error) {
			if (requestId === requestIdRef.current && isMountedRef.current) {
				setHasError(true);
			}
		} finally {
			if (requestId === requestIdRef.current && isMountedRef.current) {
				setIsLoading(false);
			}
		}
	}, [getReportPage, tableState.page, tableState.perPage]);

	const exportRows = useCallback(async (
		onProgress?: (progress: ExportProgress) => void
	): Promise<T[]> => {
		// Capture every query input before the first request so refreshes cannot
		// mix rows from two different report states into one file.
		const snapshot = getSnapshot();
		const firstPage = await fetchReportPage(1, EXPORT_PER_PAGE, snapshot);
		const pageCount = Math.max(
			1,
			Math.ceil(firstPage.totalItems / EXPORT_PER_PAGE)
		);
		const pages: T[][] = new Array(pageCount);
		pages[0] = firstPage.items;
		onProgress?.({ completed: 1, total: pageCount });

		let nextPage = 2;
		let completedPages = 1;
		const fetchNextPage = async (): Promise<void> => {
			while (nextPage <= pageCount) {
				const page = nextPage;
				nextPage += 1;
				const response = await fetchReportPage(page, EXPORT_PER_PAGE, snapshot);
				pages[page - 1] = response.items;
				completedPages += 1;
				onProgress?.({ completed: completedPages, total: pageCount });
			}
		};

		const workerCount = Math.min(EXPORT_CONCURRENCY, Math.max(0, pageCount - 1));
		await Promise.all(
			Array.from({ length: workerCount }, () => fetchNextPage())
		);

		return pages.flatMap((page) => page || []);
	}, [fetchReportPage, getSnapshot]);

	useEffect(() => {
		void loadReportData();
	}, [dataRefreshKey, loadReportData]);

	return {
		isLoading,
		data,
		hasError,
		measurementReason,
		privacyChanges,
		totalItems,
		summary,
		comparison,
		filterOptions,
		exportRows,
		retry: loadReportData,
	};
};

const getSourceRowId = (
	type: SourceReportType,
	item: Record<string, unknown>
): string => {
	const sourceId =
		type === 'referrers'
			? item.source
			: item.url;

	return `${type}-${String(sourceId || '')}`;
};
