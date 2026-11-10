import {
	Card,
	CardBody,
	CardHeader,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalHStack as HStack,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import {
	createPortal,
	useContext,
	useEffect,
	useRef,
} from '@wordpress/element';
import type { ReactNode } from 'react';
import { DataTable } from '@admin/components/DataTable/DataTable';
import { ResizableReportSplit } from '@admin/components/ResizableReportSplit';
import { StickyActionsContext } from '@admin/components/StickyLayout/StickyLayout';
import { PrivacyRangeNotice } from '@shared/components/PrivacyRangeNotice';
import type { DataTableProps } from '@admin/components/DataTable/types';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import { cn } from '@shared/utils/formatting';
import type { PrivacyModeHistoryEntry } from '@shared/types';

interface ReportTableSectionProps<
	T extends { id?: string | number },
> extends StickySectionProps {
	table: DataTableProps<T>;
	headerActions?: JSX.Element;
	searchControls?: ReactNode;
	bodyBeforeTable?: ReactNode;
	bodyAfterTable?: ReactNode;
	aside?: ReactNode;
	privacyRange?: number;
	privacyChanges?: PrivacyModeHistoryEntry[];
	showPrivacyNotice?: boolean;
	splitStorageKey?: string;
}

export const ReportTableSection = <T extends { id?: string | number }>({
	title,
	spyRef,
	isActive,
	className,
	table,
	headerActions,
	searchControls,
	bodyBeforeTable,
	bodyAfterTable,
	aside,
	privacyRange,
	privacyChanges,
	// Keep the history props available for report contracts, but use the compact
	// section toast for measurement state instead of an inline privacy banner.
	showPrivacyNotice = false,
	splitStorageKey,
}: ReportTableSectionProps<T>): JSX.Element => {
	const cardRef = useRef<HTMLDivElement>(null);
	const portalTarget = useContext(StickyActionsContext);
	const actions =
		isActive && portalTarget && headerActions
			? createPortal(headerActions, portalTarget)
			: headerActions;
	const searchLabel =
		table.searchLabel ||
			(typeof title === 'string'
				? sprintf(
					/* translators: %s: report section title. */
					__('Search %s', 'primeplaced-logless-analytics'),
					title
				)
			: __('Search this report', 'primeplaced-logless-analytics'));

	useEffect(() => {
		if (spyRef && cardRef.current) {
			spyRef(cardRef.current);
		}
	}, [spyRef]);

	const tablePanel = (
		<div className="ppla-report-table-section__table-panel">
			{showPrivacyNotice && typeof privacyRange === 'number' && (
				<PrivacyRangeNotice range={privacyRange} changes={privacyChanges} />
			)}
			{bodyBeforeTable}
			<div className="ppla-datatable__wrapper">
				<div className="ppla-datatable__actions">
					<HStack spacing={4}>
						<DataTable.SearchBox />
						{searchControls}
						<DataTable.Appearance />
					</HStack>
					<DataTable.Filters />
				</div>

				<DataTable.LoadingBoundary>
				<div className="ppla-datatable__table">
					<table
						className={cn(
							'ppla-table ppla-datatable',
							table.compact && 'ppla-datatable--compact',
							table.className
						)}
					>
						<DataTable.Head />
						<DataTable.Body />
					</table>

					<div className="ppla-datatable__footer">
						<DataTable.BulkActions />
						<DataTable.Pagination />
					</div>
				</div>
				</DataTable.LoadingBoundary>
				{bodyAfterTable}
			</div>
		</div>
	);

	return (
		<DataTable<T>
			{...table}
			searchLabel={searchLabel}
			tableLabel={
				table.tableLabel ||
				(typeof title === 'string'
					? title
					: __('This report', 'primeplaced-logless-analytics'))
			}
		>
			<Card
				className={cn(
					'ppla-settings-card',
					className,
					isActive && 'ppla-is-active'
				)}
				ref={cardRef}
			>
				<CardHeader className="ppla-settings-card-header ppla-report-table-section__header">
					<h2>{title}</h2>
					{actions}
				</CardHeader>
				<CardBody
					className={cn(
						'ppla-settings-card-body',
						aside && 'ppla-report-table-section__split-body'
					)}
				>
					{aside ? (
						<ResizableReportSplit
							table={tablePanel}
							aside={aside}
							storageKey={splitStorageKey}
						/>
					) : tablePanel}
				</CardBody>
			</Card>
		</DataTable>
	);
};
