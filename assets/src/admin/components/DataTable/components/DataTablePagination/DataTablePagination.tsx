import { PplaSelectControl } from '@shared/components/PplaSelectControl';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { previous, next } from '@wordpress/icons';
import { useDataTableContext } from '../../DataTableContext';


export const DataTablePagination = () => {
	const { totalItems, perPage, currentPage, totalPages, handlePageChange } =
		useDataTableContext();

	if (totalItems < perPage + 1) return null;

	return (
		<div className="ppla-datatable__pagination">
			<span className="ppla-datatable__pagination-wrapper">
				<span className="ppla-datatable__pagination-label">
					{__('Page', 'primeplaced-logless-analytics')}
				</span>

				<PplaSelectControl
					label={__('Page', 'primeplaced-logless-analytics')}
					hideLabelFromVision
					value={currentPage.toString()}
					options={Array.from(
						{ length: Math.max(1, totalPages) },
						(_, i) => ({
							label: (i + 1).toString(),
							value: (i + 1).toString(),
						})
					)}
					onChange={(val: string) => handlePageChange(Number(val))}
					className="ppla-datatable__pagination-select"
				/>

				<span className="ppla-datatable__pagination-label ppla-datatable__pagination-label-suffix">
					{sprintf(
						/* translators: %d: total number of pages, shown after the current page selector. */
						__('of %d', 'primeplaced-logless-analytics'),
						totalPages
					)}
				</span>
			</span>
			<Button
				icon={previous}
				disabled={currentPage <= 1}
				onClick={() => handlePageChange(currentPage - 1)}
				variant="tertiary"
				aria-label={__(
					'Previous page',
					'primeplaced-logless-analytics'
				)}
				className="ppla-button ppla-datatable__pagination-arrows"
			/>
			<Button
				icon={next}
				disabled={currentPage >= totalPages}
				onClick={() => handlePageChange(currentPage + 1)}
				variant="tertiary"
				aria-label={__('Next page', 'primeplaced-logless-analytics')}
				className="ppla-button ppla-datatable__pagination-arrows"
			/>
		</div>
	);
};
