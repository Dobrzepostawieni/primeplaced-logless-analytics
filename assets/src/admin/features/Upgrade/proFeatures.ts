/**
 * Paid-plan features promoted on the Upgrade tab.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import {
	archive,
	backup,
	brush,
	chartBar,
	code,
	download,
	envelope,
	globe,
	link,
	page,
	people,
	pin,
	postList,
	search,
	store,
	tableOfContents,
	tag,
	update,
} from '@wordpress/icons';

export type ProPlanTier = 'basic' | 'business' | 'agency';

export interface ProFeature {
	icon: JSX.Element;
	title: string;
	description: string;
	plan: ProPlanTier;
}

export const PRO_FEATURES: ProFeature[] = [
	// --- BASIC TIER ---
	{
		icon: backup,
		title: __('Longer history', 'primeplaced-logless-analytics'),
		description: __(
			'Keep analytics data for longer and compare seasons, campaigns and year-over-year trends.',
			'primeplaced-logless-analytics'
		),
		plan: 'basic',
	},
	{
		icon: globe,
		title: __('Local geolocation', 'primeplaced-logless-analytics'),
		description: __(
			'See which countries your visitors come from. Lookups run on your own server, so no visitor IP address ever leaves it.',
			'primeplaced-logless-analytics'
		),
		plan: 'basic',
	},
	{
		icon: search,
		title: __('Site Search', 'primeplaced-logless-analytics'),
		description: __(
			'Learn what visitors search for on your site and which queries return nothing.',
			'primeplaced-logless-analytics'
		),
		plan: 'basic',
	},
	{
		icon: link,
		title: __('Referrer attribution', 'primeplaced-logless-analytics'),
		description: __(
			'Connect results with the source and medium that brought the visit, without cookies.',
			'primeplaced-logless-analytics'
		),
		plan: 'basic',
	},
	{
		icon: pin,
		title: __('Goals & conversions', 'primeplaced-logless-analytics'),
		description: __(
			'Turn existing events into goals and review conversions by source, landing page and device, compared with the previous period.',
			'primeplaced-logless-analytics'
		),
		plan: 'basic',
	},
	{
		icon: tableOfContents,
		title: __('Scroll depth', 'primeplaced-logless-analytics'),
		description: __(
			'Record how far visitors scroll, so you know which pages are actually read.',
			'primeplaced-logless-analytics'
		),
		plan: 'basic',
	},
	{
		icon: people,
		title: __('Role permissions', 'primeplaced-logless-analytics'),
		description: __(
			'Decide which user roles may open the analytics dashboard.',
			'primeplaced-logless-analytics'
		),
		plan: 'basic',
	},

	// --- BUSINESS TIER ---
	{
		icon: postList,
		title: __('Form performance', 'primeplaced-logless-analytics'),
		description: __(
			'Views, starts, submissions and failures for Contact Form 7, WPForms, Gravity Forms, Fluent Forms and Formidable Forms. Field contents are never stored.',
			'primeplaced-logless-analytics'
		),
		plan: 'business',
	},
	{
		icon: store,
		title: __('E-commerce revenue', 'primeplaced-logless-analytics'),
		description: __(
			'Orders, refunds, net revenue and average order value for WooCommerce, Easy Digital Downloads, SureCart and FluentCart, split by channel.',
			'primeplaced-logless-analytics'
		),
		plan: 'business',
	},
	{
		icon: update,
		title: __('User journeys & funnels', 'primeplaced-logless-analytics'),
		description: __(
			'Follow aggregated paths through your site, find entry and exit pages, and measure drop-off between named steps.',
			'primeplaced-logless-analytics'
		),
		plan: 'business',
	},
	{
		icon: page,
		title: __('PDF reports', 'primeplaced-logless-analytics'),
		description: __(
			'Export a ready-to-send PDF summary for clients and stakeholders.',
			'primeplaced-logless-analytics'
		),
		plan: 'business',
	},
	{
		icon: envelope,
		title: __('Weekly email report', 'primeplaced-logless-analytics'),
		description: __(
			'Receive the key numbers in your inbox every week, without logging in.',
			'primeplaced-logless-analytics'
		),
		plan: 'business',
	},
	{
		icon: archive,
		title: __('Report archive', 'primeplaced-logless-analytics'),
		description: __(
			'Keep generated reports and a history of data operations in one place.',
			'primeplaced-logless-analytics'
		),
		plan: 'business',
	},

	// --- AGENCY TIER ---
	{
		icon: chartBar,
		title: __('Page Heatmap', 'primeplaced-logless-analytics'),
		description: __(
			'See where visitors click on a page as an aggregated density overlay, without cursor recording or session replay.',
			'primeplaced-logless-analytics'
		),
		plan: 'agency',
	},
	{
		icon: brush,
		title: __('White label', 'primeplaced-logless-analytics'),
		description: __(
			'Replace the plugin branding with your own and send branded reports to clients.',
			'primeplaced-logless-analytics'
		),
		plan: 'agency',
	},
	{
		icon: tag,
		title: __('Developer Events', 'primeplaced-logless-analytics'),
		description: __(
			'Define custom events for complex interactions and manage them from one studio.',
			'primeplaced-logless-analytics'
		),
		plan: 'agency',
	},
	{
		icon: download,
		title: __('Full event log export', 'primeplaced-logless-analytics'),
		description: __(
			'Download the complete event log for external audits and your own analysis.',
			'primeplaced-logless-analytics'
		),
		plan: 'agency',
	},
	{
		icon: code,
		title: __('MainWP & WP-CLI', 'primeplaced-logless-analytics'),
		description: __(
			'Manage analytics across client sites from MainWP and automate maintenance from the command line.',
			'primeplaced-logless-analytics'
		),
		plan: 'agency',
	},
	{
		icon: backup,
		title: __('Unlimited history', 'primeplaced-logless-analytics'),
		description: __(
			'Keep analytics data for as long as you need, with no plan limit.',
			'primeplaced-logless-analytics'
		),
		plan: 'agency',
	},
];
