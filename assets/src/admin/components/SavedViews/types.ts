/**
 * Shared report-view contracts for the admin API and UI.
 *
 * @package
 */

export type SavedViewVisibility = 'private' | 'shared';

export interface SavedViewAuthor {
	id: number;
	name: string;
}

export interface SavedReportView {
	id: string;
	storageKey: string;
	name: string;
	range: number;
	tableState: string | null;
	queryState: string | null;
	visibility: SavedViewVisibility;
	author: SavedViewAuthor;
	canEdit: boolean;
	canDelete: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface SavedReportViewInput {
	storageKey: string;
	name: string;
	range: number;
	tableState: string | null;
	queryState?: string | null;
	visibility: SavedViewVisibility;
}

export interface ReportPreference {
	range: number;
	tableState: string | null;
	queryState: string | null;
	updatedAt: string;
}

export interface ReportPreferenceInput {
	range: number;
	tableState: string | null;
	queryState?: string | null;
}
