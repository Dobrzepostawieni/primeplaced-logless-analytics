import { __, sprintf } from '@wordpress/i18n';
import { cn } from '@shared/utils/formatting';
import {
	formatSigned,
	formatSignedDuration,
	formatSignedPercent,
	formatSignedPoints,
} from '@shared/utils/numberFormat';
import type { StatCardProps, StatValue } from '../types';

/**
 * A percentage exaggerates changes from a small base (33 → 1315 reads as
 * +3885%), so below this previous-period count, or above the cap, the card
 * shows the absolute difference instead.
 */
const MIN_PERCENT_BASELINE = 100;
const MAX_READABLE_PERCENT = 500;

const describeChange = ( data: StatValue ): string => {
	const { value, previous, trend, trend_unit: unit } = data;

	if ( null === trend || null === value || null === previous ) {
		return '';
	}

	if ( 'points' === unit ) {
		return formatSignedPoints( trend );
	}

	if ( 'seconds' === unit ) {
		return formatSignedDuration( trend );
	}

	const isSmallBase = previous < MIN_PERCENT_BASELINE || Math.abs( trend ) > MAX_READABLE_PERCENT;
	if ( isSmallBase && Number.isInteger( value ) && Number.isInteger( previous ) ) {
		return formatSigned( value - previous );
	}

	return formatSignedPercent( trend );
};

export const StatCard = ( {
	title,
	data,
	isLoading,
	formatValue,
	detail,
}: StatCardProps ): JSX.Element => {
	const isUnavailable = ! isLoading && ( ! data || null === data.value );
	const change = data ? describeChange( data ) : '';
	const previous = data && null !== data.previous ? formatValue( data.previous ) : '';

	const renderComparison = (): string => {
		if ( ! data || isUnavailable ) {
			return __( 'Not measured in strict anonymous mode', 'primeplaced-logless-analytics' );
		}

		if ( null === data.trend ) {
			return ( data.value ?? 0 ) > 0
				? __( 'New: no data in the previous period', 'primeplaced-logless-analytics' )
				: __( 'No data in either period', 'primeplaced-logless-analytics' );
		}

		if ( 'neutral' === data.status ) {
			return sprintf(
				/* translators: %s: metric value in the previous period. */
				__( 'No change (previously %s)', 'primeplaced-logless-analytics' ),
				previous
			);
		}

		return sprintf(
			/* translators: 1: signed change, e.g. +12.5%, 2: metric value in the previous period. */
			__( '%1$s vs previous period (%2$s)', 'primeplaced-logless-analytics' ),
			change,
			previous
		);
	};

	// Colour says whether the change is good; the arrow says which way it went.
	const status = data && ! isUnavailable && null !== data.trend ? data.status : 'neutral';
	const direction = 'neutral' !== status && data?.trend ? Math.sign( data.trend ) : 0;

	return (
		<div className="ppla-stats-card">
			<span className="ppla-stats-card-title">{ title }</span>
			{ isLoading ? (
				<div className="ppla-stats-card-spinner">
					<div className="ppla-spinner" />
				</div>
			) : (
				<span className="ppla-stats-card-value">
					{ data && null !== data.value ? formatValue( data.value ) : '—' }
				</span>
			) }
			<span className={ cn( 'ppla-stats-card-trend', `is-${ status }` ) }>
				{ direction > 0 && <span aria-hidden="true">▲ </span> }
				{ direction < 0 && <span aria-hidden="true">▼ </span> }
				{ isLoading ? '' : renderComparison() }
			</span>
			{ detail && ! isLoading && (
				<span className="ppla-stats-card-detail">{ detail }</span>
			) }
		</div>
	);
};
