/**
 * Overview tab.
 * Key metrics, traffic charts and the daily table share one period selector.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';

import type { SettingsComponentProps } from '@admin/components/AnimatedTabs';
import {
	StickyLayout,
	type StickySectionDef,
} from '@admin/components/StickyLayout';
import { DashboardStats } from '@shared/components/DashboardStats';
import { ChartsSection } from './components/ChartsSection/ChartsSection';
import { DailyTrafficTableSection } from './components/ChartsSection/DailyTrafficTableSection';
import { OverviewRangeControl } from './components/ChartsSection/OverviewRangeControl';
import {
	ChartsDataProvider,
	useChartsData,
} from './components/ChartsSection/useChartsData';
import { DashboardStatusSection } from './components/DashboardStatusSection';

const OverviewStats = (): JSX.Element => {
	const { range } = useChartsData();

	return <DashboardStats range={ range } />;
};

export const General = ( { className }: SettingsComponentProps ): JSX.Element => {
	const sections: StickySectionDef[] = useMemo(
		() => [
			{
				id: 'traffic-charts',
				title: __( 'Traffic and devices', 'primeplaced-logless-analytics' ),
				component: ChartsSection,
			},
			{
				id: 'daily-traffic-data',
				title: __( 'Daily traffic', 'primeplaced-logless-analytics' ),
				component: DailyTrafficTableSection,
			},
			{
				id: 'measurement-status',
				title: __( 'Measurement status', 'primeplaced-logless-analytics' ),
				component: DashboardStatusSection,
			},
		],
		[]
	);

	return (
		<ChartsDataProvider>
			<StickyLayout
				title={ __( 'Overview', 'primeplaced-logless-analytics' ) }
				sections={ sections }
				className={ className }
				headerActions={ <OverviewRangeControl /> }
				beforeSections={ <OverviewStats /> }
			/>
		</ChartsDataProvider>
	);
};
