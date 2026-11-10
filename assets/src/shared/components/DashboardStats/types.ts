/**
 * Types for Dashboard Stats components.
 *
 * Mirrors the `/ppla/v1/stats/overview` response built by
 * `DashboardRepository::get_overview_stats()`.
 *
 * @package
 */

export type StatStatus = 'positive' | 'negative' | 'neutral';

/** How a metric's `trend` is expressed. */
export type StatTrendUnit = 'percent' | 'points' | 'seconds';

export interface StatValue {
	/** Raw value; `null` when the privacy mode cannot measure the metric. */
	value: number | null;
	/** Same metric in the previous period of equal length. */
	previous: number | null;
	/** Change against the previous period; `null` when there is no baseline. */
	trend: number | null;
	trend_unit: StatTrendUnit;
	status: StatStatus;
	/** Server-formatted value used by PDF and email output. */
	display: string;
}

export interface OverviewStats {
	privacy_mode?: 'strict_anonymous' | 'session_hash';
	unique_visits: StatValue;
	pageviews: StatValue;
	bounce_rate: StatValue;
	avg_session: StatValue;
	pages_per_visit: StatValue;
}

export interface StatCardProps {
	title: string;
	data?: StatValue;
	isLoading: boolean;
	/** Formats the raw value and the previous-period value. */
	formatValue: (value: number) => string;
	/** Extra context line, e.g. pages per visit under pageviews. */
	detail?: string;
}
