import { __, _n, sprintf } from '@wordpress/i18n';
import { useMemo, memo, useState, useEffect } from '@wordpress/element';
import {
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControl as ToggleGroupControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { Line } from 'react-chartjs-2';
import { formatNumber } from '@shared/utils/numberFormat';
import { COMMON_CHART_OPTIONS } from './chartConfig';
import { cn } from '@shared/utils/formatting';
import type { TrafficData } from './types';

interface DailyTrafficChartProps {
	data?: TrafficData[];
	privacyMode?: 'strict_anonymous' | 'session_hash';
	isFetching: boolean;
	isInitialLoad: boolean;
	emptyMessage: string;
}

export const DailyTrafficChart = memo(
	({
		data,
		privacyMode,
		isFetching,
		isInitialLoad,
		emptyMessage,
	}: DailyTrafficChartProps) => {
		const [masterData, setMasterData] = useState<TrafficData[]>([]);
		// Pageviews are several times larger than visits, so a shared axis
		// flattens visits; one metric is drawn at a time instead.
		const [metric, setMetric] = useState<'visits' | 'pageviews'>('visits');
		const currentData = data || [];
		const hasData = currentData.some(
			(item) => item.pageviews > 0 || item.visits > 0
		);
		const pageviewsTotal = currentData.reduce(
			(total, item) => total + item.pageviews,
			0
		);
		const visitsTotal = currentData.reduce(
			(total, item) => total + item.visits,
			0
		);
		const pageviewsSummary = `${formatNumber(pageviewsTotal)} ${_n(
			'pageview',
			'pageviews',
			pageviewsTotal,
			'primeplaced-logless-analytics'
		)}`;
		const visitsUnit = privacyMode === 'strict_anonymous'
			? _n('hit', 'hits', visitsTotal, 'primeplaced-logless-analytics')
			: _n('visit', 'visits', visitsTotal, 'primeplaced-logless-analytics');
		const visitsSummary = `${formatNumber(visitsTotal)} ${visitsUnit}`;
		const visitDatasetLabel = privacyMode === 'strict_anonymous'
			? __('Anonymous hits', 'primeplaced-logless-analytics')
			: __('Visits', 'primeplaced-logless-analytics');
		const pageviewsLabel = __('Pageviews', 'primeplaced-logless-analytics');

		// Keep the widest loaded timeline so range changes animate smoothly.
		useEffect(() => {
			if (!data || data.length === 0) {
				return;
			}

			setMasterData((prev) => {
				// A wider range replaces the base; a narrower one reuses the wider
				// history, which already contains the points to animate towards.
				if (data.length >= prev.length) {
					return data;
				}
				return prev;
			});
		}, [data]);

		const lineData = useMemo(() => {
			const history = masterData.length > 0 ? masterData : data || [];

			return {
				labels: history.map((item) => item.date),
				datasets: [
					{
						label: 'visits' === metric ? visitDatasetLabel : pageviewsLabel,
						data: history.map((item) => item[metric]),
						borderColor: '#047857',
						backgroundColor: 'rgba(16, 185, 129, 0.12)',
						borderWidth: 2,
						fill: true,
						tension: 0.3,
						pointRadius: 0,
						pointHoverRadius: 5,
					},
				],
			};
		}, [masterData, data, metric, visitDatasetLabel, pageviewsLabel]);

		// Visible window for the currently selected range.
		const viewBounds = useMemo(() => {
			if (!data || data.length === 0) {
				return { min: undefined, max: undefined };
			}
			return {
				min: data[0].date,
				max: data[data.length - 1].date,
			};
		}, [data]);

		let chartContent: JSX.Element | null = null;
		if (isInitialLoad) {
			chartContent = (
				<div className="ppla-charts-grid-card-placeholder">
					<div className="ppla-spinner" />
				</div>
			);
		} else if (!hasData) {
			chartContent = (
				<p className="ppla-charts-grid-card-empty" role="status">
					{emptyMessage}
				</p>
			);
		} else {
			chartContent = (
				<div
					className="ppla-chart-canvas"
					role="img"
					aria-label={sprintf(
						/* translators: 1: pageview summary, 2: visit summary. */
						__('Daily traffic: %1$s and %2$s.', 'primeplaced-logless-analytics'),
						pageviewsSummary,
						visitsSummary
					)}
				>
					<Line
						aria-hidden={true}
						data={lineData}
						options={{
							...COMMON_CHART_OPTIONS,
							interaction: {
								mode: 'index',
								intersect: false,
							},
							scales: {
								y: {
									beginAtZero: true,
									grid: { color: '#f1f5f9' },
									border: { display: false },
									ticks: { precision: 0 },
								},
								x: {
									type: 'category',
									min: viewBounds.min,
									max: viewBounds.max,
									grid: { display: false },
									ticks: {
										maxRotation: 0,
										maxTicksLimit: 10,
									},
								},
							},
							plugins: {
								...COMMON_CHART_OPTIONS.plugins,
								legend: { display: false },
							},
						}}
					/>
				</div>
			);
		}

		return (
			<div className="ppla-charts-grid-card">
				<div className="ppla-charts-grid-card-header">
					<h3>
						{__('Daily traffic', 'primeplaced-logless-analytics')}
					</h3>
					<div className="ppla-toggle-group-control">
						<ToggleGroupControl
							label={__('Metric', 'primeplaced-logless-analytics')}
							hideLabelFromVision
							value={metric}
							onChange={(value: string | number | undefined) => {
								if ('visits' === value || 'pageviews' === value) {
									setMetric(value);
								}
							}}
							isBlock={false}
							__next40pxDefaultSize
							__nextHasNoMarginBottom
						>
							<ToggleGroupControlOption
								value="visits"
								label={visitDatasetLabel}
								showTooltip={false}
							/>
							<ToggleGroupControlOption
								value="pageviews"
								label={pageviewsLabel}
								showTooltip={false}
							/>
						</ToggleGroupControl>
					</div>
				</div>
				<div
					className={cn(
						'ppla-charts-grid-card-chart',
						isFetching && !isInitialLoad && 'is-updating'
					)}
				>
					{chartContent}
				</div>
		</div>
		);
	}
);
