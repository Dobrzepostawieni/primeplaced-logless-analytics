/**
 * Admin and public links used by the Help, Upgrade and pricing surfaces.
 *
 * @package
 */
export const PRICING_PAGE_URL =
	'admin.php?page=primeplaced-logless-analytics-pricing';
export const UPGRADE_TAB_URL =
	'admin.php?page=primeplaced-logless-analytics&tab=upgrade';
export const PLUGIN_PAGE_URL =
	'https://wordpress.org/plugins/primeplaced-logless-analytics/';
export const SUPPORT_FORUM_URL =
	'https://wordpress.org/support/plugin/primeplaced-logless-analytics/';
export const CONTACT_URL = 'https://dobrzepostawieni.pl';

export const openExternalLink = (url: string): void => {
	window.open(url, '_blank', 'noopener,noreferrer');
};

export const openAdminLink = (path: string): void => {
	window.open(path, '_self');
};
