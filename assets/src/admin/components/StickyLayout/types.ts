import type { ReactNode, ComponentType } from 'react';

export interface StickySectionDef {
	id: string;
	title: ReactNode;
	group?: string;
	headerActions?: ReactNode;
	component: ComponentType<StickySectionProps>;
	layoutClassName?: string;
}

export type StickyLayoutSectionSize = 'standard' | 'wide' | 'full';

export interface StickyLayoutPreferences {
	order: string[];
	sizes: Record<string, StickyLayoutSectionSize>;
}

export interface StickyLayoutProps {
	title: ReactNode; 
	sections: StickySectionDef[];
	beforeSections?: ReactNode;
	headerActions?: ReactNode;
	onSave?: () => void;
	onDiscard?: () => void;
	className?: string;
	layout?: 'stack' | 'masonry' | 'split' | 'grouped';
	layoutStorageKey?: string;
}

export interface StickySectionProps {
	title: ReactNode;
	isActive: boolean;
	className?: string;
	spyRef?: (element: Element | null) => void;
	headerActions?: ReactNode;
}
