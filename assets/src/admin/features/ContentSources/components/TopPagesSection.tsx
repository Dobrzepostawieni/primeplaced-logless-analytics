import { __ } from '@wordpress/i18n';
import { useCallback, useMemo, useState } from '@wordpress/element';
import {
	ReportTableActions,
	type CsvColumn,
} from '@admin/components/ReportTableActions';
import { ReportTableSection } from '@admin/components/ReportTableSection';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import { useServerSideTable } from '../useServerSideTable';
import { useContentTableConfig } from '../useContentTableConfig';
import type { PageStat } from '../types';
import { SourceDistributionChart } from './SourceDistributionChart';
import { SourceReportStatus } from './SourceReportStatus';
import { useSourceReportRange } from '../useSourceReportRange';
import { getMeasurementEmptyMessage } from '@shared/utils/measurementState';
import { MeasurementStateNotice } from '@shared/components/MeasurementStateNotice';
import { ReportQueryControls } from '@admin/components/ReportQuery';
import type { DataTableState } from '@admin/components/DataTable/types';
import type { ReportQueryState } from '@admin/components/ReportQuery/types';
import { useSourceReportQuery } from '../useSourceReportQuery';
import { SourceReportSummary } from './SourceReportSummary';
import { formatDuration, formatPercent } from '@shared/utils/numberFormat';
import { formatPathForDisplay } from '@shared/utils/formatting';

const initialTableState: DataTableState = {
	page: 1,
	perPage: 10,
	sortBy: 'views',
	sortDirection: 'desc',
	searchQuery: '',
	filters: {},
};

const csvColumns: CsvColumn<PageStat>[] = [
	{ header: __('Title', 'primeplaced-logless-analytics'), value: (row) => row.title },
	{ header: __('URL', 'primeplaced-logless-analytics'), value: (row) => row.url },
	{ header: __('Pageviews', 'primeplaced-logless-analytics'), value: (row) => row.views },
	{ header: __('Share', 'primeplaced-logless-analytics'), value: (row) => formatPercent(row.percentage) },
	{ header: __('Bounce Rate', 'primeplaced-logless-analytics'), value: (row) => formatPercent(row.bounce_rate) },
	{ header: __('Avg. Time', 'primeplaced-logless-analytics'), value: (row) => formatDuration(row.avg_time) },
];

export const TopPagesSection = ({
	title,
	spyRef,
	isActive,
	className,
}: StickySectionProps) => {
	const { range, setRange, initialUrlRange } = useSourceReportRange(
		'ppla_sources_pages_range'
	);
	const { query, updateQuery, selectFilterValue, initialUrlOverrides } = useSourceReportQuery({
		storageKey: 'ppla_top_pages',
		filterId: 'page',
		urlKeyPrefix: 'ppla_sources_pages',
	});
	const [tableState, setTableState] =
		useState<DataTableState>(initialTableState);
	const {
		isLoading,
		data,
		hasError,
		measurementReason,
		retry,
		totalItems,
		summary,
		comparison,
		filterOptions,
		exportRows,
	} = useServerSideTable<PageStat>('pages', range, query, tableState);
	const { pageColumns } = useContentTableConfig();
	const updateReportQuery = useCallback(
		(nextQuery: ReportQueryState) => {
			setTableState((current) => ({ ...current, page: 1 }));
			updateQuery(nextQuery);
		},
		[updateQuery]
	);
	const selectReportFilter = useCallback(
		(value: string) => {
			setTableState((current) => ({ ...current, page: 1 }));
			selectFilterValue(value);
		},
		[selectFilterValue]
	);
	const reportFilters = useMemo(() => {
		const options = filterOptions.page || [];
		const selectedValue = query.filters.page;
		const hasSelectedOption = options.some(
			(option) => option.value === selectedValue
		);

		return [
			{
				id: 'page',
				label: __('Page', 'primeplaced-logless-analytics'),
				options:
					selectedValue && !hasSelectedOption
						? [
								{ value: selectedValue, label: selectedValue },
								...options,
							]
						: options,
			},
		];
	}, [filterOptions.page, query.filters.page]);
	return (
		<ReportTableSection<PageStat>
			title={title}
			spyRef={spyRef}
			isActive={isActive}
			className={className}
			showPrivacyNotice={false}
			splitStorageKey="sources-top-pages"
			headerActions={
				<ReportTableActions<PageStat>
					reportTitle={__(
						'Top Pages',
						'primeplaced-logless-analytics'
					)}
					range={range}
					onRangeChange={setRange}
					isLoading={isLoading}
					csvColumns={csvColumns}
					csvFilename="ppla-sources-pages"
					exportRows={exportRows}
					savedViewsKey="ppla_top_pages"
					initialUrlRange={initialUrlRange}
					initialUrlQueryOverrides={initialUrlOverrides}
				/>
			}
			bodyBeforeTable={
				<>
					<SourceReportSummary
						metric="pageviews"
						summary={summary}
						comparison={comparison}
					/>
					<ReportQueryControls
						filters={reportFilters}
						query={query}
						onChange={updateReportQuery}
					/>
					<SourceReportStatus
						hasError={hasError}
						isLoading={isLoading}
						hasData={data.length > 0}
						onRetry={() => void retry()}
					/>
					<MeasurementStateNotice
						reason={measurementReason}
						hasData={data.length > 0}
						isLoading={isLoading}
						hasError={hasError}
						onRetry={() => void retry()}
					/>
				</>
			}
			aside={
				<SourceDistributionChart
					title={__(
						'Pageviews by page',
						'primeplaced-logless-analytics'
					)}
					label={__('pageviews', 'primeplaced-logless-analytics')}
					summaryUnit="pageview"
					items={data.map((row) => ({
						label: row.title || formatPathForDisplay(row.url || '/'),
						filterValue: row.url,
						value: row.views,
					}))}
					variant="ranking"
					onItemClick={(item) =>
						selectReportFilter(item.filterValue || item.label)
					}
					emptyMessage={
						hasError
							? __(
									'The page chart could not be refreshed. Try again to read the current report.',
									'primeplaced-logless-analytics'
								)
							: getMeasurementEmptyMessage(
									measurementReason,
									__(
										'No pageviews in this period yet. Open a public page and return after the buffer sync.',
										'primeplaced-logless-analytics'
									)
								)
					}
				/>
			}
			table={{
				storageKey: 'ppla_top_pages',
				data,
				columns: pageColumns,
				isLoading,
				initialPerPage: 10,
				perPageOptions: [10, 25, 50],
				initialSortBy: 'views',
				initialSortDirection: 'desc',
				searchableFields: ['url', 'title'],
				emptyContent: hasError
					? __(
							'The page report could not be loaded. Use Try again above.',
							'primeplaced-logless-analytics'
						)
					: getMeasurementEmptyMessage(
							measurementReason,
							__(
								'No visits yet. Open a public page with tracking enabled, then return after the buffer sync.',
								'primeplaced-logless-analytics'
							)
						),
				manualPagination: true,
				manualTotalItems: totalItems,
				manualCurrentPage: tableState.page,
				onStateChange: setTableState,
				onRowClick: (row) => selectReportFilter(row.url),
			}}
		/>
	);
};
