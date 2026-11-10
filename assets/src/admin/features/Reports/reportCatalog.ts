import { __ } from '@wordpress/i18n';
import type { CsvColumn } from '@admin/components/ReportTableActions';
import type { ReportNavigationTarget } from './reportNavigation';
import { getEventLabel, isEventVisible } from '@shared/utils/eventLabels';
import { getSourceLabel } from '@shared/utils/sourceLabels';
import { getDeviceLabel } from '@shared/utils/deviceLabels';
import { formatDuration, formatPercent } from '@shared/utils/numberFormat';

export type ReportPlan = 'free' | 'basic' | 'business' | 'agency';

export interface ReportDefinition {
	id: string;
	title: string;
	description: string;
	category: string;
	plan: ReportPlan;
	/** Canonical tab/section opened by the View Report action. */
	navigation?: ReportNavigationTarget;
	/** Optional direct export contract. Pro registrations may add one later. */
	export?: ReportExportDefinition;
}

export interface ReportExportPage {
	rows: unknown[];
	totalItems?: number;
}

export interface ReportExportDefinition {
	filename: string;
	columns: CsvColumn<unknown>[];
	getRequestPath: (range: number, page: number, perPage: number) => string;
	parseResponse: (response: unknown) => ReportExportPage;
}

const asRecord = (value: unknown): Record<string, unknown> =>
	typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)
		: {};

const asString = (value: unknown): string =>
	typeof value === 'string' ? value : String(value ?? '');

const asNumber = (value: unknown): number =>
	typeof value === 'number' ? value : Number(value ?? 0);

const parseArrayResponse = (response: unknown, key: string): ReportExportPage => {
	const payload = asRecord(response);
	const rows = Array.isArray(payload[key]) ? payload[key] : [];

	return { rows, totalItems: rows.length };
};

const parsePaginatedResponse = (
	response: unknown,
	key: 'pages' | 'referrers' | '404_errors' | 'events'
): ReportExportPage => {
	const payload = asRecord(response);
	const result = asRecord(payload[key]);
	const rows = Array.isArray(result.items) ? result.items : [];

	return {
		rows,
		totalItems:
			typeof result.total_items === 'number'
				? result.total_items
				: rows.length,
	};
};

const contentExportPath = (type: 'pages' | 'referrers', range: number, page: number, perPage: number): string => {
	const params = new URLSearchParams({
		range: range.toString(),
		page: page.toString(),
		per_page: perPage.toString(),
		search: '',
		orderby: type === 'pages' ? 'views' : 'visits',
		order: 'desc',
		type,
	});

	return `/ppla/v1/dashboard/content?${params.toString()}`;
};

const numberValue = (row: unknown, key: string): number =>
	asNumber(asRecord(row)[key]);

const stringValue = (row: unknown, key: string): string =>
	asString(asRecord(row)[key]);

const coreReportExports: Record<string, ReportExportDefinition> = {
	'daily-traffic': {
		filename: 'ppla-daily-traffic',
		columns: [
			{ header: __('Date', 'primeplaced-logless-analytics'), value: (row) => stringValue(row, 'date_iso') || stringValue(row, 'date') },
			{ header: __('Pageviews', 'primeplaced-logless-analytics'), value: (row) => numberValue(row, 'pageviews') },
			{ header: __('Visits', 'primeplaced-logless-analytics'), value: (row) => numberValue(row, 'visits') },
		],
		getRequestPath: (range) => `/ppla/v1/dashboard/charts?range=${range}`,
		parseResponse: (response) => parseArrayResponse(response, 'traffic'),
	},
	'top-pages': {
		filename: 'ppla-sources-pages',
		columns: [
			{ header: __('Title', 'primeplaced-logless-analytics'), value: (row) => stringValue(row, 'title') },
			{ header: __('URL', 'primeplaced-logless-analytics'), value: (row) => stringValue(row, 'url') },
			{ header: __('Pageviews', 'primeplaced-logless-analytics'), value: (row) => numberValue(row, 'views') },
			{ header: __('Share', 'primeplaced-logless-analytics'), value: (row) => formatPercent(numberValue(row, 'percentage')) },
			{ header: __('Bounce Rate', 'primeplaced-logless-analytics'), value: (row) => formatPercent(numberValue(row, 'bounce_rate')) },
			{ header: __('Avg. Time', 'primeplaced-logless-analytics'), value: (row) => formatDuration(numberValue(row, 'avg_time')) },
		],
		getRequestPath: (range, page, perPage) => contentExportPath('pages', range, page, perPage),
		parseResponse: (response) => parsePaginatedResponse(response, 'pages'),
	},
	'top-referrers': {
		filename: 'ppla-sources-referrers',
		columns: [
			{ header: __('Source', 'primeplaced-logless-analytics'), value: (row) => getSourceLabel(stringValue(row, 'source')) },
			{ header: __('Visits', 'primeplaced-logless-analytics'), value: (row) => numberValue(row, 'visits') },
			{ header: __('Share', 'primeplaced-logless-analytics'), value: (row) => formatPercent(numberValue(row, 'percentage')) },
		],
		getRequestPath: (range, page, perPage) => contentExportPath('referrers', range, page, perPage),
		parseResponse: (response) => parsePaginatedResponse(response, 'referrers'),
	},
	'top-404-errors': {
		filename: 'ppla-sources-404',
		columns: [
			{ header: __('Broken URL', 'primeplaced-logless-analytics'), value: (row) => stringValue(row, 'url') },
			{ header: __('Error Count', 'primeplaced-logless-analytics'), value: (row) => numberValue(row, 'count') },
		],
		getRequestPath: (range, page, perPage) => `/ppla/v1/dashboard/404-errors?range=${range}&page=${page}&per_page=${perPage}&search=&orderby=count&order=desc`,
		parseResponse: (response) => parsePaginatedResponse(response, '404_errors'),
	},
	'tracked-events': {
		filename: 'ppla-tracked-events',
		columns: [
			{ header: __('Event', 'primeplaced-logless-analytics'), value: (row) => getEventLabel(stringValue(row, 'event_type')) },
			{ header: __('Event ID', 'primeplaced-logless-analytics'), value: (row) => stringValue(row, 'event_type') },
			{ header: __('Provider', 'primeplaced-logless-analytics'), value: (row) => stringValue(row, 'provider_id') },
			{ header: __('Total Count', 'primeplaced-logless-analytics'), value: (row) => numberValue(row, 'total_events') },
			{ header: __('Total Value', 'primeplaced-logless-analytics'), value: (row) => numberValue(row, 'total_value') },
		],
		getRequestPath: (range, page, perPage) => `/ppla/v1/dashboard/events?range=${range}&page=${page}&per_page=${perPage}&search=&orderby=total_events&order=desc`,
		parseResponse: (response) => {
			const parsed = parsePaginatedResponse(response, 'events');

			return {
				...parsed,
				rows: parsed.rows.filter((row) => isEventVisible(stringValue(row, 'event_type'))),
			};
		},
	},
	'real-time': {
		filename: 'ppla-realtime',
		columns: [
			{ header: __('Active Page', 'primeplaced-logless-analytics'), value: (row) => stringValue(row, 'url') },
			{ header: __('Source', 'primeplaced-logless-analytics'), value: (row) => getSourceLabel(stringValue(row, 'source')) },
			{ header: __('Duration', 'primeplaced-logless-analytics'), value: (row) => formatDuration(numberValue(row, 'time_on_page')) },
			{ header: __('Device', 'primeplaced-logless-analytics'), value: (row) => getDeviceLabel(stringValue(row, 'device_type')) },
		],
		getRequestPath: (range, page, perPage) => `/ppla/v1/dashboard/realtime?range=${range}&page=${page}&per_page=${perPage}`,
		parseResponse: (response) => parseArrayResponse(response, 'hits'),
	},
};

export const baseReportCatalog: ReportDefinition[] = [
	{
		id: 'daily-traffic',
		title: __('Daily traffic', 'primeplaced-logless-analytics'),
		description: __(
			'A detailed table of daily visits and pageviews.',
			'primeplaced-logless-analytics'
		),
		category: __('Core reports', 'primeplaced-logless-analytics'),
		plan: 'free',
		navigation: { tab: 'general', section: 'daily-traffic-data' },
		export: coreReportExports['daily-traffic'],
	},
	{
		id: 'top-pages',
		title: __('Top Pages', 'primeplaced-logless-analytics'),
		description: __(
			'Pages that received the most visits in the selected range.',
			'primeplaced-logless-analytics'
		),
		category: __('Content reports', 'primeplaced-logless-analytics'),
		plan: 'free',
		navigation: { tab: 'content', section: 'top-pages' },
		export: coreReportExports['top-pages'],
	},
	{
		id: 'top-referrers',
		title: __('Top Referrers', 'primeplaced-logless-analytics'),
		description: __(
			'Where visitors came from before they reached the site.',
			'primeplaced-logless-analytics'
		),
		category: __('Content reports', 'primeplaced-logless-analytics'),
		plan: 'free',
		navigation: { tab: 'content', section: 'top-referrers' },
		export: coreReportExports['top-referrers'],
	},
	{
		id: 'top-404-errors',
		title: __('Top 404 Errors', 'primeplaced-logless-analytics'),
		description: __(
			'Broken paths visitors requested most often.',
			'primeplaced-logless-analytics'
		),
		category: __('Content reports', 'primeplaced-logless-analytics'),
		plan: 'free',
		navigation: { tab: 'content', section: 'top-404-errors' },
		export: coreReportExports['top-404-errors'],
	},
	{
		id: 'tracked-events',
		title: __('Tracked Events', 'primeplaced-logless-analytics'),
		description: __(
			'Counts and values for interactions recorded by the tracker.',
			'primeplaced-logless-analytics'
		),
		category: __('Events & goals', 'primeplaced-logless-analytics'),
		plan: 'free',
		navigation: { tab: 'events', section: 'events' },
		export: coreReportExports['tracked-events'],
	},
	{
		id: 'real-time',
		title: __('Real-Time', 'primeplaced-logless-analytics'),
		description: __(
			'The latest activity signal from the public site.',
			'primeplaced-logless-analytics'
		),
		category: __('Core reports', 'primeplaced-logless-analytics'),
		plan: 'free',
		navigation: { tab: 'realtime', section: 'live-traffic' },
		export: coreReportExports['real-time'],
	},
];

export const isReportAvailable = (
	requiredPlan: ReportPlan,
	activePlan: string
): boolean => {
	const planOrder: Record<ReportPlan, number> = {
		free: 0,
		basic: 1,
		business: 2,
		agency: 3,
	};
	const normalizedPlan = activePlan.trim().toLowerCase() as ReportPlan;
	return planOrder[normalizedPlan] >= planOrder[requiredPlan];
};

export const getReportPlanLabel = (plan: ReportPlan): string => {
	const labels: Record<ReportPlan, string> = {
		free: __('Free', 'primeplaced-logless-analytics'),
		basic: __('Basic', 'primeplaced-logless-analytics'),
		business: __('Business', 'primeplaced-logless-analytics'),
		agency: __('Agency', 'primeplaced-logless-analytics'),
	};

	return labels[plan];
};
