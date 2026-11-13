/**
 * Help tab questions for the Free feature set.
 *
 * Paid-plan questions are appended by the Pro bundle through the
 * `ppla.ui.HelpFaqs` filter.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';

export type FaqTier = 'free' | 'basic' | 'business' | 'agency';

export const TAG_ORDER = [
	'Overview',
	'Reports',
	'Traffic & Content',
	'Events & Goals',
	'Real-Time',
	'Privacy',
	'Settings',
	'Agency tools',
] as const;

export type FaqTag = (typeof TAG_ORDER)[number];

export interface FaqItem {
	id: string;
	question: string;
	answer: string;
	tier: FaqTier;
	tag?: string;
}

export const FREE_FAQS: FaqItem[] = [
	{
		id: 'overview-check-tracking',
		tier: 'free',
		tag: 'Overview',
		question: __(
			'How do I check that tracking works?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'Open your site in a private browser window and visit a page or two. The Overview tab starts with the measurement status, and the Real-Time tab lists the pages being viewed right now.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'overview-delayed-numbers',
		tier: 'free',
		tag: 'Overview',
		question: __(
			'Why do new visits not show up in reports straight away?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'Incoming hits are first written to a local queue and added to the reports by WP-Cron. If you do not want to wait, open Settings, choose Queue & maintenance and process the queue manually.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'overview-own-visits',
		tier: 'free',
		tag: 'Overview',
		question: __(
			'Why are my own visits missing?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'Visits from excluded user roles, IP addresses and URL paths are not recorded. Check the Exclusions section in Settings, or test the site in a private window while logged out.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'reports-library',
		tier: 'free',
		tag: 'Reports',
		question: __(
			'Where do I find all available reports?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'The Report Library tab lists every report available on your plan, including Daily traffic, Top Pages, Top Referrers, Top 404 Errors, Tracked Events and Real-Time. Select a report to open it.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'reports-export',
		tier: 'free',
		tag: 'Reports',
		question: __(
			'How do I export a report?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'Use the export menu above a report table. The file contains every row that matches the selected date range, search and filters, not only the rows visible on the current page.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'reports-saved-views',
		tier: 'free',
		tag: 'Reports',
		question: __(
			'What are Saved Views?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'A Saved View stores the date range, filters and table layout of a report so you can return to it with one click. A view can stay private or be shared with other users of this dashboard.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'content-sources',
		tier: 'free',
		tag: 'Traffic & Content',
		question: __(
			'Which traffic sources are recognised?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'The Traffic & Content tab separates direct visits, referring sites, and Google Ads or Meta Ads campaigns. Each source report has its own date range.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'content-404',
		tier: 'free',
		tag: 'Traffic & Content',
		question: __(
			'Can I see which missing pages visitors hit?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'Yes. The Top 404 Errors report lists the addresses that returned a "page not found" error, so you can fix broken links or add redirects.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'events-automatic',
		tier: 'free',
		tag: 'Events & Goals',
		question: __(
			'Which events are tracked without any setup?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'Clicks on outbound links and file downloads can be recorded automatically. Review the available options in the Events & Goals tab.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'events-custom',
		tier: 'free',
		tag: 'Events & Goals',
		question: __(
			'How do I send a custom event from my theme?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'Call ppla( "track", "event_name" ) in your JavaScript once the tracker has loaded. An optional third argument passes a numeric value.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'realtime-what',
		tier: 'free',
		tag: 'Real-Time',
		question: __(
			'What does the Real-Time tab show?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'Pageviews per minute and the pages visitors are viewing right now. It reads the latest hits, so it is the quickest way to confirm that tracking works.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'privacy-cookies',
		tier: 'free',
		tag: 'Privacy',
		question: __(
			'Does the plugin use visitor cookies?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'No. The core tracking flow is cookieless.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'privacy-ip-user-agent',
		tier: 'free',
		tag: 'Privacy',
		question: __(
			'Are IP addresses or User-Agent strings stored?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'No. They are processed in memory for exclusions, device classification and the pseudonymous session hash, and are never written to the analytics tables.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'privacy-modes',
		tier: 'free',
		tag: 'Privacy',
		question: __(
			'What is the difference between the privacy modes?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'Strict anonymous mode counts hits without linking them into visits. The session mode uses a hash that rotates every day and cannot be reversed, which allows visit-based metrics without identifying anyone.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'privacy-remote',
		tier: 'free',
		tag: 'Privacy',
		question: __(
			'Is analytics data sent to a remote service?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'No. Analytics data is stored only in your WordPress database, in tables prefixed with ppla_. The Freemius SDK is used for optional opt-in usage data, licensing and upgrades, and never receives visitor analytics data.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'settings-exclusions',
		tier: 'free',
		tag: 'Settings',
		question: __(
			'Can I exclude users, IP addresses or pages?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'Yes. In Settings you can exclude user roles, individual IP addresses and URL paths. A path such as /checkout/ excludes that page, and /blog/* excludes every page below /blog/.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'settings-retention',
		tier: 'free',
		tag: 'Settings',
		question: __(
			'How long is analytics data kept?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'30 days by default. You can choose 90 days, 180 days, one year, or keep the data until you delete it. Older data is removed automatically once a day, and the maintenance tools can delete data at any time.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'settings-transport',
		tier: 'free',
		tag: 'Settings',
		question: __(
			'What happens when the REST API is blocked on my site?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'The tracker falls back automatically from the REST API to admin-ajax and then to a Beacon request. The Tracking transport section in Settings shows which route is in use.',
			'primeplaced-logless-analytics'
		),
	},
	{
		id: 'settings-uninstall',
		tier: 'free',
		tag: 'Settings',
		question: __(
			'What happens to my data when I remove the plugin?',
			'primeplaced-logless-analytics'
		),
		answer: __(
			'Deactivating the plugin keeps your data. Deleting it from the Plugins screen removes all of its database tables, options, scheduled events and per-user report preferences.',
			'primeplaced-logless-analytics'
		),
	},
];
