import { __ } from '@wordpress/i18n';
import { CheckboxControl } from '@wordpress/components';
import { useInstanceId } from '@wordpress/compose';
import { useDataTableContext } from '../../DataTableContext';
import { StandardColumnHeader } from './StandardColumnHeader';
import { useMediaQuery } from '@shared/hooks/useMediaQuery';

export const DataTableHead = <T,>() => {
	const {
		selectable,
		isAllCurrentPageSelected,
		isIndeterminate,
		handleSelectAllTrigger,
		visibleColumns,
	} = useDataTableContext<T>();

	const checkboxId = useInstanceId(
		DataTableHead,
		'ppla-datatable-head-checkbox'
	) as string;

	const isMobile = useMediaQuery('(max-width: 782px)');

	const columnsToRender = isMobile
		? visibleColumns.filter((col) => !col.hideOnMobile)
		: visibleColumns.filter((col) => !col.hideOnDesktop);

	return (
		<thead>
			<tr className="ppla-datatable__head-row">
				{selectable && (
					<th scope="col" className="ppla-datatable__head-all">
						<CheckboxControl
							id={checkboxId}
							checked={isAllCurrentPageSelected}
							indeterminate={isIndeterminate}
							onChange={handleSelectAllTrigger}
							
							className="ppla-datatable__bulk-checkbox ppla-checkbox-control"
						/>
						<label
							htmlFor={checkboxId}
							className="screen-reader-text"
						>
							{__('Select all', 'primeplaced-logless-analytics')}
						</label>
					</th>
				)}
				{columnsToRender.map((column, idx) => {
					if (column.isActionColumn) {
						return (
							<th
								key={column.id}
								className="ppla-datatable__head-actions"
								scope="col"
							>
								<span>{column.header}</span>
							</th>
						);
					}

					return (
						<StandardColumnHeader
							key={column.id}
							column={column}
							idx={idx}
						/>
					);
				})}
			</tr>
		</thead>
	);
};
