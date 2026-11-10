/**
 * Locale-aware number formatting for the admin dashboard.
 *
 * WordPress renders the admin `<html lang>` from the user's locale, so every
 * figure follows the language of the interface rather than the browser.
 *
 * @package
 */
import { __, sprintf } from '@wordpress/i18n';

const getLocale = (): string => {
	const lang = typeof document !== 'undefined' ? document.documentElement.lang : '';

	return lang || 'en-US';
};

const formatters = new Map<string, Intl.NumberFormat>();

const getFormatter = (options: Intl.NumberFormatOptions): Intl.NumberFormat => {
	const key = `${getLocale()}|${JSON.stringify(options)}`;
	let formatter = formatters.get(key);

	if (!formatter) {
		try {
			formatter = new Intl.NumberFormat(getLocale(), options);
		} catch {
			formatter = new Intl.NumberFormat('en-US', options);
		}
		formatters.set(key, formatter);
	}

	return formatter;
};

const toNumber = (value: number | string | null | undefined): number => {
	const parsed = typeof value === 'number' ? value : Number(value);

	return Number.isFinite(parsed) ? parsed : 0;
};

/** Formats a count, e.g. `1 322`. */
export const formatNumber = (value: number | string | null | undefined): string =>
	getFormatter({ maximumFractionDigits: 0 }).format(toNumber(value));

/** Formats a value with up to `digits` decimals, e.g. `12,5` or `12`. */
const formatAmount = (value: number | string | null | undefined, digits = 2): string =>
	getFormatter({ maximumFractionDigits: digits }).format(toNumber(value));

/** Formats a money value; falls back to a plain amount for an unknown currency. */
export const formatMoney = (value: number | string | null | undefined, currency: string): string =>
	/^[A-Z]{3}$/.test(currency)
		? getFormatter({ style: 'currency', currency, maximumFractionDigits: 2 }).format(toNumber(value))
		: formatAmount(value);

/** Formats a date with the time in the interface language. */
export const formatDateTime = (date: Date): string => date.toLocaleString(getLocale());

/** Formats the time of day in the interface language. */
export const formatTime = (date: Date): string => date.toLocaleTimeString(getLocale());

/** Formats a value with a fixed number of decimals, e.g. `4,7`. */
export const formatDecimal = (value: number | string | null | undefined, digits = 1): string =>
	getFormatter({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(toNumber(value));

/** Formats a percentage given on a 0-100 scale, e.g. `21,8%`. */
export const formatPercent = (value: number | string | null | undefined, digits = 1): string =>
	getFormatter({
		style: 'percent',
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	}).format(toNumber(value) / 100);

/** Formats a signed value with an explicit plus sign, e.g. `+12,5`. */
export const formatSigned = (value: number, digits = 0): string =>
	getFormatter({
		signDisplay: 'exceptZero',
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	}).format(value);

/** Formats a signed percentage change, e.g. `+12,5%`. */
export const formatSignedPercent = (value: number, digits = 1): string =>
	getFormatter({
		style: 'percent',
		signDisplay: 'exceptZero',
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	}).format(value / 100);

/** Formats a signed change in percentage points, e.g. `-18,2 pp`. */
export const formatSignedPoints = (value: number): string =>
	sprintf(
		/* translators: %s: signed number of percentage points, e.g. -18.2 */
		__('%s pp', 'primeplaced-logless-analytics'),
		formatSigned(value, 1)
	);

/** Formats seconds as `m:ss`, or `h:mm:ss` from one hour. */
export const formatDuration = (seconds: number | string | null | undefined): string => {
	const total = Math.max(0, Math.round(Math.abs(toNumber(seconds))));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const rest = String(total % 60).padStart(2, '0');

	return hours > 0
		? `${hours}:${String(minutes).padStart(2, '0')}:${rest}`
		: `${minutes}:${rest}`;
};

/** Formats a signed duration change, e.g. `+4:30`. */
export const formatSignedDuration = (seconds: number): string => {
	if (0 === seconds) {
		return formatDuration(0);
	}

	return `${seconds > 0 ? '+' : '−'}${formatDuration(seconds)}`;
};
