import type { ActiveFilterState, ColumnDef, FilterValue } from './types';

type CachedTableState = {
	page?: number;
	sortBy?: string;
	sortDirection?: 'asc' | 'desc';
	perPage?: number;
	searchQuery?: string;
	activeFilters?: Record<string, ActiveFilterState>;
	hiddenColumns?: string[];
};

export const getStorageCache = (storageKey?: string): CachedTableState => {
	if (!storageKey) {
		return {};
	}

	try {
		const saved = localStorage.getItem(`ppla_table_${storageKey}`);

		return saved ? (JSON.parse(saved) as CachedTableState) : {};
	} catch (error) {
		return {};
	}
};

export const getStoredTablePage = (page: unknown): number => {
	const parsedPage = Number(page);

	return Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
};

export const isEmptyFilterValue = (
	value: FilterValue | undefined | null
): value is undefined | null | '' | [] =>
	value === '' ||
	value === undefined ||
	value === null ||
	(Array.isArray(value) && value.length === 0);

export const getColumnFilterValue = <T>(
	row: T,
	column: ColumnDef<T> | undefined,
	key: string
): unknown => {
	if (column?.getFilterValue) {
		return column.getFilterValue(row);
	}

	return row[(column?.id || key) as keyof T];
};

const getColumnSortValue = <T>(
	row: T,
	column: ColumnDef<T> | undefined,
	sortBy: string
): unknown => {
	if (column?.getSortValue) {
		return column.getSortValue(row);
	}

	return row[(column?.id || sortBy) as keyof T];
};

export const checkRowAgainstFilter = <T>(
	row: T,
	filterState: ActiveFilterState,
	key: string,
	column?: ColumnDef<T>
): boolean => {
	const rawValue = getColumnFilterValue(row, column, key);
	const cellValue =
		rawValue !== undefined && rawValue !== null ? String(rawValue) : '';

	if (Array.isArray(filterState.value)) {
		const filterValues = filterState.value.map(String);
		if (filterState.operator === 'isNot') {
			return !filterValues.includes(cellValue);
		}
		return filterValues.includes(cellValue);
	}

	switch (filterState.operator) {
		case 'greater':
			return (
				parseFloat(cellValue) > parseFloat(String(filterState.value))
			);
		case 'less':
			return (
				parseFloat(cellValue) < parseFloat(String(filterState.value))
			);
		case 'isNot':
			return (
				cellValue.toLowerCase() !==
				String(filterState.value).toLowerCase()
			);
		case 'contains':
			return cellValue
				.toLowerCase()
				.includes(String(filterState.value).toLowerCase());
		case 'notContains':
			return !cellValue
				.toLowerCase()
				.includes(String(filterState.value).toLowerCase());
		case 'before':
			return new Date(cellValue) < new Date(String(filterState.value));
		case 'after':
			return new Date(cellValue) > new Date(String(filterState.value));
		case 'on':
			return cellValue.startsWith(String(filterState.value));
		case 'is':
		default:
			return (
				cellValue.toLowerCase() ===
				String(filterState.value).toLowerCase()
			);
	}
};

export const compareRows = <T>(
	a: T,
	b: T,
	sortBy: string,
	sortDirection: 'asc' | 'desc',
	column?: ColumnDef<T>
): number => {
	const rawA = getColumnSortValue(a, column, sortBy);
	const rawB = getColumnSortValue(b, column, sortBy);

	if (typeof rawA === 'number' && typeof rawB === 'number') {
		return sortDirection === 'asc' ? rawA - rawB : rawB - rawA;
	}

	const valA = String(rawA ?? '');
	const valB = String(rawB ?? '');

	return sortDirection === 'asc'
		? valA.localeCompare(valB)
		: valB.localeCompare(valA);
};
