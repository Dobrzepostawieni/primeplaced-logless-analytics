import { __, _n, sprintf } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import { arrowDown, arrowRight, arrowUp } from '@wordpress/icons';
import type { SourceComparison, SourceSummary } from '../types';
import { formatNumber, formatPercent } from '@shared/utils/numberFormat';

type SourceMetric = 'pageviews' | 'visits' | 'errors';

interface SourceReportSummaryProps {
	metric: SourceMetric;
	summary: SourceSummary;
	comparison: SourceComparison | null;
}

const getMetricLabel = (metric: SourceMetric, value: number): string => {
	switch (metric) {
		case 'pageviews':
			return _n(
				'pageview',
				'pageviews',
				value,
				'primeplaced-logless-analytics'
			);
		case 'errors':
			return _n(
				'error',
				'errors',
				value,
				'primeplaced-logless-analytics'
			);
		case 'visits':
		default:
			return _n(
				'visit',
				'visits',
				value,
				'primeplaced-logless-analytics'
			);
	}
};

const formatMetric = (metric: SourceMetric, value: number): string =>
	`${formatNumber(value)} ${getMetricLabel(metric, value)}`;

const getChange = (current: number, previous: number): number | null => {
	if (previous === 0) {
		return null;
	}

	return Math.round(((current - previous) / previous) * 100);
};

const getChangeDirection = ( change: number | null ): 'positive' | 'negative' | 'neutral' => {
	if ( change === null || change === 0 ) return 'neutral';
	return change > 0 ? 'positive' : 'negative';
};

const getChangeIcon = ( direction: 'positive' | 'negative' | 'neutral' ) => {
	if ( direction === 'positive' ) return arrowUp;
	if ( direction === 'negative' ) return arrowDown;
	return arrowRight;
};

const getChangeLabel = ( change: number | null, current: number ): string => {
	if ( change !== null ) return formatPercent( Math.abs( change ), 0 );
	return current === 0 ? __('No change', 'primeplaced-logless-analytics') : __('New', 'primeplaced-logless-analytics');
};


export const SourceReportSummary = ({
	metric,
	summary,
	comparison,
}: SourceReportSummaryProps): JSX.Element => {
	const current = summary[metric] || 0;
	const previous = comparison?.summary[metric] || 0;
	const change = comparison ? getChange(current, previous) : null;
	const changeDirection = getChangeDirection(change);

	return (
		<div className="ppla-source-report-summary" aria-live="polite">
			<div className="ppla-source-report-summary__current">
				<strong>{formatNumber(current)}</strong>
				<span>{getMetricLabel(metric, current)}</span>
			</div>
			{comparison && (
				<div className="ppla-source-report-summary__comparison">
					<span>{sprintf(
					/* translators: 1: comparison range in days, 2: preceding metric, 3: percentage change. */
					__('Compared with the previous %1$d days: %2$s.', 'primeplaced-logless-analytics'),
					comparison.range,
					formatMetric(metric, previous)
					)}</span>
					<span className={`ppla-source-report-summary__delta is-${changeDirection}`}>
						<Icon icon={getChangeIcon(changeDirection)} size={16} />
						{getChangeLabel(change, current)}
					</span>
				</div>
			)}
		</div>
	);
};
