import { useState, Fragment } from '@wordpress/element';
import { Button, CheckboxControl } from '@wordpress/components';
import { chevronDown, chevronUp } from '@wordpress/icons';
import { useDataTableContext } from '../../DataTableContext';
import { useMediaQuery } from '@shared/hooks/useMediaQuery';
import { cn } from '@shared/utils/formatting';

export const DataTableBody = <T,>() => {
	const {
		paginatedData,
		visibleColumns,
		selectable,
		emptyContent,
		keyExtractor,
		selectedRowIds,
		handleSelectRow,
		rowClassName,
		onRowClick,
		isLoading,
	} = useDataTableContext<T>();

	const [expandedRows, setExpandedRows] = useState<Set<string | number>>(
		new Set()
	);

	const isMobile = useMediaQuery('(max-width: 782px)');

	const toggleRow = (id: string | number) => {
		setExpandedRows((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const columnsToRender = isMobile
		? visibleColumns.filter((col) => !col.hideOnMobile)
		: visibleColumns.filter((col) => !col.hideOnDesktop);

	const expandableColumns = visibleColumns.filter((col) => col.expandable);

	const hasExpandableCols = expandableColumns.length > 0;

	const colSpanCount = columnsToRender.length + (selectable ? 1 : 0);

	if (isLoading && paginatedData.length === 0) return <tbody />;

	if (paginatedData.length === 0) {
		return (
			<tbody>
				<tr>
					<td
						colSpan={colSpanCount}
						className="ppla-datatable__empty"
					>
						<p className="ppla-datatable__empty-text">
							{emptyContent}
						</p>
					</td>
				</tr>
			</tbody>
		);
	}

	return (
		<tbody>
			{paginatedData.map((row, index) => {
				const rowId = keyExtractor(row, index);
				const isSelected = selectedRowIds.includes(rowId);
				const isExpanded = expandedRows.has(rowId);

				return (
					<Fragment key={rowId}>
						<tr
							className={cn(
								'ppla-datatable__body-row',
								typeof rowClassName === 'function'
									? rowClassName(row, index)
									: rowClassName,
								isSelected && 'is-selected',
								onRowClick && 'is-clickable',
								isExpanded && isMobile && 'is-expanded'
							)}
							onClick={() => onRowClick?.(row, index)}
							onKeyDown={(event) => {
								if (
									onRowClick &&
									(event.key === 'Enter' || event.key === ' ')
								) {
									event.preventDefault();
									onRowClick(row, index);
								}
							}}
							tabIndex={onRowClick ? 0 : undefined}
						>
							{selectable && (
								<td className="ppla-datatable__body-all">
									<CheckboxControl
										checked={isSelected}
										onChange={(val: boolean) =>
											handleSelectRow(rowId, val)
										}
										className="ppla-checkbox-control"
									/>
								</td>
							)}
							{columnsToRender.map((col) => (
								<td
									key={col.id}
									data-header={
										typeof col.header === 'string'
											? col.header
											: undefined
									}
									className={cn(
										'ppla-datatable__cell',
										col.isFixed === 'left' &&
											'ppla-datatable__body-fixed-left',
										col.isActionColumn &&
											'ppla-datatable__body-actions',
										typeof col.cellClassName === 'function'
											? col.cellClassName(row)
											: col.cellClassName
									)}
								>
									{!col.isActionColumn ? (
										<span className="ppla-datatable__cell-wrapper">
											{col.cell(row, index)}
										</span>
									) : (
										<div className="ppla-datatable__action-cell-inner">
											{col.cell(row, index)}

											{isMobile && hasExpandableCols && (
												<Button
													icon={
														isExpanded
															? chevronUp
															: chevronDown
													}
													onClick={() =>
														toggleRow(rowId)
													}
													variant="tertiary"
													className="ppla-button ppla-expander-btn"
													aria-expanded={isExpanded}
												/>
											)}
										</div>
									)}
								</td>
							))}
						</tr>
						{isExpanded && isMobile && hasExpandableCols && (
							<tr
								className={cn(
									'ppla-datatable__expanded-row',
									typeof rowClassName === 'function'
										? rowClassName(row, index)
										: rowClassName
								)}
							>
								<td colSpan={colSpanCount + 1}>
									<div className="ppla-datatable__expanded-content">
										{expandableColumns.map((col) => (
											<div
												className="ppla-datatable__expanded-item"
												key={`exp-${col.id}`}
											>
												<span className="ppla-datatable__expanded-label">
													{col.header}
												</span>
												<span className="ppla-datatable__expanded-value">
													{col.cell(row, index)}
												</span>
											</div>
										))}
									</div>
								</td>
							</tr>
						)}
					</Fragment>
				);
			})}
		</tbody>
	);
};
