import { __, sprintf } from '@wordpress/i18n';
import {
	CheckboxControl,
	Button,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalHStack as HStack,
} from '@wordpress/components';
import { useInstanceId } from '@wordpress/compose';
import { close } from '@wordpress/icons';
import { useDataTableContext } from '../../DataTableContext';


export const DataTableBulkActions = () => {
	const {
		selectedRowIds,
		boundBulkActions,
		clearSelection,
		currentPage,
		totalItems,
		perPage,
		selectable,
		isAllCurrentPageSelected,
		isIndeterminate,
		handleSelectAllTrigger,
	} = useDataTableContext();

	const isBulkMode = selectedRowIds.length > 0;
	const currentCount = Math.min(
		perPage,
		totalItems - (currentPage - 1) * perPage
	);

	const checkboxId = useInstanceId(
		DataTableBulkActions,
		'ppla-datatable-bulk-checkbox'
	) as string;

	return (
		<div className="ppla-datatable__footer-bulkactions">
			{selectable && (
				<>
					<CheckboxControl
						id={checkboxId}
						checked={isAllCurrentPageSelected}
						indeterminate={isIndeterminate}
						onChange={handleSelectAllTrigger}
						
						className="ppla-datatable__bulk-checkbox ppla-checkbox-control"
					/>
					<label htmlFor={checkboxId} className="screen-reader-text">
						{__(
							'Select all on this page',
							'primeplaced-logless-analytics'
						)}
					</label>
				</>
			)}

			{!isBulkMode ? (
				<span>
					{totalItems > 0
						? sprintf(
								/* translators: 1: current visible count, 2: total items */
								__(
									'%1$d of %2$d items',
									'primeplaced-logless-analytics'
								),
								currentCount,
								totalItems
						  )
						: __('0 items', 'primeplaced-logless-analytics')}
				</span>
			) : (
				<HStack justify="flex-start" alignment="center" spacing={2}>
					<span className="ppla-datatable__bulk-count">
						{sprintf(
							/* translators: %d: number of selected table rows. */
							__('%d selected', 'primeplaced-logless-analytics'),
							selectedRowIds.length
						)}
					</span>

					<div className="ppla-datatable__bulk-divider" />

					{boundBulkActions.map((action) => (
						<Button
							key={action.id}
							variant="secondary"
							isDestructive={action.isDestructive}
							icon={action.icon}
							onClick={action.onClick}
							className="ppla-button"
						>
							{action.label}
						</Button>
					))}

					<div className="ppla-datatable__bulk-spacer" />

					<Button
						icon={close}
						variant="tertiary"
						onClick={clearSelection}
						aria-label={__(
							'Clear selection',
							'primeplaced-logless-analytics'
						)}
						className="ppla-button"
					/>
				</HStack>
			)}
		</div>
	);
};
