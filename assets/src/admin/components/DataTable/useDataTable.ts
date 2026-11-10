import {
	useState,
	useMemo,
	useCallback,
	useEffect,
	useRef,
} from '@wordpress/element';
import type {
	DataTableInstance,
	ActiveFilterState,
	FilterOperator,
	FilterValue,
	UseDataTableProps,
} from './types';
import {
	checkRowAgainstFilter,
	compareRows,
	getStorageCache,
	getStoredTablePage,
	isEmptyFilterValue,
} from './utils';

export const useDataTable = <T>({
	data,
	columns = [],
	initialSortBy = '',
	initialSortDirection = 'desc',
	initialPerPage = 25,
	searchableFields = [],
	manualPagination = false,
	manualTotalItems = 0,
	manualCurrentPage,
	storageKey,
	onStateChange,
}: UseDataTableProps<T>): DataTableInstance<T> => {
	const getCache = useCallback(
		() => getStorageCache(storageKey),
		[storageKey]
	);

	const [sortBy, setSortBy] = useState<string>(
		() => getCache()?.sortBy || initialSortBy
	);
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
		() => getCache()?.sortDirection || initialSortDirection
	);
	const [perPage, setPerPage] = useState<number>(
		() => getCache()?.perPage || initialPerPage
	);
	const [activeFilters, setActiveFilters] = useState<
		Record<string, ActiveFilterState>
	>(() => getCache()?.activeFilters || {});
	const [hiddenColumns, setHiddenColumns] = useState<string[]>(
		() => getCache()?.hiddenColumns || []
	);

	const [currentPage, setCurrentPage] = useState<number>(() =>
		getStoredTablePage(getCache()?.page)
	);
	const [selectedRowIds, setSelectedRowIds] = useState<(string | number)[]>(
		[]
	);
	const [searchQuery, setSearchQuery] = useState<string>(
		() => getCache()?.searchQuery || ''
	);
	const [visibleFilters, setVisibleFilters] = useState<string[]>(() =>
		Object.keys(getCache()?.activeFilters || {})
	);
	const [activeFilterDropdown, setActiveFilterDropdown] = useState<
		string | null
	>(null);
	const [isFiltersPanelVisible, setIsFiltersPanelVisible] =
		useState<boolean>(true);

	useEffect(() => {
		const applyStoredState = (event: Event): void => {
			const detail = (
				event as CustomEvent<{
					storageKey?: unknown;
					tableState?: unknown;
				}>
			).detail;
			if (
				!storageKey ||
				detail?.storageKey !== storageKey ||
				typeof detail.tableState !== 'string'
			) {
				return;
			}

			const state = getCache();
			setSortBy(state.sortBy || initialSortBy);
			setSortDirection(state.sortDirection || initialSortDirection);
			setPerPage(state.perPage || initialPerPage);
			setSearchQuery(state.searchQuery || '');
			setActiveFilters(state.activeFilters || {});
			setVisibleFilters(Object.keys(state.activeFilters || {}));
			setHiddenColumns(state.hiddenColumns || []);
			setCurrentPage(getStoredTablePage(state.page));
			setSelectedRowIds([]);
		};

		window.addEventListener('ppla:apply-table-state', applyStoredState);
		return () =>
			window.removeEventListener(
				'ppla:apply-table-state',
				applyStoredState
			);
	}, [
		getCache,
		initialPerPage,
		initialSortBy,
		initialSortDirection,
		storageKey,
	]);

	useEffect(() => {
		if (!storageKey) return;
		const stateToSave = {
			page: currentPage,
			sortBy,
			sortDirection,
			perPage,
			searchQuery,
			activeFilters,
			hiddenColumns,
		};
		try {
			const tableState = JSON.stringify(stateToSave);
			localStorage.setItem(`ppla_table_${storageKey}`, tableState);
			window.dispatchEvent(
				new CustomEvent('ppla:table-state-changed', {
					detail: { storageKey, tableState },
				})
			);
		} catch (e) {}
	}, [
		storageKey,
		currentPage,
		sortBy,
		sortDirection,
		perPage,
		searchQuery,
		activeFilters,
		hiddenColumns,
	]);

	useEffect(() => {
		if (!manualPagination || manualCurrentPage === undefined) {
			return;
		}

		setCurrentPage(getStoredTablePage(manualCurrentPage));
	}, [manualCurrentPage, manualPagination]);

	const onStateChangeRef = useRef(onStateChange);
	useEffect(() => {
		onStateChangeRef.current = onStateChange;
	}, [onStateChange]);

	// Saved views wait for server preferences; this tells them a person has
	// already changed the report, so a late preference must not reset it.
	// Programmatic state (cache, saved views) never goes through these handlers.
	const announceInteraction = useCallback(() => {
		if (!storageKey) return;
		window.dispatchEvent(
			new CustomEvent('ppla:table-interaction', { detail: { storageKey } })
		);
	}, [storageKey]);

	const handleToggleColumn = useCallback((columnId: string) => {
		announceInteraction();
		setHiddenColumns((prev) =>
			prev.includes(columnId)
				? prev.filter((id) => id !== columnId)
				: [...prev, columnId]
		);
	}, [announceInteraction]);

	const handleSort = useCallback(
		(columnId: string, direction: 'asc' | 'desc') => {
			announceInteraction();
			setSortBy(columnId);
			setSortDirection(direction);
			setCurrentPage(1);
		},
		[announceInteraction]
	);

	const handlePerPageChange = useCallback((newPerPage: number) => {
		announceInteraction();
		setPerPage(newPerPage);
		setCurrentPage(1);
	}, [announceInteraction]);

	const handleSelectRow = useCallback(
		(id: string | number, checked: boolean) => {
			setSelectedRowIds((prev) =>
				checked ? [...prev, id] : prev.filter((prevId) => prevId !== id)
			);
		},
		[]
	);

	const handleSelectAll = useCallback(
		(checked: boolean, pageIds: (string | number)[]) => {
			if (checked) {
				setSelectedRowIds((prev) => {
					const newSet = new Set([...prev, ...pageIds]);
					return Array.from(newSet);
				});
			} else {
				setSelectedRowIds((prev) =>
					prev.filter((prevId) => !pageIds.includes(prevId))
				);
			}
		},
		[]
	);

	const clearSelection = useCallback(() => setSelectedRowIds([]), []);

	const handleSearchChange = useCallback(
		(query: string) => {
			announceInteraction();
			setSearchQuery(query);
			setCurrentPage(1);
			clearSelection();
		},
		[announceInteraction, clearSelection]
	);

	const handleFilterChange = useCallback(
		(
			filterId: string,
			value: FilterValue | undefined | null,
			operator: FilterOperator = 'is'
		) => {
			announceInteraction();
			setActiveFilters((prev) => {
				const next = { ...prev };
				if (isEmptyFilterValue(value)) {
					delete next[filterId];
				} else {
					next[filterId] = { value, operator };
				}
				return next;
			});
			setCurrentPage(1);
			clearSelection();
		},
		[announceInteraction, clearSelection]
	);

	const handleShowFilter = useCallback((filterId: string) => {
		announceInteraction();
		setVisibleFilters((prev) => {
			if (!prev.includes(filterId)) {
				setActiveFilterDropdown(filterId);
				setIsFiltersPanelVisible(true);
				return [...prev, filterId];
			}
			return prev;
		});
	}, [announceInteraction]);

	const handleHideFilter = useCallback(
		(filterId: string) => {
			setVisibleFilters((prev) => prev.filter((id) => id !== filterId));
			handleFilterChange(filterId, '', 'is');
			setActiveFilterDropdown((prevDropdown) =>
				prevDropdown === filterId ? null : prevDropdown
			);
		},
		[handleFilterChange]
	);

	const handleResetFilters = useCallback(() => {
		announceInteraction();
		setVisibleFilters([]);
		setActiveFilters({});
		setSearchQuery('');
		setCurrentPage(1);
		clearSelection();
		setActiveFilterDropdown(null);
	}, [announceInteraction, clearSelection]);

	const filteredData = useMemo(() => {
		if (manualPagination) return data;

		return data.filter((row: T) => {
			for (const [key, filterState] of Object.entries(activeFilters)) {
				if (!filterState || isEmptyFilterValue(filterState.value)) {
					continue;
				}
				const column = columns.find(
					(candidate) => candidate.id === key
				);
				if (!checkRowAgainstFilter(row, filterState, key, column)) {
					return false;
				}
			}

			if (searchQuery && searchableFields.length > 0) {
				const query = searchQuery.toLowerCase();
				const matches = searchableFields.some((field) => {
					const val = row[field];
					if (Array.isArray(val)) {
						return val.some((v) =>
							String(v || '')
								.toLowerCase()
								.includes(query)
						);
					}
					return String(val || '')
						.toLowerCase()
						.includes(query);
				});
				if (!matches) return false;
			}
			return true;
		});
	}, [
		data,
		activeFilters,
		searchQuery,
		searchableFields,
		manualPagination,
		columns,
	]);

	const sortedData = useMemo(() => {
		if (manualPagination || !sortBy) return filteredData;

		const column = columns.find((candidate) => candidate.id === sortBy);
		return [...filteredData].sort((a, b) => {
			return compareRows(a, b, sortBy, sortDirection, column);
		});
	}, [filteredData, sortBy, sortDirection, manualPagination, columns]);

	const totalItems = manualPagination ? manualTotalItems : sortedData.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
	let safeCurrentPage = currentPage;

	if (manualPagination) {
		if (manualTotalItems > 0) {
			safeCurrentPage = Math.min(currentPage, totalPages);
		}
	} else {
		safeCurrentPage = Math.min(currentPage, totalPages);
	}

	const paginatedData = useMemo(() => {
		if (manualPagination) return data;

		const start = (safeCurrentPage - 1) * perPage;
		return sortedData.slice(start, start + perPage);
	}, [sortedData, safeCurrentPage, perPage, manualPagination, data]);

	useEffect(() => {
		if (manualPagination && onStateChangeRef.current) {
			onStateChangeRef.current({
				page: safeCurrentPage,
				perPage,
				sortBy,
				sortDirection,
				searchQuery,
				filters: activeFilters,
			});
		}
	}, [
		safeCurrentPage,
		perPage,
		sortBy,
		sortDirection,
		searchQuery,
		activeFilters,
		manualPagination,
	]);

	return {
		hiddenColumns,
		sortBy,
		sortDirection,
		currentPage: safeCurrentPage,
		totalPages,
		totalItems,
		perPage,
		paginatedData,
		filteredData,
		sortedData,
		selectedRowIds,
		searchQuery,
		activeFilters,
		visibleFilters,
		activeFilterDropdown,
		isFiltersPanelVisible,
		setIsFiltersPanelVisible,
		setActiveFilterDropdown,
		handleToggleColumn,
		handleSort,
		handlePageChange: setCurrentPage,
		handlePerPageChange,
		handleSelectRow,
		handleSelectAll,
		clearSelection,
		handleSearchChange,
		handleFilterChange,
		handleShowFilter,
		handleHideFilter,
		handleResetFilters,
	};
};
