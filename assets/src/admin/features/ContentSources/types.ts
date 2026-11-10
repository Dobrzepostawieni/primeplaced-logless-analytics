import type { MeasurementMeta } from '@shared/types';
import type {
	ReportQueryFilterOption,
	ReportQueryState,
} from '@admin/components/ReportQuery/types';

export interface PageStat {
	id: string;
	url: string;
	title: string;
	views: number;
	percentage: number;
	bounce_rate: number;
	avg_time: number;
	previous_period?: {
		views: number;
		percentage: number;
	};
}

export interface ReferrerStat {
	id: string;
	source: string;
	visits: number;
	percentage: number;
	previous_period?: {
		visits: number;
		percentage: number;
	};
}

export interface Error404Stat {
	id: string;
	url: string;
	count: number;
	previous_period?: {
		count: number;
	};
}

export interface PaginatedResult<T> {
	items: T[];
	total_items: number;
}

export interface ReportResponseMeta {
	filters: {
		search: string;
	};
	pagination: {
		page: number;
		per_page: number;
		total_items: number;
	};
}

export interface SourceSummary {
	pageviews?: number;
	visits?: number;
	errors?: number;
}

export interface SourceComparison {
	range: number;
	summary: SourceSummary;
}

export interface ContentApiResponse extends MeasurementMeta {
	success: boolean;
	range: number;
	meta?: ReportResponseMeta;
	query?: ReportQueryState;
	filter_options?: Record<string, ReportQueryFilterOption[]>;
	summary?: SourceSummary;
	comparison?: SourceComparison | null;
	pages?: PaginatedResult<Omit<PageStat, 'id'>>;
	referrers?: PaginatedResult<Omit<ReferrerStat, 'id'>>;
	'404_errors'?: PaginatedResult<Omit<Error404Stat, 'id'>>;
}
