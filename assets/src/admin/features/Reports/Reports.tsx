import { Button, Dropdown, MenuGroup, MenuItem } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { download } from '@wordpress/icons';
import { useCallback, useMemo, useState } from '@wordpress/element';

import { useAppState } from '@shared/contexts';
import { useApi } from '@shared/api/useApi';
import { useNotices } from '@shared/components/Notices';
import { StickyLayout, type StickySectionDef } from '@admin/components/StickyLayout';
import type { SettingsComponentProps } from '@admin/components/AnimatedTabs';
import { downloadReportExport } from '@admin/components/ReportTableActions/ExportCsvButton';
import {
	baseReportCatalog,
	getReportPlanLabel,
	type ReportExportDefinition,
	isReportAvailable,
	type ReportDefinition,
} from './reportCatalog';
import { getReportRangeFromUrl, navigateToReport, type ReportExportFormat } from './reportNavigation';

// The library has no settings sections; a stable reference keeps layout effects idle.
const NO_SECTIONS: StickySectionDef[] = [];

// Reports are grouped by the dashboard tab that opens them.
const getTabGroups = (): Array<{ tab: string; label: string }> => [
	{ tab: 'general', label: __('Overview', 'primeplaced-logless-analytics') },
	{ tab: 'content', label: __('Traffic & Content', 'primeplaced-logless-analytics') },
	{ tab: 'events', label: __('Events & Goals', 'primeplaced-logless-analytics') },
	{ tab: 'realtime', label: __('Real-Time', 'primeplaced-logless-analytics') },
];

const groupReports = (
	reports: ReportDefinition[]
): Array<{ id: string; label: string; reports: ReportDefinition[] }> => {
	const groups = getTabGroups().map(({ tab, label }) => ({
		id: tab,
		label,
		reports: reports.filter((report) => report.navigation?.tab === tab),
	}));
	const knownTabs = groups.map((group) => group.id);
	const otherReports = reports.filter(
		(report) => !knownTabs.includes(report.navigation?.tab || '')
	);
	const otherCategories = Array.from(
		new Set(otherReports.map((report) => report.category))
	);

	return [
		...groups,
		...otherCategories.map((category) => ({
			id: `category-${category}`,
			label: category,
			reports: otherReports.filter((report) => report.category === category),
		})),
	].filter((group) => group.reports.length > 0);
};


export const Reports = ({ className }: SettingsComponentProps): JSX.Element => {
	const { pplaData } = useAppState();
	const { fetchApi } = useApi();
	const { notify } = useNotices();
	const [exportingReportId, setExportingReportId] = useState<string | null>(null);
	const catalog = useMemo(() => {
		return applyFilters(
			'ppla.ui.ReportsCatalog',
			baseReportCatalog
		) as ReportDefinition[];
	}, []);

	const availableDefaults = catalog.filter((report) =>
		isReportAvailable(report.plan, pplaData.active_plan)
	);
	const reportGroups = groupReports(availableDefaults);
	const lockedDefaults = catalog.filter(
		(report) => !isReportAvailable(report.plan, pplaData.active_plan)
	);
	const exportReport = useCallback(async (
		reportId: string,
		exportDefinition: ReportExportDefinition,
		format: ReportExportFormat
	): Promise<void> => {
		setExportingReportId(reportId);
		try {
			const range = getReportRangeFromUrl();
			const perPage = 100;
			const first = exportDefinition.parseResponse(
				await fetchApi({ path: exportDefinition.getRequestPath(range, 1, perPage) })
			);
			if (!first.rows.length) {
				notify(
					'EXPORT_ERROR',
					__('This report has no exportable rows.', 'primeplaced-logless-analytics')
				);
				return;
			}
			const pageCount = Math.max(1, Math.ceil((first.totalItems || first.rows.length) / perPage));
			const pages = new Array<unknown[]>(pageCount);
			pages[0] = first.rows;
			let nextPage = 2;
			const fetchNextPage = async (): Promise<void> => {
				while (nextPage <= pageCount) {
					const page = nextPage++;
					pages[page - 1] = exportDefinition.parseResponse(
						await fetchApi({ path: exportDefinition.getRequestPath(range, page, perPage) })
					).rows;
				}
			};
			await Promise.all(Array.from({ length: Math.min(4, Math.max(0, pageCount - 1)) }, fetchNextPage));
			await downloadReportExport(exportDefinition.columns, pages.flat(), `${exportDefinition.filename}-${new Date().toISOString().split('T')[0]}`, format);
			notify(
				'EXPORT_SUCCESS',
				format === 'xlsx'
					? __('Excel export started.', 'primeplaced-logless-analytics')
					: __('CSV export started.', 'primeplaced-logless-analytics')
			);
		} catch {
			notify(
				'EXPORT_ERROR',
				__('The report could not be exported. Please try again.', 'primeplaced-logless-analytics')
			);
		} finally {
			setExportingReportId(null);
		}
	}, [fetchApi, notify]);
	const renderReport = (report: ReportDefinition): JSX.Element => (
		<article
			className="ppla-report-item ppla-report-item--default"
			key={report.id}
		>
			<div className="ppla-report-item__content">
				<h5>{report.title}</h5>
				<p>{report.description}</p>
			</div>
			<div className="ppla-report-item__actions">
				<Button
					variant="primary"
					onClick={() => report.navigation && navigateToReport(report.navigation)}
					disabled={!report.navigation}
					className="ppla-button"
					aria-label={sprintf(
						/* translators: %s: report title. */
						__('View %s report', 'primeplaced-logless-analytics'),
						report.title
					)}
				>
					{__('View report', 'primeplaced-logless-analytics')}
				</Button>
				{report.export && (
					<Dropdown
						contentClassName="ppla-export-menu"
						renderToggle={({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) => (
							<Button variant="secondary" onClick={onToggle} disabled={exportingReportId === report.id} aria-expanded={isOpen} className="ppla-button">
								{exportingReportId === report.id ? __('Preparing export…', 'primeplaced-logless-analytics') : __('Export', 'primeplaced-logless-analytics')}
							</Button>
						)}
						renderContent={({ onClose }: { onClose: () => void }) => (
							<MenuGroup label={__('Export format', 'primeplaced-logless-analytics')}>
								{(['csv', 'xlsx'] as ReportExportFormat[]).map((format) => (
									<MenuItem key={format} isDestructive={false} icon={download} onClick={() => { void exportReport(report.id, report.export as ReportExportDefinition, format); onClose(); }}>
										{format === 'csv' ? __('CSV (semicolon-separated)', 'primeplaced-logless-analytics') : __('Excel workbook (.xlsx)', 'primeplaced-logless-analytics')}
									</MenuItem>
								))}
							</MenuGroup>
						)}
					/>
				)}
			</div>
		</article>
	);

	const reportContent = (
		<div className="ppla-reports">
			<section
				className="ppla-reports__section"
				aria-labelledby="ppla-default-reports-title"
			>
				<div className="ppla-reports__section-heading">
					<div>
						<h3 id="ppla-default-reports-title" className="screen-reader-text">
							{__(
								'Default reports',
								'primeplaced-logless-analytics'
							)}
						</h3>
						<p>
							{__(
								'Open a report or export its default date range.',
								'primeplaced-logless-analytics'
							)}
						</p>
					</div>
				</div>
				{reportGroups.map((group) => (
					<div className="ppla-reports__group" key={group.id}>
						<h4 className="ppla-reports__group-title">{group.label}</h4>
						<div className="ppla-reports__default-grid">
							{group.reports.map((report) => renderReport(report))}
						</div>
					</div>
				))}

				{lockedDefaults.length > 0 && (
					<div
						className="ppla-reports__locked"
						aria-label={__(
							'Reports available on higher plans',
							'primeplaced-logless-analytics'
						)}
					>
						<div>
							<strong>
								{__(
									'More reports by plan',
									'primeplaced-logless-analytics'
								)}
							</strong>
							<span>
								{__(
									'Upgrade to unlock the reports that match your site and team needs.',
									'primeplaced-logless-analytics'
								)}
							</span>
						</div>
						<div className="ppla-reports__locked-list">
							{lockedDefaults.map((report) => (
								<span key={report.id}>
									{report.title} ·{' '}
									{getReportPlanLabel(report.plan)}
								</span>
							))}
						</div>
					</div>
				)}
			</section>
		</div>
	);

	return (
		<StickyLayout
			title={__('Report Library', 'primeplaced-logless-analytics')}
			sections={NO_SECTIONS}
			beforeSections={reportContent}
			className={className}
			layout="stack"
		/>
	);
};
