import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';

import { ReportTableSection } from '@admin/components/ReportTableSection';
import { ReportTableActions, type CsvColumn } from '@admin/components/ReportTableActions';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import type { ColumnDef } from '@admin/components/DataTable/types';
import { cn } from '@shared/utils/formatting';
import type { TrafficData } from './types';
import {
	getTrafficEmptyMessage,
	useChartsData,
} from './useChartsData';
import { formatNumber } from '@shared/utils/numberFormat';

const csvColumns: CsvColumn<TrafficData>[] = [
	{ header: __('Date', 'primeplaced-logless-analytics'), value: (row) => row.date_iso },
	{ header: __('Pageviews', 'primeplaced-logless-analytics'), value: (row) => row.pageviews },
	{ header: __('Visits', 'primeplaced-logless-analytics'), value: (row) => row.visits },
];

export const DailyTrafficTableSection = ({
	title,
	spyRef,
	isActive,
	className,
}: StickySectionProps): JSX.Element => {
	const {
		range,
		setRange,
		trafficData,
		privacyMode,
		measurementReason,
		isFetching,
		hasError,
	} = useChartsData();

	const visitsLabel =
		privacyMode === 'strict_anonymous'
			? __('Anonymous hits', 'primeplaced-logless-analytics')
			: __('Unique visits', 'primeplaced-logless-analytics');

	const columns = useMemo<ColumnDef<TrafficData>[]>(
		() => [
			{
				id: 'date',
				header: __('Date', 'primeplaced-logless-analytics'),
				sortable: true,
				isFixed: 'left',
				filterBy: {
					type: 'date',
					operators: ['on', 'before', 'after'],
				},
				getSortValue: (row) => row.date_iso,
				getFilterValue: (row) => row.date_iso,
				cell: (row) => row.date,
			},
			{
				id: 'pageviews',
				header: __('Pageviews', 'primeplaced-logless-analytics'),
				sortable: true,
				filterBy: {
					type: 'text',
					operators: ['is', 'greater', 'less'],
				},
				cell: (row) => formatNumber(row.pageviews),
			},
			{
				id: 'visits',
				header: visitsLabel,
				sortable: true,
				filterBy: {
					type: 'text',
					operators: ['is', 'greater', 'less'],
				},
				cell: (row) => formatNumber(row.visits),
			},
		],
		[visitsLabel]
	);

	return (
		<ReportTableSection<TrafficData>
			title={title}
			spyRef={spyRef}
			isActive={isActive}
			className={cn('ppla-daily-traffic-table', className)}
				headerActions={
					<ReportTableActions<TrafficData>
						reportTitle={__('Daily traffic', 'primeplaced-logless-analytics')}
				range={range}
				onRangeChange={setRange}
						isLoading={isFetching}
						csvColumns={csvColumns}
						csvFilename="ppla-daily-traffic"
						showRange={false}
						savedViewsKey="ppla_daily_traffic_table"
				/>
			}
			table={{
				storageKey: 'ppla_daily_traffic_table',
				compact: true,
				data: trafficData,
				columns,
				isLoading: isFetching,
				initialPerPage: 10,
				perPageOptions: [10, 25, 50, 90],
				initialSortBy: 'date',
				initialSortDirection: 'desc',
				searchableFields: ['date'],
				searchLabel: __('Search daily traffic', 'primeplaced-logless-analytics'),
				emptyContent: getTrafficEmptyMessage(
					measurementReason,
					hasError
				),
			}}
		/>
	);
};
