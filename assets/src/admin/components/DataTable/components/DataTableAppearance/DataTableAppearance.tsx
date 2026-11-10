import { PplaSelectControl } from '@shared/components/PplaSelectControl';
import { __, sprintf } from '@wordpress/i18n';
import {
	Button,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControl as ToggleGroupControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControlOptionIcon as ToggleGroupControlOptionIcon,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	
	Dropdown,
	MenuGroup,
	MenuItem} from '@wordpress/components';
import { arrowUp, arrowDown, check, cog } from '@wordpress/icons';
import { useDataTableContext } from '../../DataTableContext';


export const DataTableAppearance = () => {
	const {
		columns,
		columnOrder,
		hiddenColumns,
		handleToggleColumn,
		sortBy,
		sortDirection,
		handleSort,
		perPage,
		perPageOptions,
		handlePerPageChange,
		tableLabel,
	} = useDataTableContext();

	const orderedColumns = (columnOrder || [])
		.map((id) => (columns || []).find((c) => c.id === id))
		.filter((c) => c && !c.isActionColumn);

	const sortableColumnsOptions = (columns || [])
		.filter((c) => c.sortable)
		.map((c) => ({
			label: typeof c.header === 'string' ? c.header : c.id,
			value: c.id,
		}));

	return (
		<Dropdown
			popoverProps={{
				placement: 'bottom-end',
			}}
			className="ppla-datatable__appearance-dropdown"
			renderToggle={({
				isOpen,
				onToggle,
			}: {
				isOpen: boolean;
				onToggle: () => void;
			}) => (
				<Button
					icon={cog}
					onClick={onToggle}
					aria-expanded={isOpen}
					variant="tertiary"
					className="ppla-button"
					label={sprintf(
						/* translators: %s: report or table name. */
						__('%s table settings', 'primeplaced-logless-analytics'),
						tableLabel
					)}
				/>
			)}
			renderContent={() => (
				<div className="ppla-datatable__appearance-dropdown-content">
					<h3 className="ppla-datatable__appearance-title">
						{__('Appearance', 'primeplaced-logless-analytics')}
					</h3>

					{sortableColumnsOptions.length > 0 && handleSort && (
						<div className="ppla-datatable__appearance-row ppla-datatable__appearance-row--columns">
							<PplaSelectControl
								label={__(
									'Sort by',
									'primeplaced-logless-analytics'
								)}
								value={sortBy}
								options={sortableColumnsOptions}
								onChange={(val: string | undefined) =>
									handleSort(val || '', sortDirection || 'desc')
								}
							/>
							<ToggleGroupControl
								label={__(
									'Sort order',
									'primeplaced-logless-analytics'
								)}
								value={sortDirection}
								onChange={(newDirection: string | number | undefined) =>
									handleSort(
										sortBy || '',
										newDirection as 'asc' | 'desc'
									)
								}
								isBlock
								className="ppla-datatable__appearance-select"
								__next40pxDefaultSize
							>
								<ToggleGroupControlOptionIcon
									value="asc"
									icon={arrowUp}
									label={__(
										'Ascending',
										'primeplaced-logless-analytics'
									)}
								/>
								<ToggleGroupControlOptionIcon
									value="desc"
									icon={arrowDown}
									label={__(
										'Descending',
										'primeplaced-logless-analytics'
									)}
								/>
							</ToggleGroupControl>
						</div>
					)}

					{handlePerPageChange &&
						perPage &&
						perPageOptions.length > 1 && (
							<div className="ppla-datatable__appearance-row">
								<ToggleGroupControl
									label={__(
										'Items per page',
										'primeplaced-logless-analytics'
									)}
									value={perPage?.toString()}
									onChange={(val: string | number | undefined) =>
										handlePerPageChange(Number(val))
									}
									isBlock
									className="ppla-datatable__appearance-select"
									__next40pxDefaultSize
								>
									{perPageOptions.map((opt) => (
										<ToggleGroupControlOption
											key={opt}
											value={opt.toString()}
											label={opt.toString()}
											showTooltip={false}
										/>
									))}
								</ToggleGroupControl>
							</div>
						)}

					{handleToggleColumn && (
						<div className="ppla-datatable__appearance-row">
							<MenuGroup
								label={__(
									'Columns',
									'primeplaced-logless-analytics'
								)}
							>
								{orderedColumns.map((col) => {
									if (!col || col.isFixed) {
										return null;
									}
									const isVisible = !(hiddenColumns || []).includes(
										col.id
									);
									return (
										<MenuItem
											key={col.id}
											icon={isVisible ? check : undefined}
											isDestructive={false}
											onClick={() =>
												handleToggleColumn(col.id)
											}
										>
											{col.header}
										</MenuItem>
									);
								})}
							</MenuGroup>
						</div>
					)}
				</div>
			)}
		/>
	);
};
