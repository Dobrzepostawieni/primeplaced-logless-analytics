import { useState, useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
	SearchControl,
	Dropdown,
	Button,
	MenuGroup,
	MenuItem,
} from '@wordpress/components';
import { funnel } from '@wordpress/icons';
import { cn } from '@shared/utils/formatting';
import { useDataTableContext } from '../../DataTableContext';

export const DataTableSearch = () => {
	const {
		searchQuery,
		handleSearchChange,
		filters,
		visibleFilters,
		handleShowFilter,
		isFiltersPanelVisible,
		setIsFiltersPanelVisible,
		searchLabel,
		tableLabel,
	} = useDataTableContext();

	const [localQuery, setLocalQuery] = useState(searchQuery || '');

	useEffect(() => {
		const timer = setTimeout(() => {
			if (localQuery !== searchQuery) {
				handleSearchChange(localQuery);
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [localQuery, handleSearchChange, searchQuery]);

	useEffect(() => {
		setLocalQuery(searchQuery || '');
	}, [searchQuery]);

	if (!handleSearchChange) {
		return null;
	}

	const hasActiveFilters = visibleFilters && visibleFilters.length > 0;

	return (
		<>
			<SearchControl
				value={localQuery}
				onChange={setLocalQuery}
				placeholder={__('Search this report', 'primeplaced-logless-analytics')}
				aria-label={searchLabel}
				autoComplete="off"
				data-1p-ignore="true"
				data-lpignore="true"
				size="compact"
				className="ppla-datatable-search-control"
				__nextHasNoMarginBottom
			/>

			{filters && filters.length > 0 && (
				<>
					{!hasActiveFilters && (
						<Dropdown
							popoverProps={{ placement: 'bottom-end' }}
							renderToggle={({
								isOpen,
								onToggle,
							}: {
								isOpen: boolean;
								onToggle: () => void;
							}) => (
								<Button
									icon={funnel}
									onClick={onToggle}
									aria-expanded={isOpen}
									variant="tertiary"
									label={sprintf(
										/* translators: %s: report or table name. */
										__('Filter %s', 'primeplaced-logless-analytics'),
										tableLabel
									)}
									className="ppla-button ppla-datatable-search-button"
								/>
							)}
							renderContent={({
								onClose,
							}: {
								onClose: () => void;
							}) => (
							<MenuGroup>
								{filters.map((f) => (
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
					{hasActiveFilters && (
						<Button
							icon={funnel}
							onClick={() =>
								setIsFiltersPanelVisible((prev) => !prev)
							}
							variant="tertiary"
							className={cn(
								'ppla-button ppla-datatable-search-button',
								isFiltersPanelVisible && 'is-active'
							)}
							aria-label={sprintf(
								/* translators: %s: report or table name. */
								__('Show or hide filters for %s', 'primeplaced-logless-analytics'),
								tableLabel
							)}
						>
							<span className="ppla-datatable-search-button-number">
								{visibleFilters.length}
							</span>
						</Button>
					)}
				</>
			)}
		</>
	);
};
