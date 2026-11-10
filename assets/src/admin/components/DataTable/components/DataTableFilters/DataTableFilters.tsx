import { __, sprintf } from '@wordpress/i18n';
import {
	Dropdown,
	Button,
	MenuGroup,
	MenuItem,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalHStack as HStack,
} from '@wordpress/components';
import { useDataTableContext } from '../../DataTableContext';
import { FilterChip } from './FilterChip';
import { OPERATOR_LABELS } from './FilterDropdownContent';


export const DataTableFilters = () => {
	const {
		filters,
		activeFilters,
		handleShowFilter,
		handleFilterChange,
		visibleFilters,
		handleHideFilter,
		handleResetFilters,
		activeFilterDropdown,
		setActiveFilterDropdown,
		isFiltersPanelVisible,
		tableLabel,
	} = useDataTableContext();

	if (!isFiltersPanelVisible || visibleFilters.length === 0) {
		return null;
	}

	return (
		<HStack
			spacing={2}
			alignment="center"
			justify="flex-start"
			wrap={true}
			className="ppla-datatable__active-filters-row"
		>
			{visibleFilters?.map((filterId) => {
				const filterDef = filters?.find((f) => f.id === filterId);
				if (!filterDef) return null;

				const activeFilter = activeFilters?.[filterId];
				const currentValue = activeFilter?.value;
				const currentOperator =
					activeFilter?.operator || filterDef.operators?.[0] || 'is';

				let valueLabel: string | null = null;

				if (
					currentValue !== undefined &&
					currentValue !== null &&
					currentValue !== '' &&
					!(Array.isArray(currentValue) && currentValue.length === 0)
				) {
					if (filterDef.type === 'select') {
						const valuesArray = Array.isArray(currentValue)
							? currentValue
							: [currentValue];

						const labels = valuesArray.map((val) => {
							const found = filterDef.options?.find(
								(o) => String(o.value) === String(val)
							);
							return found ? found.label : String(val);
						});
						valueLabel = labels.join(', ');
					} else if (Array.isArray(currentValue)) {
						valueLabel = currentValue.join(', ');
					} else {
						valueLabel = String(currentValue);
					}
				}

				const operatorLabel =
					OPERATOR_LABELS[currentOperator] || currentOperator;

				return (
					<FilterChip
						key={filterId}
						filterId={filterId}
						filterDef={filterDef}
						activeFilter={activeFilter}
						operatorLabel={operatorLabel}
						valueLabel={valueLabel}
						onHide={() => handleHideFilter(filterId)}
						onFilterChange={handleFilterChange}
						autoOpen={activeFilterDropdown === filterId}
						onAutoOpenDone={() => setActiveFilterDropdown(null)}
					/>
				);
			})}

			{filters &&
				visibleFilters &&
				filters.length > visibleFilters.length && (
					<Dropdown
						popoverProps={{ placement: 'bottom-start' }}
						renderToggle={({
							isOpen,
							onToggle,
						}: {
							isOpen: boolean;
							onToggle: () => void;
						}) => (
							<Button
								onClick={onToggle}
								aria-expanded={isOpen}
								variant="tertiary"
								className="ppla-button"
								aria-label={sprintf(
									/* translators: %s: report or table name. */
									__('Add a filter to %s', 'primeplaced-logless-analytics'),
									tableLabel
								)}
							>
								{__(
									'Add filter',
									'primeplaced-logless-analytics'
								)}
							</Button>
						)}
						renderContent={({
							onClose,
						}: {
							onClose: () => void;
						}) => (
							<MenuGroup>
								{filters
									.filter(
										(f) => !visibleFilters.includes(f.id)
									)
									.map((f) => (
										<MenuItem
											key={f.id}
											isDestructive={false}
											onClick={() => {
												handleShowFilter(f.id);
												onClose();
											}}
										>
											{f.label}
										</MenuItem>
									))}
							</MenuGroup>
						)}
					/>
				)}

			{visibleFilters?.length > 0 && handleResetFilters && (
				<Button
					variant="tertiary"
					isDestructive
					onClick={handleResetFilters}
					className="ppla-button"
					aria-label={sprintf(
						/* translators: %s: report or table name. */
						__('Reset filters for %s', 'primeplaced-logless-analytics'),
						tableLabel
					)}
				>
					{__('Reset', 'primeplaced-logless-analytics')}
				</Button>
			)}
		</HStack>
	);
};
