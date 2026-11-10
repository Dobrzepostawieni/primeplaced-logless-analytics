import { __, _n, sprintf } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import {
	ArcElement,
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	Legend,
	LinearScale,
	Tooltip,
} from 'chart.js';
import type { ActiveElement, ChartEvent } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

import { COMMON_CHART_OPTIONS } from '@admin/features/General/components/ChartsSection/chartConfig';
import { cn } from '@shared/utils/formatting';
import { formatNumber } from '@shared/utils/numberFormat';
import {
	CATEGORICAL_COLORS,
	MAX_CATEGORIES,
	getCategoryColor,
} from '@shared/utils/chartPalette';

ChartJS.register(
	ArcElement,
	BarElement,
	CategoryScale,
	Legend,
	LinearScale,
	Tooltip
);

type ChartItem = {
	label: string;
	filterValue?: string;
	value: number;
	/** Aggregated remainder of the categories that do not fit the chart. */
	isOther?: boolean;
};
type ChartVariant = 'ranking' | 'share' | 'errors';
type SummaryUnit = 'visit' | 'pageview' | 'error' | 'hit' | 'search' | 'event';

// Rankings compare magnitude only, so they use a single colour. Errors use the
// WordPress admin error red and columns instead of ranking bars, so a list of
// problems never reads like healthy traffic.
const RANKING_COLOR = CATEGORICAL_COLORS[ 0 ];
const ERROR_COLOR = '#d63638';

interface SourceDistributionChartProps {
	title: string;
	items: ChartItem[];
	label: string;
	summaryUnit?: SummaryUnit;
	emptyMessage?: string;
	variant?: ChartVariant;
	/** Hide the summed total when the items are only one page of the report. */
	showTotal?: boolean;
	onItemClick?: (item: ChartItem) => void;
}

const getChartItems = (items: ChartItem[]): ChartItem[] => {
	const visibleItems = items.slice(0, MAX_CATEGORIES);
	const otherValue = items
		.slice(MAX_CATEGORIES)
		.reduce((sum, item) => sum + item.value, 0);

	return otherValue > 0
		? [
				...visibleItems,
				{
					label: __('Other', 'primeplaced-logless-analytics'),
					value: otherValue,
					isOther: true,
				},
			]
		: visibleItems;
};

const AXIS_LABEL_LENGTH = 28;
// Column labels sit side by side under the chart, so they get less room.
const COLUMN_LABEL_LENGTH = 16;

const truncateAxisLabel = (label: string, length = AXIS_LABEL_LENGTH): string =>
	label.length > length
		? `${label.slice(0, length - 1)}…`
		: label;

const getSummaryLabel = (total: number, unit: SummaryUnit): string => {
	switch (unit) {
		case 'pageview':
			return `${formatNumber(total)} ${_n('pageview', 'pageviews', total, 'primeplaced-logless-analytics')}`;
		case 'error':
			return `${formatNumber(total)} ${_n('error', 'errors', total, 'primeplaced-logless-analytics')}`;
		case 'hit':
			return `${formatNumber(total)} ${_n('hit', 'hits', total, 'primeplaced-logless-analytics')}`;
		case 'search':
			return `${formatNumber(total)} ${_n('search', 'searches', total, 'primeplaced-logless-analytics')}`;
		case 'event':
			return `${formatNumber(total)} ${_n('event', 'events', total, 'primeplaced-logless-analytics')}`;
		case 'visit':
		default:
			return `${formatNumber(total)} ${_n('visit', 'visits', total, 'primeplaced-logless-analytics')}`;
	}
};

export const SourceDistributionChart = ({
	title,
	items,
	label,
	summaryUnit = 'visit',
	emptyMessage,
	variant = 'ranking',
	showTotal = true,
	onItemClick,
}: SourceDistributionChartProps): JSX.Element => {
	const barColor = variant === 'errors' ? ERROR_COLOR : RANKING_COLOR;
	const chartItems = useMemo(() => getChartItems(items), [items]);
	const total = items.reduce((sum, item) => sum + item.value, 0);
	const hasData = chartItems.some((item) => item.value > 0);
	// Even a single category keeps its chart, so the panel never looks broken.
	const showCanvas = hasData;
	const totalLabel = getSummaryLabel(total, summaryUnit);
	const chartLabel = sprintf(
		/* translators: 1: chart title, 2: total result summary. */
		__('%1$s: %2$s.', 'primeplaced-logless-analytics'),
		title,
		totalLabel
	);

	const chartData = useMemo(() => {
		const labels = chartItems.map((item) => item.label);
		const values = chartItems.map((item) => item.value);

		if (variant !== 'share') {
			return {
				labels,
				datasets: [
					{
						label,
						data: values,
						backgroundColor: barColor,
						borderRadius: 7,
						borderSkipped: false,
						...(variant === 'errors'
							? { maxBarThickness: 44 }
							: { barThickness: 18 }),
					},
				],
			};
		}

		const backgroundColors = chartItems.map((item, index) =>
			getCategoryColor(index, item.isOther)
		);

		return {
			labels,
			datasets: [
				{
					label,
					data: values,
					backgroundColor: backgroundColors,
					borderColor: '#ffffff',
					borderWidth: 3,
					hoverOffset: 7,
				},
			],
		};
	}, [barColor, chartItems, label, variant]);

	const chartOptions = useMemo(() => {
		const baseOptions = {
			...COMMON_CHART_OPTIONS,
			plugins: {
				...COMMON_CHART_OPTIONS.plugins,
				legend: { display: false },
			},
			onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
				const index = elements[0]?.index;
				const item =
					typeof index === 'number' ? chartItems[index] : null;
				if (item && !item.isOther) {
					onItemClick?.(item);
				}
			},
		};

		if (variant === 'errors') {
			return {
				...baseOptions,
				indexAxis: 'x' as const,
				scales: {
					x: {
						grid: { display: false },
						ticks: {
							color: '#475569',
							maxRotation: 0,
							autoSkip: false,
							callback: (_value: number | string, index: number) =>
								truncateAxisLabel(chartItems[index]?.label ?? '', COLUMN_LABEL_LENGTH),
						},
					},
					y: {
						beginAtZero: true,
						grid: { color: 'rgba(148, 163, 184, 0.16)' },
						ticks: { precision: 0 },
					},
				},
			};
		}

		if (variant !== 'share') {
			return {
				...baseOptions,
				indexAxis: 'y' as const,
				scales: {
					x: {
						beginAtZero: true,
						grid: { color: 'rgba(148, 163, 184, 0.16)' },
						ticks: { precision: 0 },
					},
					y: {
						grid: { display: false },
						ticks: {
							color: '#475569',
							padding: 8,
							// Long URLs and event names are shortened on the axis;
							// the legend and tooltip keep the full label.
							callback: (_value: number | string, index: number) =>
								truncateAxisLabel(chartItems[index]?.label ?? ''),
						},
					},
				},
			};
		}

		return {
			...baseOptions,
			cutout: '68%',
		};
	}, [chartItems, onItemClick, variant]);

	return (
		<div
			className={cn(
				'ppla-sources-chart',
				`ppla-sources-chart--${variant}`,
				!showCanvas && 'ppla-sources-chart--no-canvas'
			)}
		>
			<div className="ppla-sources-chart__heading">
				<h3>{title}</h3>
				{showTotal && (
					<span className="ppla-sources-chart__total">{totalLabel}</span>
				)}
			</div>
			{!hasData ? (
				<p className="ppla-sources-chart__empty" role="status">
					{emptyMessage ||
						__(
							'No results in this period yet.',
							'primeplaced-logless-analytics'
						)}
				</p>
			) : (
				<>
					{showCanvas && (
						<div
							className="ppla-sources-chart__canvas"
							role="img"
							aria-label={chartLabel}
						>
							{variant === 'share' ? (
								<Doughnut
									aria-hidden={true}
									data={chartData}
									options={chartOptions}
								/>
							) : (
								<Bar
									aria-hidden={true}
									data={chartData}
									options={chartOptions}
								/>
							)}
						</div>
					)}
					<ol className="ppla-sources-chart__legend">
						{chartItems.map((item, index) => (
							<li
								key={`${item.label}-${index}`}
								className="ppla-sources-chart__legend-row"
							>
								<button
									type="button"
									className="ppla-sources-chart__legend-label"
									onClick={() => onItemClick?.(item)}
									disabled={!onItemClick || item.isOther}
								>
									<span
										className="ppla-sources-chart__legend-swatch"
										style={{
											backgroundColor:
												variant === 'share'
													? getCategoryColor(
															index,
															item.isOther
														)
													: barColor,
										}}
										aria-hidden="true"
									/>
									<span title={item.label}>{item.label}</span>
								</button>
								<strong className="ppla-sources-chart__value">
									{formatNumber(item.value)}
								</strong>
							</li>
						))}
					</ol>
				</>
			)}
		</div>
	);
};
