/**
 * Dashboard Stats Component.
 * Fetches overview metrics for the selected range and renders the KPI cards.
 *
 * @package
 */
import { __, sprintf } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';
import { useApi } from '@shared/api/useApi';
import { useAppState } from '@shared/contexts';
import {
	formatDecimal,
	formatDuration,
	formatNumber,
	formatPercent,
} from '@shared/utils/numberFormat';
import { StatCard } from './components/StatCard';
import type { OverviewStats } from './types';

interface DashboardStatsProps {
	/** Number of calendar days, including today. */
	range: number;
}

export const DashboardStats = ( { range }: DashboardStatsProps ): JSX.Element => {
	const { dataRefreshKey } = useAppState();
	const { fetchApi } = useApi();
	const [ stats, setStats ] = useState<OverviewStats | null>( null );
	const [ isLoading, setIsLoading ] = useState<boolean>( true );

	useEffect( () => {
		let isMounted = true;

		const fetchStats = async () => {
			setIsLoading( true );
			try {
				const data = await fetchApi<OverviewStats>( {
					path: `/ppla/v1/stats/overview?range=${ range }`,
					method: 'GET',
				} );
				if ( isMounted && data ) {
					setStats( data );
				}
			} catch ( error ) {
				// Handled by global API interceptor
			} finally {
				if ( isMounted ) {
					setIsLoading( false );
				}
			}
		};

		void fetchStats();

		return () => {
			isMounted = false;
		};
	}, [ fetchApi, dataRefreshKey, range ] );

	const isStrictAnonymous = stats?.privacy_mode === 'strict_anonymous';
	const pagesPerVisit = stats?.pages_per_visit?.value;

	return (
		<section
			className="ppla-stats-wrapper"
			aria-label={ sprintf(
				/* translators: %d: number of days in the report period. */
				__( 'Key metrics for the last %d days', 'primeplaced-logless-analytics' ),
				range
			) }
		>
			<StatCard
				title={
					isStrictAnonymous
						? __( 'Anonymous hits', 'primeplaced-logless-analytics' )
						: __( 'Visits', 'primeplaced-logless-analytics' )
				}
				data={ stats?.unique_visits }
				isLoading={ isLoading }
				formatValue={ formatNumber }
			/>
			<StatCard
				title={ __( 'Pageviews', 'primeplaced-logless-analytics' ) }
				data={ stats?.pageviews }
				isLoading={ isLoading }
				formatValue={ formatNumber }
				detail={
					typeof pagesPerVisit === 'number' && pagesPerVisit > 0
						? sprintf(
								/* translators: %s: average number of pageviews per visit, e.g. 4.7 */
								__( '%s pages per visit', 'primeplaced-logless-analytics' ),
								formatDecimal( pagesPerVisit )
						  )
						: undefined
				}
			/>
			<StatCard
				title={ __( 'Bounce rate', 'primeplaced-logless-analytics' ) }
				data={ stats?.bounce_rate }
				isLoading={ isLoading }
				formatValue={ ( value ) => formatPercent( value ) }
			/>
			<StatCard
				title={ __( 'Average visit duration', 'primeplaced-logless-analytics' ) }
				data={ stats?.avg_session }
				isLoading={ isLoading }
				formatValue={ formatDuration }
			/>
		</section>
	);
};
