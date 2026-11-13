import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import { Icon } from '@wordpress/components';
import { useAppState } from '@shared/contexts';
import {
	cog,
	chartBar,
	dashboard,
	helpFilled,
	postList,
	seen,
	starFilled,
	tableOfContents,
} from '@wordpress/icons';

import type { TabDefinition } from '@admin/components/AnimatedTabs';
import { ContentSources } from '@features/ContentSources';
import { Events } from '@features/Events';
import { General } from '@features/General';
import { HelpSection } from '@features/Help';
import { RealTime } from '@features/RealTime';
import { Reports } from '@features/Reports';
import { Settings } from '@features/Settings';
import { Upgrade } from '@features/Upgrade';

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
	{
		name: 'help',
		label: __('Help', 'primeplaced-logless-analytics'),
		title: (
			<>
				<Icon icon={helpFilled} />
				<span className="ppla-animated-tabs__button-text">
					{__('Help', 'primeplaced-logless-analytics')}
				</span>
			</>
		),
		components: [HelpSection],
	},
	{
		name: 'upgrade',
		label: __('Upgrade to Pro', 'primeplaced-logless-analytics'),
		title: (
			<>
				<Icon icon={starFilled} />
				<span className="ppla-animated-tabs__button-text">
					{__('Upgrade to Pro', 'primeplaced-logless-analytics')}
				</span>
			</>
		),
		components: [Upgrade],
		className: 'ppla-animated-tabs__button--upgrade ppla-button is-pro',
	},
];

export const useAppTabs = (): TabDefinition[] => {
	const { pplaData } = useAppState();

	return useMemo(() => {
		// Plans and checkout are for site managers; the top plan has nothing to upgrade to.
		const hidden = new Set<string>();
		if (!pplaData.can_manage_settings) {
			hidden.add('settings');
			hidden.add('upgrade');
		}
		if (pplaData.active_plan === 'agency') {
			hidden.add('upgrade');
		}

		return getBaseTabs().filter((tab) => !hidden.has(tab.name));
	}, [pplaData.can_manage_settings, pplaData.active_plan]);
};
