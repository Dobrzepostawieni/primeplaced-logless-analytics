import type { ReactNode, ComponentType } from 'react';

export interface SettingsComponentProps {
	className?: string;
}

export type TabKey =
	| 'general'
	| 'reports'
	| 'content'
	| 'realtime'
	| 'events'
	| 'settings'
;

export interface TabDefinition {
	name: TabKey;
	/** Plain-text name for the browser title and the icon-only narrow layout. */
	label?: string;
	title: string | ReactNode;
	components: ComponentType<SettingsComponentProps>[];
	className?: string;
}

export interface AnimatedTabsProps {
	tabs: TabDefinition[];
	activeTab: TabKey;
	onTabChange: (tab: TabKey) => void;
}
