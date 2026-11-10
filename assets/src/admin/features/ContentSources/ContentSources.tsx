/**
 * Content and Sources Tab Module.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';

import {
	StickyLayout,
	type StickySectionDef,
} from '@admin/components/StickyLayout';
import type { SettingsComponentProps } from '@admin/components/AnimatedTabs';

import { TopPagesSection } from './components/TopPagesSection';
import { TopReferrersSection } from './components/TopReferrersSection';
import { Top404ErrorsSection } from './components/Top404ErrorsSection';


const ContentSourcesLayout = ({
	className,
}: SettingsComponentProps): JSX.Element => {
	const baseSections = useMemo<StickySectionDef[]>(
		() => [
			{
				id: 'top-pages',
				title: __('Top Pages', 'primeplaced-logless-analytics'),
				component: TopPagesSection,
			},
			{
				id: 'top-referrers',
				title: __('Top Traffic Sources', 'primeplaced-logless-analytics'),
				component: TopReferrersSection,
			},
			{
				id: 'top-404-errors',
				title: __('Top 404 Errors', 'primeplaced-logless-analytics'),
				component: Top404ErrorsSection,
			},
		],
		[]
	);

	const sections = useMemo(() => {
		return applyFilters(
			'ppla.ui.ContentSourcesSections',
			baseSections
		) as StickySectionDef[];
	}, [baseSections]);

	return (
		<div className="ppla-content-sources">
			<StickyLayout
				title={__('Traffic & Content', 'primeplaced-logless-analytics')}
				sections={sections}
				className={className}
				layout="stack"
			/>
		</div>
	);
};

export const ContentSources = (props: SettingsComponentProps): JSX.Element => {
	return <ContentSourcesLayout {...props} />;
};
