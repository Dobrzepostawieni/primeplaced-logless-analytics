import { __, sprintf } from '@wordpress/i18n';
import { formatNumber, formatSignedPercent, formatSignedPoints } from '@shared/utils/numberFormat';

export type ReportComparisonBadgeMode = 'relative' | 'points';

interface ReportComparisonBadgeProps {
	current: number;
	previous: number;
	metricLabel: string;
	mode?: ReportComparisonBadgeMode;
	increaseIsNegative?: boolean;
}

/**
 * Displays a current-row change against the matching previous period.
 *
 * Reports supply their metric label and whether an increase is adverse, so the
 * visual language stays consistent without making one report depend on another.
 */
export const ReportComparisonBadge = ( {
	current,
	previous,
	metricLabel,
	mode = 'relative',
	increaseIsNegative = false,
}: ReportComparisonBadgeProps ): JSX.Element => {
	const difference = current - previous;
	const isNew = previous === 0 && current > 0;
	let direction: 'up' | 'down' | 'same' = 'same';
	if (difference > 0) {
		direction = 'up';
	} else if (difference < 0) {
		direction = 'down';
	}

	const arrowByDirection = { up: '↑', down: '↓', same: '→' };
	const arrow = arrowByDirection[ direction ];
	const isNegativeTrend = increaseIsNegative ? difference > 0 : difference < 0;
	let formattedDifference: string;

	if (mode === 'relative') {
		formattedDifference = formatSignedPercent(
			previous > 0 ? Math.round( ( difference / previous ) * 100 ) : 0,
			0
		);
	} else {
		formattedDifference = formatSignedPoints( difference );
	}

	let label: string;
	if (isNew) {
		label = sprintf(
			/* translators: 1: current value, 2: metric label. */
			__( 'New result with %1$s current %2$s', 'primeplaced-logless-analytics' ),
			formatNumber(current),
			metricLabel
		);
	} else {
		label = sprintf(
			/* translators: 1: change amount, 2: metric label. */
			__( '%1$s %2$s compared with the previous period', 'primeplaced-logless-analytics' ),
			formattedDifference,
			metricLabel
		);
	}

	let trendColor = '#067a46';
	let trendBackgroundColor = '#edfaef';
	if (isNegativeTrend) {
		trendColor = '#b32d2e';
		trendBackgroundColor = '#fcf0f1';
	} else if (direction === 'same') {
		trendColor = '#50575e';
		trendBackgroundColor = '#f0f0f1';
	}

	return (
		<span
			className={ `ppla-comparison-badge ppla-comparison-badge--${ direction }${ isNegativeTrend ? ' ppla-comparison-badge--negative' : '' }` }
			role="img"
			aria-label={ label }
			style={ {
				display: 'inline-flex',
				alignItems: 'center',
				marginInlineStart: '8px',
				padding: '1px 6px',
				borderRadius: '999px',
				fontSize: '11px',
				fontWeight: 600,
				lineHeight: 1.5,
				whiteSpace: 'nowrap',
				color: trendColor,
				backgroundColor: trendBackgroundColor,
			} }
		>
			{ isNew ? __( 'New', 'primeplaced-logless-analytics' ) : `${ arrow } ${ formattedDifference }` }
		</span>
	);
};
