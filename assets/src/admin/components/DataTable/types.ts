import type { ReactNode } from 'react';

export type FilterType = 'text' | 'select' | 'date' | 'duration';

export type FilterOperator =
	| 'is'
	| 'isNot'
	| 'contains'
	| 'notContains'
	| 'before'
	| 'after'
	| 'on'
	| 'greater'
	| 'less';

export type FilterValue = string | number | boolean | (string | number)[];

export interface DataTableState {
	page: number;
	perPage: number;
	sortBy: string;
	sortDirection: 'asc' | 'desc';
	searchQuery: string;
	filters: Record<string, ActiveFilterState>;
}

export interface UseDataTableProps<T> {
	data: T[];
	columns?: ColumnDef<T>[];
	initialSortBy?: string;
	initialSortDirection?: 'asc' | 'desc';
	initialPerPage?: number;
	searchableFields?: (keyof T)[];
	manualPagination?: boolean;
	manualTotalItems?: number;
	manualCurrentPage?: number;
	onStateChange?: (state: DataTableState) => void;
	storageKey?: string;
}

export interface FilterConfig {
	type: FilterType;
	operators: FilterOperator[];
	getValueLabel?: (val: string | number | boolean) => string;
}

export interface FilterOption {
	label: string;
	value: string;
}

export interface FilterDef {
	id: string;
	label: string;
	type: FilterType;
	options?: FilterOption[];
	operators?: string[];
}

export interface ActiveFilterState {
	value: FilterValue;
	operator: FilterOperator;
}

export interface ColumnDef<T> {
	id: string;
	header: ReactNode;
	cell: (row: T, index: number) => ReactNode;
	getSortValue?: (row: T) => string | number | boolean | null | undefined;
	getFilterValue?: (row: T) => FilterValue | null | undefined;
	headerClassName?: string;
	cellClassName?: string | ((row: T) => string);
	sortable?: boolean;
	isFixed?: 'left' | 'right';
	isActionColumn?: boolean;
	filterBy?: FilterConfig;
	filterOptions?: FilterOption[];
	hideOnMobile?: boolean;
	hideOnDesktop?: boolean;
	expandable?: boolean;
}

export interface ActionDef<T> {
	id: string;
	label: string;
	icon?: unknown;
	isDestructive?: boolean;
	supportsBulk?: boolean;
	isPrimary?: boolean;
	isDisabled?: (row: T) => boolean;
	onClick: (
		rowOrIds: T | (string | number)[],
		clearSelection: () => void
	) => void;
}

export interface BulkActionDef {
	id: string;
	label: string;
	icon?: unknown;
	isDestructive?: boolean;
	onClick: (
		selectedRowIds: (string | number)[],
		clearSelection: () => void
	) => void;
}

export interface BoundBulkAction {
	id: string;
	label: string;
	icon?: unknown;
	isDestructive?: boolean;
	onClick: () => void;
}

export interface DataTableInstance<T> {
	hiddenColumns: string[];
	sortBy: string;
	sortDirection: 'asc' | 'desc';
	currentPage: number;
	totalPages: number;
	totalItems: number;
	perPage: number;
	paginatedData: T[];
	filteredData: T[];
	sortedData: T[];
	selectedRowIds: (string | number)[];
	searchQuery: string;
	activeFilters: Record<string, ActiveFilterState>;
	visibleFilters: string[];
	activeFilterDropdown: string | null;
	isFiltersPanelVisible: boolean;
	handleToggleColumn: (columnId: string) => void;
	handleSort: (columnId: string, direction: 'asc' | 'desc') => void;
	handlePageChange: (page: number) => void;
	handlePerPageChange: (perPage: number) => void;
	handleSelectRow: (id: string | number, checked: boolean) => void;
	handleSelectAll: (checked: boolean, pageIds: (string | number)[]) => void;
	clearSelection: () => void;
	handleSearchChange: (query: string) => void;
	handleFilterChange: (
		filterId: string,
		value: FilterValue | undefined | null,
		operator: FilterOperator
	) => void;
	handleShowFilter: (filterId: string) => void;
	handleHideFilter: (filterId: string) => void;
	handleResetFilters: () => void;
	setActiveFilterDropdown: (filterId: string | null) => void;
	setIsFiltersPanelVisible: (
		visible: boolean | ((prev: boolean) => boolean)
	) => void;
}

export interface UseTableUIProps<T> {
	initialColumns: ColumnDef<T>[];
	actions?: ActionDef<T>[];
	bulkActions?: BulkActionDef[];
	data: T[];
	keyExtractor: (row: T, index: number) => string | number;
	selectedRowIds: (string | number)[];
	onSelectAll?: (checked: boolean, pageIds: (string | number)[]) => void;
	hiddenColumns: string[];
}

export interface DataTableContextValue<T> extends DataTableInstance<T> {
	columns: ColumnDef<T>[];
	columnOrder: string[];
	visibleColumns: ColumnDef<T>[];
	handleMoveLeft: (id: string) => void;
	handleMoveRight: (id: string) => void;
	isAllCurrentPageSelected: boolean;
	isIndeterminate: boolean;
	handleSelectAllTrigger: (val: boolean) => void;
	boundBulkActions: BoundBulkAction[];
	filters: FilterDef[];
	selectable: boolean;
	emptyContent: ReactNode;
	searchLabel: string;
	tableLabel: string;
	perPageOptions: number[];
	tableClassName?: string;
	rowClassName?: string | ((row: T, index: number) => string);
	onRowClick?: (row: T, index: number) => void;
	keyExtractor: (row: T, index: number) => string | number;
	isLoading: boolean;
}

export interface DataTableProps<T> {
	data: T[];
	columns: ColumnDef<T>[];
	initialSortBy?: string;
	initialSortDirection?: 'asc' | 'desc';
	initialPerPage?: number;
	searchableFields?: (keyof T)[];
	filters?: FilterDef[];
	actions?: ActionDef<T>[];
	bulkActions?: BulkActionDef[];
	className?: string;
	compact?: boolean;
	rowClassName?: string | ((row: T, index: number) => string);
	emptyContent?: ReactNode;
	searchLabel?: string;
	tableLabel?: string;
	perPageOptions?: number[];
	children?: ReactNode;
	isLoading?: boolean;
	manualPagination?: boolean;
	manualTotalItems?: number;
	manualCurrentPage?: number;
	onStateChange?: (state: DataTableState) => void;
	onRowClick?: (row: T, index: number) => void;
	storageKey?: string;
}
