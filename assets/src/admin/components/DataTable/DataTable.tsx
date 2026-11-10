import {
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalHStack as HStack,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { cn } from '@shared/utils/formatting';
import { useCallback, useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import type { DataTableProps, FilterDef, ActionDef } from './types';
import { useDataTable } from './useDataTable';
import { useTableUI } from './useTableUI';
import { getColumnFilterValue } from './utils';
import { DataTableProvider } from './DataTableContext';
import { DataTableSearch } from './components/DataTableSearch';
import { DataTableAppearance } from './components/DataTableAppearance';
import { DataTableFilters } from './components/DataTableFilters';
import { DataTablePagination } from './components/DataTablePagination';
import { DataTableBulkActions } from './components/DataTableBulkActions';
import { DataTableHead } from './components/DataTableHead';
import { DataTableBody } from './components/DataTableBody';
import { DataTableLoadingBoundary } from './DataTableLoadingBoundary';

const DataTableBase = <T extends { id?: string | number }>(
	props: DataTableProps<T>
) => {
	const [isHorizontallyScrolled, setIsHorizontallyScrolled] = useState(false);
	const {
		data = [],
		columns: initialColumns = [],
		className,
		compact = false,
		rowClassName,
		bulkActions = [],
		actions = [],
		perPageOptions = [10, 25, 50, 100],
		initialSortBy = '',
		initialSortDirection = 'desc',
		initialPerPage = 10,
		searchableFields = [],
		children,
		isLoading,
		searchLabel = __('Search this table', 'primeplaced-logless-analytics'),
		tableLabel = __('This table', 'primeplaced-logless-analytics'),
		manualPagination,
		manualTotalItems,
		manualCurrentPage,
		storageKey,
		onStateChange,
		onRowClick,
		emptyContent: providedEmptyContent,
	} = props;

	const keyExtractor = useCallback((row: T, index: number) => {
		if (row.id !== undefined && row.id !== null && row.id !== '') {
			return row.id;
		}
		return `row-${index}`;
	}, []);

	const selectable = useMemo(
		() =>
			bulkActions.length > 0 ||
			actions.some((action: ActionDef<T>) => action.supportsBulk),
		[bulkActions.length, actions]
	);

	const emptyContent =
		providedEmptyContent ||
		__(
			'No results are available in this view yet.',
			'primeplaced-logless-analytics'
		);

	const filters = useMemo<FilterDef[]>(() => {
		return (initialColumns || [])
			.filter((col) => col.filterBy)
			.map((col) => {
				const type = col.filterBy?.type || 'select';
				let options: { label: string; value: string }[] = [];

				if (col.filterOptions) {
					options = col.filterOptions;
				} else if (type === 'select') {
					const uniqueValues = new Set<string>();
					for (let i = 0; i < data.length; i++) {
						const val = getColumnFilterValue(data[i], col, col.id);
						if (Array.isArray(val)) {
							for (let j = 0; j < val.length; j++) {
								if (
									val[j] !== undefined &&
									val[j] !== null &&
									val[j] !== ''
								) {
									uniqueValues.add(String(val[j]));
								}
							}
						} else if (
							val !== undefined &&
							val !== null &&
							val !== ''
						) {
							uniqueValues.add(String(val));
						}
					}

					options = Array.from(uniqueValues).map((val) => ({
						label: col.filterBy?.getValueLabel
							? col.filterBy.getValueLabel(val)
							: val,
						value: val,
					}));
				}

				return {
					id: String(col.id),
					label:
						typeof col.header === 'string'
							? col.header
							: String(col.id),
					type,
					options,
					operators: col.filterBy?.operators,
				};
			});
	}, [initialColumns, data]);

	const smartPerPageOptions = useMemo(() => {
		if (manualPagination) return perPageOptions;

		const total = data.length;
		const filtered: number[] = [];
		const sortedOptions = [...perPageOptions].sort((a, b) => a - b);

		for (const opt of sortedOptions) {
			filtered.push(opt);
			if (opt >= total) break;
		}
		return filtered.length > 0 ? filtered : [10];
	}, [data.length, perPageOptions, manualPagination]);

	const safeInitialPerPage = smartPerPageOptions.includes(initialPerPage)
		? initialPerPage
		: smartPerPageOptions[0];

	const instance = useDataTable<T>({
		data,
		columns: initialColumns,
		initialSortBy,
		initialSortDirection,
		initialPerPage: safeInitialPerPage,
		searchableFields,
		manualPagination,
		manualTotalItems,
		manualCurrentPage,
		storageKey,
		onStateChange,
	});

	const ui = useTableUI<T>({
		initialColumns,
		actions,
		bulkActions,
		data: instance.paginatedData,
		keyExtractor,
		selectedRowIds: instance.selectedRowIds,
		onSelectAll: instance.handleSelectAll,
		hiddenColumns: instance.hiddenColumns,
		clearSelection: instance.clearSelection,
	});

	const contextValue = useMemo(
		() => ({
			...instance,
			...ui,
			filters,
			selectable,
			emptyContent,
			searchLabel,
			tableLabel,
			perPageOptions: smartPerPageOptions,
			keyExtractor,
			rowClassName,
			onRowClick,
			isLoading: !!isLoading,
		}),
		[
			instance,
			ui,
			filters,
			selectable,
			emptyContent,
			searchLabel,
			tableLabel,
			smartPerPageOptions,
			keyExtractor,
			rowClassName,
			onRowClick,
			isLoading,
			providedEmptyContent,
		]
	);

	if (children) {
		return (
			<DataTableProvider value={contextValue}>
				{children}
			</DataTableProvider>
		);
	}

	return (
		<DataTableProvider value={contextValue}>
			<div className="ppla-datatable__wrapper">
				<VStack spacing={2} className="ppla-datatable__actions">
					<HStack spacing={4}>
						<DataTableSearch />
						<DataTableAppearance />
					</HStack>
					<DataTableFilters />
				</VStack>

				<DataTableLoadingBoundary>
				<div
					className="ppla-datatable__table"
					onScroll={(event) =>
						setIsHorizontallyScrolled(event.currentTarget.scrollLeft > 0)
					}
				>
					<table
						className={cn(
							'ppla-table ppla-datatable',
							compact && 'ppla-datatable--compact',
							isHorizontallyScrolled && 'is-scrolled-horizontally',
							className
						)}
					>
						<DataTableHead />
						<DataTableBody />
					</table>

					<div className="ppla-datatable__footer">
						<DataTableBulkActions />
						<DataTablePagination />
					</div>
				</div>
				</DataTableLoadingBoundary>
			</div>
		</DataTableProvider>
	);
};

export const DataTable = Object.assign(DataTableBase, {
	SearchBox: DataTableSearch,
	Appearance: DataTableAppearance,
	Filters: DataTableFilters,
	Head: DataTableHead,
	Body: DataTableBody,
	LoadingBoundary: DataTableLoadingBoundary,
	BulkActions: DataTableBulkActions,
	Pagination: DataTablePagination,
});
