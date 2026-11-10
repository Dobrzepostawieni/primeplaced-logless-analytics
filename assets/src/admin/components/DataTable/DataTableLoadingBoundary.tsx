import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { useDataTableContext } from './DataTableContext';

/** Keeps existing table rows in place while announcing a single loading state. */
export const DataTableLoadingBoundary = ({ children }: { children: ReactNode }) => {
	const { isLoading } = useDataTableContext();

	return (
		<div className="ppla-datatable__loading-boundary">
			<div aria-busy={isLoading} {...(isLoading ? { inert: '' } : {})}>
				{children}
			</div>
			{isLoading && (
				<div className="ppla-datatable__loading-overlay" role="status">
					<span className="ppla-spinner" aria-hidden="true" />
					<span className="screen-reader-text">
						{__('Loading report…', 'primeplaced-logless-analytics')}
					</span>
				</div>
			)}
		</div>
	);
};
