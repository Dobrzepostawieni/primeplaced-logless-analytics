/**
 * Shared report-query contracts for filterable admin reports.
 *
 * @package
 */

export type ReportComparison = 'none' | 'previous_period';

export interface ReportQueryState {
	comparison: ReportComparison;
	/** Optional neutral grouping choice owned by an individual report. */
	breakdown?: string;
	filters: Record<string, string>;
}

export interface ReportQueryFilterOption {
	value: string;
	label: string;
}

export interface ReportQueryFilterDefinition {
	id: string;
	label: string;
	options: ReportQueryFilterOption[];
}
