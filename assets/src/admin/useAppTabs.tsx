import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import { Icon } from '@wordpress/components';
import { useAppState } from '@shared/contexts';
import {
	cog,
	chartBar,
	dashboard,
	postList,
	seen,
	tableOfContents,
} from '@wordpress/icons';

import type { TabDefinition } from '@admin/components/AnimatedTabs';
import { ContentSources } from '@features/ContentSources';
import { Events } from '@features/Events';
import { General } from '@features/General';
import { RealTime } from '@features/RealTime';
import { Reports } from '@features/Reports';
import { Settings } from '@features/Settings';

const getBaseTabs = (): TabDefinition[] => [
	{
		name: 'general',
		label: __('Overview', 'primeplaced-logless-analytics'),
		title: (
			<>
				<Icon icon={dashboard} />
				<span className="ppla-animated-tabs__button-text">
					{__('Overview', 'primeplaced-logless-analytics')}
				</span>
			</>
		),
		components: [General],
	},
	{
		name: 'reports',
		label: __('Report Library', 'primeplaced-logless-analytics'),
		title: (
			<>
				<Icon icon={chartBar} />
				<span className="ppla-animated-tabs__button-text">
					{__('Report Library', 'primeplaced-logless-analytics')}
				</span>
			</>
		),
		components: [Reports],
	},
	{
		name: 'content',
		label: __('Traffic & Content', 'primeplaced-logless-analytics'),
		title: (
			<>
				<Icon icon={tableOfContents} />
				<span className="ppla-animated-tabs__button-text">
					{__('Traffic & Content', 'primeplaced-logless-analytics')}
				</span>
			</>
		),
		components: [ContentSources],
	},
	{
		name: 'events',
		label: __('Events & Goals', 'primeplaced-logless-analytics'),
		title: (
			<>
				<Icon icon={postList} />
				<span className="ppla-animated-tabs__button-text">
					{__('Events & Goals', 'primeplaced-logless-analytics')}
				</span>
			</>
		),
		components: [Events],
	},
	{
		name: 'realtime',
		label: __('Real-Time', 'primeplaced-logless-analytics'),
		title: (
			<>
				<Icon icon={seen} />
				<span className="ppla-animated-tabs__button-text">
					{__('Real-Time', 'primeplaced-logless-analytics')}
				</span>
			</>
		),
		components: [RealTime],
	},
	{
		name: 'settings',
		label: __('Settings', 'primeplaced-logless-analytics'),
		title: (
			<>
				<Icon icon={cog} />
				<span className="ppla-animated-tabs__button-text">
					{__('Settings', 'primeplaced-logless-analytics')}
				</span>
			</>
		),
		components: [Settings],
	},
];

export const useAppTabs = (): TabDefinition[] => {
	const { pplaData } = useAppState();

	return useMemo(() => {
		const tabs = getBaseTabs();

		return pplaData.can_manage_settings
			? tabs
			: tabs.filter((tab) => tab.name !== 'settings');
	}, [pplaData.can_manage_settings]);
};
