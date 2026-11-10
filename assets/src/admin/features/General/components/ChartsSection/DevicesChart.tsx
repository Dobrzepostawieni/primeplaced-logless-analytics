import { __, sprintf } from '@wordpress/i18n';
import { formatPercent } from '@shared/utils/numberFormat';
import { useMemo, memo, useRef, useState } from '@wordpress/element';
import { Doughnut } from 'react-chartjs-2';
import type { Chart as ChartJS } from 'chart.js';
import { COMMON_CHART_OPTIONS, useChartAnimation } from './chartConfig';
import type { DevicesData } from './types';
import { cn } from '@shared/utils/formatting';

interface DevicesChartProps {
	data?: DevicesData;
	isFetching: boolean;
	isInitialLoad: boolean;
	emptyMessage: string;
}

export const DevicesChart = memo(
	({ data, isFetching, isInitialLoad, emptyMessage }: DevicesChartProps) => {
		const shouldAnimate = useChartAnimation(isInitialLoad);
		const chartRef = useRef<ChartJS<'doughnut'> | null>(null);
		const [hiddenItems, setHiddenItems] = useState<Set<number>>(new Set());
		const totalDevices = data
			? data.desktop + data.mobile + data.tablet
			: 0;

		const doughnutData = useMemo(() => {
			const dist = data || { desktop: 0, mobile: 0, tablet: 0 };

			return {
				labels: [
					__('Desktop', 'primeplaced-logless-analytics'),
					__('Mobile', 'primeplaced-logless-analytics'),
					__('Tablet', 'primeplaced-logless-analytics'),
				],
				datasets: [
					{
						data: shouldAnimate
							? [dist.desktop, dist.mobile, dist.tablet]
							: [0, 0, 0],
						backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'],
						borderWidth: 0,
						hoverOffset: 4,
					},
				],
			};
		}, [data, shouldAnimate]);

		const toggleItem = (index: number) => {
			if (chartRef.current) {
				chartRef.current.toggleDataVisibility(index);
				chartRef.current.update();

				setHiddenItems((prev) => {
					const next = new Set(prev);
					if (next.has(index)) next.delete(index);
					else next.add(index);
					return next;
				});
			}
		};

		const handleLegendKeyDown = (
			event: React.KeyboardEvent<HTMLDivElement>,
			index: number
		) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				toggleItem(index);
			}
		};

		return (
			<div className="ppla-charts-grid-card">
				<div className="ppla-charts-grid-card-header">
					<h3>{__('Devices', 'primeplaced-logless-analytics')}</h3>
				</div>
				<div
					className={cn(
						'ppla-charts-grid-card-chart',
						isFetching && !isInitialLoad && 'is-updating'
					)}
				>
					{isInitialLoad && (
						<div className="ppla-charts-grid-card-placeholder">
							<div className="ppla-spinner" />
						</div>
					)}

					{!isInitialLoad && totalDevices === 0 ? (
						<p
							className="ppla-charts-grid-card-empty"
							role="status"
						>
							{emptyMessage}
						</p>
					) : (
						<>
							<div
								style={{
									position: 'relative',
									height: '180px',
								}}
								role="img"
								aria-label={sprintf(
									/* translators: 1: desktop share, 2: mobile share, 3: tablet share. */
									__('Devices: desktop %1$s, mobile %2$s, tablet %3$s.', 'primeplaced-logless-analytics'),
									formatPercent(totalDevices > 0 ? ((data?.desktop || 0) / totalDevices) * 100 : 0, 0),
									formatPercent(totalDevices > 0 ? ((data?.mobile || 0) / totalDevices) * 100 : 0, 0),
									formatPercent(totalDevices > 0 ? ((data?.tablet || 0) / totalDevices) * 100 : 0, 0)
								)}
							>
								<Doughnut
									aria-hidden={true}
									ref={chartRef}
									data={doughnutData}
									options={{
										...COMMON_CHART_OPTIONS,
										cutout: '75%',
										plugins: {
											...COMMON_CHART_OPTIONS.plugins,
											legend: { display: false },
										},
									}}
								/>
							</div>
							<div className="ppla-custom-legend">
								{[
									{
										label: __(
											'Desktop',
											'primeplaced-logless-analytics'
										),
										value: data?.desktop || 0,
										color: '#10b981',
									},
									{
										label: __(
											'Mobile',
											'primeplaced-logless-analytics'
										),
										value: data?.mobile || 0,
										color: '#3b82f6',
									},
									{
										label: __(
											'Tablet',
											'primeplaced-logless-analytics'
										),
										value: data?.tablet || 0,
										color: '#f59e0b',
									},
								].map((item, index) => {
									const pct =
										totalDevices > 0
											? Math.round(
													(item.value /
														totalDevices) *
														100
												)
											: 0;
									const isHidden = hiddenItems.has(index);

									return (
										<div
											key={item.label}
											className={cn(
												'ppla-custom-legend-item',
												isHidden && 'is-hidden'
											)}
											role="button"
											tabIndex={0}
											aria-pressed={isHidden}
											onClick={() => toggleItem(index)}
											onKeyDown={(event) =>
												handleLegendKeyDown(
													event,
													index
												)
											}
										>
											<div className="ppla-custom-legend-label">
												<span
													className="dot"
													style={{
														backgroundColor:
															item.color,
													}}
												/>
												<span>{item.label}</span>
											</div>
											<div className="ppla-custom-legend-bar-wrapper">
												<div className="ppla-custom-legend-bar-bg">
													<div
														className="ppla-custom-legend-bar-fill"
														style={{
															width: `${shouldAnimate && !isHidden ? pct : 0}%`,
															backgroundColor:
																item.color,
														}}
													/>
												</div>
												<strong className="ppla-custom-legend-value">
													{formatPercent(pct, 0)}
												</strong>
											</div>
										</div>
									);
								})}
							</div>
						</>
					)}
				</div>
			</div>
		);
	}
);
