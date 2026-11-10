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
import type { ReferrerStat } from '../types';
import { SourceDistributionChart } from './SourceDistributionChart';
import { SourceReportStatus } from './SourceReportStatus';
import { useSourceReportRange } from '../useSourceReportRange';
import { getMeasurementEmptyMessage } from '@shared/utils/measurementState';
import { MeasurementStateNotice } from '@shared/components/MeasurementStateNotice';
import { getSourceLabel as getSharedSourceLabel } from '@shared/utils/sourceLabels';
import { ReportQueryControls } from '@admin/components/ReportQuery';
import type { DataTableState } from '@admin/components/DataTable/types';
import type { ReportQueryState } from '@admin/components/ReportQuery/types';
import { useSourceReportQuery } from '../useSourceReportQuery';
import { SourceReportSummary } from './SourceReportSummary';
import { formatPercent } from '@shared/utils/numberFormat';

const initialTableState: DataTableState = {
	page: 1,
	perPage: 10,
	sortBy: 'visits',
	sortDirection: 'desc',
	searchQuery: '',
	filters: {},
};

const getSourceLabel = (value: string): string => {
	const source = value.trim().toLowerCase();

	if (source === 'google_ads') {
		return __('Google Ads', 'primeplaced-logless-analytics');
	}

	if (source === 'meta_ads') {
		return __('Meta Ads', 'primeplaced-logless-analytics');
	}

	return getSharedSourceLabel(value);
};

const csvColumns: CsvColumn<ReferrerStat>[] = [
	{ header: __('Source', 'primeplaced-logless-analytics'), value: (row) => getSourceLabel(row.source) },
	{ header: __('Visits', 'primeplaced-logless-analytics'), value: (row) => row.visits },
	{ header: __('Share', 'primeplaced-logless-analytics'), value: (row) => formatPercent(row.percentage) },
];

export const TopReferrersSection = ({
	title,
	spyRef,
	isActive,
	className,
}: StickySectionProps) => {
	const { range, setRange, initialUrlRange } = useSourceReportRange(
		'ppla_sources_referrers_range'
	);
	const { query, updateQuery, selectFilterValue, initialUrlOverrides } = useSourceReportQuery({
		storageKey: 'ppla_top_referrers',
		filterId: 'source',
		urlKeyPrefix: 'ppla_sources_referrers',
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
	} = useServerSideTable<ReferrerStat>('referrers', range, query, tableState);
	const { referrerColumns } = useContentTableConfig();
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
		const options = filterOptions.source || [];
		const selectedValue = query.filters.source;
		const hasSelectedOption = options.some(
			(option) => option.value === selectedValue
		);

		return [
			{
				id: 'source',
				label: __('Source', 'primeplaced-logless-analytics'),
				options:
					selectedValue && !hasSelectedOption
						? [
								{ value: selectedValue, label: getSourceLabel(selectedValue) },
								...options.map((option) => ({
									...option,
									label: getSourceLabel(option.value),
								})),
							]
						: options.map((option) => ({
								...option,
								label: getSourceLabel(option.value),
							})),
			},
		];
	}, [filterOptions.source, query.filters.source]);

	return (
		<ReportTableSection<ReferrerStat>
			title={title}
			spyRef={spyRef}
			isActive={isActive}
			className={className}
			showPrivacyNotice={false}
			splitStorageKey="sources-top-referrers"
			headerActions={
				<ReportTableActions<ReferrerStat>
					reportTitle={__(
						'Top Traffic Sources',
						'primeplaced-logless-analytics'
					)}
					range={range}
					onRangeChange={setRange}
					isLoading={isLoading}
					csvColumns={csvColumns}
					csvFilename="ppla-sources-referrers"
					exportRows={exportRows}
					savedViewsKey="ppla_top_referrers"
					initialUrlRange={initialUrlRange}
					initialUrlQueryOverrides={initialUrlOverrides}
				/>
			}
			bodyBeforeTable={
				<>
					<SourceReportSummary
						metric="visits"
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
						'Visits by source',
						'primeplaced-logless-analytics'
					)}
					label={__('visits', 'primeplaced-logless-analytics')}
					summaryUnit="visit"
					items={data.map((row) => ({
						label: getSourceLabel(row.source),
						filterValue: row.source,
						value: row.visits,
					}))}
					variant="share"
					onItemClick={(item) =>
						selectReportFilter(item.filterValue || item.label)
					}
					emptyMessage={
						hasError
							? __(
									'The source chart could not be refreshed. Try again to read the current report.',
									'primeplaced-logless-analytics'
								)
							: getMeasurementEmptyMessage(
									measurementReason,
									__(
											'No traffic-source visits in this period yet. Open a public page and return after the buffer sync.',
										'primeplaced-logless-analytics'
									)
								)
					}
				/>
			}
			table={{
				storageKey: 'ppla_top_referrers',
				data,
				columns: referrerColumns,
				isLoading,
				initialPerPage: 10,
				perPageOptions: [10, 25, 50],
				initialSortBy: 'visits',
				initialSortDirection: 'desc',
				searchableFields: ['source'],
				emptyContent: hasError
					? __(
							'The source report could not be loaded. Use Try again above.',
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
				onRowClick: (row) => selectReportFilter(row.source),
			}}
		/>
	);
};
