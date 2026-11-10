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
import type { Error404Stat } from '../types';
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
import { formatPathForDisplay } from '@shared/utils/formatting';

const initialTableState: DataTableState = {
	page: 1,
	perPage: 10,
	sortBy: 'count',
	sortDirection: 'desc',
	searchQuery: '',
	filters: {},
};

const csvColumns: CsvColumn<Error404Stat>[] = [
	{ header: __('Broken URL', 'primeplaced-logless-analytics'), value: (row) => row.url },
	{ header: __('Error Count', 'primeplaced-logless-analytics'), value: (row) => row.count },
];

export const Top404ErrorsSection = ({
	title,
	spyRef,
	isActive,
	className,
}: StickySectionProps) => {
	const { range, setRange, initialUrlRange } = useSourceReportRange('ppla_sources_404_range');
	const { query, updateQuery, selectFilterValue, initialUrlOverrides } = useSourceReportQuery({
		storageKey: 'ppla_top_404_errors',
		filterId: 'page',
		urlKeyPrefix: 'ppla_sources_404',
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
	} = useServerSideTable<Error404Stat>(
		'404-errors',
		range,
		query,
		tableState
	);
	const { error404Columns } = useContentTableConfig();
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
				label: __('Broken URL', 'primeplaced-logless-analytics'),
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
		<ReportTableSection<Error404Stat>
			title={title}
			spyRef={spyRef}
			isActive={isActive}
			className={className}
			showPrivacyNotice={false}
			splitStorageKey="sources-top-404-errors"
			headerActions={
				<ReportTableActions<Error404Stat>
					reportTitle={__(
						'Top 404 Errors',
						'primeplaced-logless-analytics'
					)}
					range={range}
					onRangeChange={setRange}
					isLoading={isLoading}
					csvColumns={csvColumns}
					csvFilename="ppla-sources-404"
					exportRows={exportRows}
					savedViewsKey="ppla_top_404_errors"
					initialUrlRange={initialUrlRange}
					initialUrlQueryOverrides={initialUrlOverrides}
				/>
			}
			bodyBeforeTable={
				<>
					<SourceReportSummary
						metric="errors"
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
						'404 errors by URL',
						'primeplaced-logless-analytics'
					)}
					label={__('errors', 'primeplaced-logless-analytics')}
					summaryUnit="error"
					items={data.map((row) => ({
						label: formatPathForDisplay(row.url),
						filterValue: row.url,
						value: row.count,
					}))}
					variant="errors"
					onItemClick={(item) =>
						selectReportFilter(item.filterValue || item.label)
					}
					emptyMessage={
						hasError
							? __(
									'The 404 chart could not be refreshed. Try again to read the current report.',
									'primeplaced-logless-analytics'
								)
							: getMeasurementEmptyMessage(
									measurementReason,
									__(
										'No 404 errors were recorded in this period yet.',
										'primeplaced-logless-analytics'
									)
								)
					}
				/>
			}
			table={{
				storageKey: 'ppla_top_404_errors',
				data,
				columns: error404Columns,
				isLoading,
				initialPerPage: 10,
				perPageOptions: [10, 25, 50],
				initialSortBy: 'count',
				initialSortDirection: 'desc',
				searchableFields: ['url'],
				emptyContent: hasError
					? __(
							'The 404 report could not be loaded. Use Try again above.',
							'primeplaced-logless-analytics'
						)
					: getMeasurementEmptyMessage(
							measurementReason,
							__(
								'No broken links detected yet. 404 visits will appear here after tracking starts.',
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
