import { PplaToggler } from '@shared/components/PplaToggler/PplaToggler';
/**
 * Generic controls for a report segment and period comparison.
 *
 * @package
 */
import { PplaSelectControl } from '@shared/components/PplaSelectControl';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useUnavailableAction } from '@shared/hooks/useUnavailableAction';

import type {
	ReportQueryFilterDefinition,
	ReportQueryState,
} from './types';

// A neutral option avoids gluing "All" to a noun, which breaks grammatical
// agreement in inflected languages ("Wszystkie strona").
const getShowAllLabel = (): string =>
	__('Show all', 'primeplaced-logless-analytics');

interface ReportQueryControlsProps {
	filters: ReportQueryFilterDefinition[];
	query: ReportQueryState;
	onChange: (query: ReportQueryState) => void;
}

export const ReportQueryControls = ({
	filters,
	query,
	onChange,
}: ReportQueryControlsProps): JSX.Element => {
	const hasSegment = Object.values(query.filters).some(Boolean);
	const hasQuery = hasSegment || query.comparison === 'previous_period';
	const unavailable = useUnavailableAction();

	const updateFilter = (filterId: string, value: string): void => {
		const nextFilters = { ...query.filters };
		if (value) {
			nextFilters[filterId] = value;
		} else {
			delete nextFilters[filterId];
		}
		onChange({ ...query, filters: nextFilters });
	};

	return (
		<section
			className="ppla-report-query-controls"
			aria-label={__('Report segment and comparison', 'primeplaced-logless-analytics')}
		>
			<div className="ppla-report-query-controls__fields">
				{filters.map((filter) => (
					<PplaSelectControl
						key={filter.id}
						label={filter.label}
						value={query.filters[filter.id] || ''}
						onChange={(value: string) => updateFilter(filter.id, value)}
						options={[
							{
								label: getShowAllLabel(),
								value: '',
							},
							...filter.options,
						]}
					/>
				))}
			</div>
			<PplaToggler
				isSmall
				className="ppla-report-query-controls__comparison"
				label={__(
					'Compare with previous period',
					'primeplaced-logless-analytics'
				)}
				checked={query.comparison === 'previous_period'}
				disabled={false}
				onChange={(enabled) =>
					onChange({
						...query,
						comparison: enabled ? 'previous_period' : 'none',
					})
				}
			/>
			<Button
				variant="tertiary"
				className="ppla-button ppla-report-query-controls__clear"
				disabled={!hasQuery}
				{...unavailable(
					!hasQuery &&
						__('There are no filters or comparison to clear.', 'primeplaced-logless-analytics')
				)}
				onClick={() => onChange({ comparison: 'none', filters: {} })}
			>
				{__('Clear', 'primeplaced-logless-analytics')}
			</Button>
		</section>
	);
};
