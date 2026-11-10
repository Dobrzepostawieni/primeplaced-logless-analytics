import type { ComponentType, ReactNode } from 'react';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import type { MeasurementMeta } from '@shared/types';

/**
 * Types for the Events feature.
 *
 * @package
 */

export interface EventStat {
	id: string;
	event_type: string;
	provider_id: string;
	total_events: number;
	total_value: number;
}

export interface EventsPaginatedResult<T> {
	items: T[];
	total_items: number;
}

export interface EventsApiResponse extends MeasurementMeta {
	success: boolean;
	range: number;
	events?: EventsPaginatedResult<Omit<EventStat, 'id'>>;
}

export interface EventsWorkspaceTab {
	id: string;
	label: string;
	configurationTitle?: ReactNode;
	reportTitle: ReactNode;
	configuration?: ComponentType<StickySectionProps>;
	report: ComponentType<StickySectionProps>;
	/** A generic one-panel extension point. Core does not know which module owns it. */
	view?: 'workspace' | 'report' | 'single';
}

export interface EventWorkspacePanel {
	id: string;
	reportId: string;
}

export interface EventWorkspaceReport {
	id: string;
	title: ReactNode;
	component: ComponentType<StickySectionProps>;
}
