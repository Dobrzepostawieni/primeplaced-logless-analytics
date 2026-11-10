import { __ } from '@wordpress/i18n';
import { MenuGroup, MenuItem } from '@wordpress/components';
import { arrowLeft, arrowRight, unseen, check, funnel } from '@wordpress/icons';
import type { ColumnDef } from '../../types';
import { useDataTableContext } from '../../DataTableContext';

interface ColumnDropdownMenuProps<T> {
	column: ColumnDef<T>;
	columnIndex: number;
	closeDropdown: () => void;
}

export const ColumnDropdownMenu = <T,>({
	column,
	columnIndex,
	closeDropdown,
}: ColumnDropdownMenuProps<T>) => {
	const {
		visibleColumns,
		sortBy,
		sortDirection,
		handleSort,
		handleMoveLeft,
		handleMoveRight,
		handleToggleColumn,
		filters,
		visibleFilters,
		handleShowFilter,
	} = useDataTableContext<T>();

	const isFixedLeft = column.isFixed === 'left';
	const isFixedRight = column.isFixed === 'right';

	const isFirstMovableColumn =
		columnIndex === (visibleColumns[0]?.isFixed === 'left' ? 1 : 0);
	const isLastMovableColumn =
		columnIndex ===
		visibleColumns.length -
			(visibleColumns[visibleColumns.length - 1]?.isFixed === 'right'
				? 2
				: 1);

	const columnFilterDefinition = filters?.find(
		(filterItem) => filterItem.id === column.id
	);
	const isFilterAlreadyActive = visibleFilters?.includes(column.id);

	return (
		<div className="ppla-datatable__head-dropdown-content">
			{column.sortable && handleSort && (
				<MenuGroup>
					<MenuItem
						icon={
							sortBy === column.id && sortDirection === 'asc'
								? check
								: undefined
						}
						isDestructive={false}
						onClick={() => {
							handleSort(column.id, 'asc');
							closeDropdown();
						}}
					>
						{__('Sort ascending', 'primeplaced-logless-analytics')}
					</MenuItem>
					<MenuItem
						icon={
							sortBy === column.id && sortDirection === 'desc'
								? check
								: undefined
						}
						isDestructive={false}
						onClick={() => {
							handleSort(column.id, 'desc');
							closeDropdown();
						}}
					>
						{__('Sort descending', 'primeplaced-logless-analytics')}
					</MenuItem>
				</MenuGroup>
			)}

			{columnFilterDefinition && handleShowFilter && (
				<MenuGroup>
					<MenuItem
						icon={funnel}
						disabled={isFilterAlreadyActive}
						isDestructive={false}
						onClick={() => {
							handleShowFilter(column.id);
							closeDropdown();
						}}
					>
						{__('Filter', 'primeplaced-logless-analytics')}
					</MenuItem>
				</MenuGroup>
			)}

			<MenuGroup>
				<MenuItem
					icon={arrowLeft}
					disabled={
						isFixedLeft || isFixedRight || isFirstMovableColumn
					}
					isDestructive={false}
					onClick={() => {
						handleMoveLeft(column.id);
						closeDropdown();
					}}
				>
					{__('Move left', 'primeplaced-logless-analytics')}
				</MenuItem>
				<MenuItem
					icon={arrowRight}
					disabled={
						isFixedLeft || isFixedRight || isLastMovableColumn
					}
					isDestructive={false}
					onClick={() => {
						handleMoveRight(column.id);
						closeDropdown();
					}}
				>
					{__('Move right', 'primeplaced-logless-analytics')}
				</MenuItem>
				{handleToggleColumn && !isFixedLeft && !isFixedRight && (
					<MenuItem
						icon={unseen}
						isDestructive={false}
						onClick={() => {
							handleToggleColumn(column.id);
							closeDropdown();
						}}
					>
						{__('Hide column', 'primeplaced-logless-analytics')}
					</MenuItem>
				)}
			</MenuGroup>
		</div>
	);
};