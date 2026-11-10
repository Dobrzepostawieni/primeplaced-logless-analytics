import { __ } from '@wordpress/i18n';
import { useEffect, useRef } from '@wordpress/element';
import { Card, CardBody, CardHeader, Button, Notice } from '@wordpress/components';
import { cn } from '@shared/utils/formatting';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import { DailyTrafficChart } from './DailyTrafficChart';
import { DevicesChart } from './DevicesChart';
import { getTrafficEmptyMessage, useChartsData } from './useChartsData';
import { MeasurementStateNotice } from '@shared/components/MeasurementStateNotice';

export const ChartsSection = ({
	title,
	spyRef,
	isActive,
	className,
}: StickySectionProps): JSX.Element => {
	const cardRef = useRef<HTMLDivElement>(null);
	const {
		trafficData,
		devicesData,
		privacyMode,
		measurementReason,
		isInitialLoad,
		isFetching,
		hasError,
		retry,
	} = useChartsData();

	useEffect(() => {
		if (spyRef && cardRef.current) {
			spyRef(cardRef.current);
		}
	}, [spyRef]);

	const getEmptyMessage = () => {
		return getTrafficEmptyMessage(measurementReason, hasError);
	};
	const hasTraffic = trafficData.some(
		(item) => item.pageviews > 0 || item.visits > 0
	);

	return (
		<Card
			className={cn(
				'ppla-settings-card',
				className,
				isActive && 'ppla-is-active'
			)}
			ref={cardRef}
		>
			<CardHeader
				className="ppla-settings-card-header"
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
				}}
			>
				<h2>{title}</h2>
			</CardHeader>
			<CardBody className="ppla-settings-card-body">
				<MeasurementStateNotice
					reason={measurementReason}
					hasData={hasTraffic}
					isLoading={isFetching}
					hasError={hasError}
					onRetry={retry}
				/>
				{hasError && (
					<Notice status="error" isDismissible={false}>
						{__(
							'Traffic charts could not be loaded.',
							'primeplaced-logless-analytics'
						)}{' '}
						<Button
							variant="link"
							onClick={retry}
							disabled={isFetching}
						>
							{__('Try again', 'primeplaced-logless-analytics')}
						</Button>
					</Notice>
				)}
				<div className="ppla-charts-grid">
					<DailyTrafficChart
						data={trafficData}
						privacyMode={privacyMode}
						isFetching={isFetching}
						isInitialLoad={isInitialLoad}
						emptyMessage={getEmptyMessage()}
					/>
					<DevicesChart
						data={devicesData}
						isFetching={isFetching}
						isInitialLoad={isInitialLoad}
						emptyMessage={getEmptyMessage()}
					/>
				</div>
			</CardBody>
		</Card>
	);
};
