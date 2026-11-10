import { Button, Dropdown, MenuGroup, MenuItem } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { check, chevronDown, chevronUp, download } from '@wordpress/icons';
import { useCallback, useRef, useState } from '@wordpress/element';
import { useOptionalDataTableContext } from '@admin/components/DataTable/DataTableContext';
import { useNotices } from '@shared/components/Notices';
import { useUnavailableAction } from '@shared/hooks/useUnavailableAction';
import type { ReportExportFormat } from '@admin/features/Reports/reportNavigation';
import type { CsvColumn, ExportProgress, ExportRows } from './types';

type ExportValue = string | number | boolean | null | undefined;

interface ExportProjection {
	headers: string[];
	rows: ExportValue[][];
}

interface ExportCsvButtonProps<T> {
	columns: CsvColumn<T>[];
	filename: string;
	storageKey?: string;
	reportTitle?: string;
	exportRows?: ExportRows<T>;
	/** Rows of a report that is not rendered by a DataTable. */
	rows?: T[];
	isLoading?: boolean;
}

const projectTable = <T,>(columns: CsvColumn<T>[], rows: T[]): ExportProjection => ({
	headers: columns.map((column) => column.header),
	rows: rows.map((row) => columns.map((column) => column.value(row))),
});

const escapeCsvField = (value: ExportValue): string => {
	let text = String(value ?? '');

	// Prefix only text values so negative numeric cells remain numeric in spreadsheets.
	if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) {
		text = `'${text}`;
	}

	if (text.includes(';') || text.includes('"') || text.includes('\r') || text.includes('\n')) {
		return `"${text.replace(/"/g, '""')}"`;
	}

	return text;
};

const buildCsvContent = <T,>(columns: CsvColumn<T>[], rows: T[]): string => {
	const projection = projectTable(columns, rows);
	const header = projection.headers.map(escapeCsvField).join(';');
	const body = projection.rows.map((row) => row.map(escapeCsvField).join(';'));

	return `\uFEFF${[header, ...body].join('\r\n')}\r\n`;
};

const downloadBlob = (blob: Blob, filename: string): void => {
	const blobUrl = URL.createObjectURL(blob);
	const link = document.createElement('a');

	link.setAttribute('href', blobUrl);
	link.setAttribute('download', filename);
	link.setAttribute('aria-hidden', 'true');
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};

const downloadExcel = async <T,>(
	columns: CsvColumn<T>[],
	rows: T[],
	filename: string
): Promise<void> => {
	// ExcelJS is intentionally loaded only after the user selects Excel.
	const { Workbook } = await import('exceljs');
	const workbook = new Workbook();
	const worksheet = workbook.addWorksheet('Report');
	const projection = projectTable(columns, rows);

	worksheet.addRow(projection.headers);
	projection.rows.forEach((row) => {
		const excelRow = worksheet.addRow([]);
		row.forEach((value, index) => {
			const cell = excelRow.getCell(index + 1);
			if (typeof value === 'number' && Number.isFinite(value)) {
				cell.value = value;
			} else if (typeof value === 'boolean') {
				cell.value = value;
			} else {
				// Plain strings are ExcelJS StringValue cells, never formula objects.
				cell.value = String(value ?? '');
			}
		});
	});

	worksheet.getRow(1).font = { bold: true };
	worksheet.columns = projection.headers.map((header, index) => ({
		header,
		key: `column${index}`,
		width: Math.min(Math.max(header.length + 2, 12), 40),
	}));

	const buffer = await workbook.xlsx.writeBuffer();
	downloadBlob(
		new Blob([buffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		}),
		filename
	);
};

/**
 * Download a report using the selected Report Library format.
 *
 * The basename must not include an extension; this keeps the filename and
 * content type coupled to the requested format for both Core and Pro reports.
 */
export const downloadReportExport = async <T,>(
	columns: CsvColumn<T>[],
	rows: T[],
	filename: string,
	format: ReportExportFormat
): Promise<void> => {
	const extension = format === 'xlsx' ? 'xlsx' : 'csv';
	const exportFilename = `${filename}.${extension}`;

	if (format === 'xlsx') {
		await downloadExcel(columns, rows, exportFilename);
		return;
	}

	downloadBlob(
		new Blob([buildCsvContent(columns, rows)], {
			type: 'text/csv;charset=utf-8;',
		}),
		exportFilename
	);
};

export const ExportCsvButton = <T,>({
	columns,
	filename,
	reportTitle = __('This report', 'primeplaced-logless-analytics'),
	exportRows,
	rows: reportRows,
	isLoading: isReportLoading,
}: ExportCsvButtonProps<T>): JSX.Element => {
	const tableContext = useOptionalDataTableContext<T>();
	const sortedData = reportRows ?? tableContext?.sortedData ?? [];
	const isLoading = isReportLoading ?? tableContext?.isLoading ?? false;
	const { notify } = useNotices();
	const unavailable = useUnavailableAction();
	const [exportedFormat, setExportedFormat] = useState<ReportExportFormat | null>(null);
	const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
	const [isExporting, setIsExporting] = useState(false);
	const isExportingRef = useRef(false);
	const hasRows = sortedData.length > 0;
	const canStartExport = hasRows && !isLoading;

	const handleExport = useCallback(async (format: ReportExportFormat): Promise<void> => {
		if (!canStartExport || isExportingRef.current) {
			return;
		}

		if (!exportRows && !hasRows) {
			notify(
				'EXPORT_ERROR',
				__('This report has no exportable rows.', 'primeplaced-logless-analytics')
			);
			return;
		}

		isExportingRef.current = true;
		setIsExporting(true);
		setExportProgress(null);
		try {
			const snapshotColumns = [ ...columns ];
			const snapshotRows = exportRows
				? await exportRows((progress) => setExportProgress(progress))
				: [ ...sortedData ];
			const rows = snapshotRows;
			if (!rows.length) {
				notify(
					'EXPORT_ERROR',
					__('This report has no exportable rows.', 'primeplaced-logless-analytics')
				);
				return;
			}

			const date = new Date().toISOString().split('T')[0];
			await downloadReportExport(snapshotColumns, rows, `${filename}-${date}`, format);

			setExportedFormat(format);
			notify(
				'EXPORT_SUCCESS',
				format === 'xlsx'
					? __('Excel export started.', 'primeplaced-logless-analytics')
					: __('CSV export started.', 'primeplaced-logless-analytics')
			);
			window.setTimeout(() => setExportedFormat(null), 1800);
		} catch {
			notify(
				'EXPORT_ERROR',
				__('The report could not be exported. Please try again.', 'primeplaced-logless-analytics')
			);
		} finally {
			setIsExporting(false);
			setExportProgress(null);
			isExportingRef.current = false;
		}
	}, [canStartExport, columns, exportRows, filename, hasRows, notify, sortedData]);

	let exportLabel: string = sprintf(
		/* translators: %s: report name. */
		__('Export %s', 'primeplaced-logless-analytics'),
		reportTitle
	);
	if (isExporting) {
		exportLabel = __('Preparing export…', 'primeplaced-logless-analytics');
		if (exportProgress && exportProgress.total > 0) {
			exportLabel = sprintf(
				/* translators: 1: completed pages, 2: total pages. */
				__('Preparing export… %1$d of %2$d pages', 'primeplaced-logless-analytics'),
				exportProgress.completed,
				exportProgress.total
			);
		}
	}
	const exportButtonLabel = isExporting ? exportLabel : __('Export', 'primeplaced-logless-analytics');

	return (
		<Dropdown
				popoverProps={{ placement: 'bottom-end' }}
				contentClassName="ppla-export-menu"
				renderToggle={({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) => {
					let toggleIcon = chevronDown;
					if (isOpen) {
						toggleIcon = chevronUp;
					}
					if (exportedFormat) {
						toggleIcon = check;
					}

					return <Button
						icon={toggleIcon}
						variant="secondary"
						onClick={onToggle}
						disabled={!canStartExport || isExporting}
						aria-expanded={isOpen}
						aria-busy={isExporting}
						className="ppla-button"
						label={exportLabel}
						showTooltip
						{...unavailable(
							!hasRows && !isLoading &&
								__('There is no data to export in the selected period.', 'primeplaced-logless-analytics')
						)}
					>
						{exportButtonLabel}
					</Button>;
				}}
				renderContent={({ onClose }: { onClose: () => void }) => (
					<MenuGroup label={__('Export format', 'primeplaced-logless-analytics')}>
						<MenuItem
							isDestructive={false}
							icon={download}
							disabled={isExporting}
							onClick={() => {
								void handleExport('csv');
								onClose();
							}}
						>
							{__('CSV (semicolon-separated)', 'primeplaced-logless-analytics')}
						</MenuItem>
						<MenuItem
							isDestructive={false}
							icon={download}
							disabled={isExporting}
							onClick={() => {
								void handleExport('xlsx');
								onClose();
							}}
						>
							{__('Excel workbook (.xlsx)', 'primeplaced-logless-analytics')}
						</MenuItem>
					</MenuGroup>
				)}
		/>
	);
};
