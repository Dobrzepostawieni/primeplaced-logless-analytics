/**
 * Real-Time Tab Component.
 * Displays live tracking data and active users.
 *
 * @package
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	useMemo,
	useRef,
	useEffect,
	createContext,
	useContext,
} from '@wordpress/element';
import {
	Button,
	Card,
	CardHeader,
	CardBody,
	Notice,
} from '@wordpress/components';
import {
	StickyLayout,
	type StickySectionDef,
	type StickySectionProps,
} from '@admin/components/StickyLayout';
import { DataTable } from '@admin/components/DataTable/DataTable';
import { cn } from '@shared/utils/formatting';
import { getMeasurementEmptyMessage } from '@shared/utils/measurementState';
import { MeasurementStateNotice } from '@shared/components/MeasurementStateNotice';
import { useRealTimeStats } from './useRealTimeStats';
import { useRealTimeTableConfig } from './useRealTimeTableConfig';
import type { SettingsComponentProps } from '@admin/components/AnimatedTabs';
import type { RealTimeStat } from './types';
import { formatTime } from '@shared/utils/numberFormat';

const RealTimeDataContext = createContext<ReturnType<
	typeof useRealTimeStats
> | null>(null);

const LiveActivityTitle = () => (
	<span
		style={{
			display: 'flex',
			alignItems: 'center',
			gap: '8px',
		}}
	>
		<span className="ppla-live-dot"></span>
		{__('Active visits right now', 'primeplaced-logless-analytics')}
	</span>
);

const LiveActivityCount = ({ usersOnline }: { usersOnline: number }) => (
	<span
		className="ppla-live-count"
		aria-label={sprintf(
			/* translators: %d: number of visits active in the last minutes. */
			_n(
				'%d active visit',
				'%d active visits',
				usersOnline,
				'primeplaced-logless-analytics'
			),
			usersOnline
		)}
	>
		{usersOnline}
	</span>
);

const LiveTrafficSection = ({
	title,
	spyRef,
	isActive,
	className,
	headerActions,
}: StickySectionProps) => {
	const cardRef = useRef<HTMLDivElement>(null);
	const { eventsHistory, hasError, isLoading, lastUpdatedAt, measurementReason, retry } =
		useContext(RealTimeDataContext)!;

	useEffect(() => {
		if (spyRef && cardRef.current) {
			spyRef(cardRef.current);
		}
	}, [spyRef]);

	const safeEvents = eventsHistory.length > 0 ? eventsHistory : [0];
	const maxEvents = Math.max(...safeEvents, 1);
	const totalEvents = eventsHistory.reduce(
		(total, value) => total + value,
		0
	);
	const hasLiveActivity = totalEvents > 0;
	const lastUpdatedLabel = lastUpdatedAt
		? formatTime(new Date(lastUpdatedAt))
		: __('Not available yet', 'primeplaced-logless-analytics');

	const renderLiveTraffic = () => {
		if (isLoading && eventsHistory.length === 0) {
			return (
				<div className="ppla-realtime-empty" role="status">
					<div className="ppla-spinner" />
					<p>
						{__(
							'Loading live activity…',
							'primeplaced-logless-analytics'
						)}
					</p>
				</div>
			);
		}

		if (! hasLiveActivity) {
			return (
				<>
					{! hasError && (
						<MeasurementStateNotice
							reason={measurementReason}
							hasData={false}
							isLoading={isLoading}
							presentation="section-toast"
						/>
					)}
					<div className="ppla-realtime-empty" role="status">
						{hasError && (
							<strong>
								{__(
									'Live events could not be loaded. Use Try again to request the current stream.',
									'primeplaced-logless-analytics'
								)}
							</strong>
						)}
						<p>
							{__(
								'New events will appear here as visitors interact with the site.',
								'primeplaced-logless-analytics'
							)}
						</p>
					</div>
				</>
			);
		}

		return (
			<figure className="ppla-realtime-chart-figure">
				<div
					className="ppla-realtime-chart"
					role="list"
					aria-label={sprintf(
						/* translators: 1: number of pageviews, 2: number of minutes. */
						__(
							'Pageviews per minute: %1$d in the last %2$d minutes.',
							'primeplaced-logless-analytics'
						),
						totalEvents,
						eventsHistory.length
					)}
				>
					{eventsHistory.map((val: number, idx: number) => {
						const minutesAgo = eventsHistory.length - idx - 1;
						const countLabel = sprintf(
							/* translators: %d: number of pageviews. */
							_n(
								'%d pageview',
								'%d pageviews',
								val,
								'primeplaced-logless-analytics'
							),
							val
						);
						const timeLabel =
							0 === minutesAgo
								? __('this minute', 'primeplaced-logless-analytics')
								: sprintf(
										/* translators: %d: number of minutes. */
										_n(
											'%d minute ago',
											'%d minutes ago',
											minutesAgo,
											'primeplaced-logless-analytics'
										),
										minutesAgo
									);

						return (
							<div
								key={idx}
								className="bar-wrapper"
								role="listitem"
								aria-label={`${countLabel}, ${timeLabel}`}
							>
								{val > 0 && (
									<span className="bar-label" aria-hidden="true">
										{val}
									</span>
								)}
								<div
									className="bar"
									style={{
										height: `${(val / maxEvents) * 100}%`,
									}}
									title={`${countLabel}, ${timeLabel}`}
								></div>
							</div>
						);
					})}
				</div>
				<figcaption className="ppla-realtime-chart-axis" aria-hidden="true">
					<span>
						{sprintf(
							/* translators: %d: number of minutes. */
							__('%d min ago', 'primeplaced-logless-analytics'),
							eventsHistory.length
						)}
					</span>
					<span>{__('Now', 'primeplaced-logless-analytics')}</span>
				</figcaption>
			</figure>
		);
	};

	return (
		<Card
			className={cn(
				'ppla-settings-card',
				className,
				isActive && 'ppla-is-active'
			)}
			ref={cardRef}
		>
			<CardHeader className="ppla-settings-card-header">
				<h2>{title}</h2>
				{headerActions}
			</CardHeader>
			<CardBody className="ppla-settings-card-body">
				{hasError && (
					<Notice status="error" isDismissible={false}>
						{__(
							'Live data could not be refreshed.',
							'primeplaced-logless-analytics'
						)}{' '}
						<Button
							variant="link"
							onClick={() => void retry()}
							disabled={isLoading}
						>
							{__('Try again', 'primeplaced-logless-analytics')}
						</Button>
					</Notice>
				)}

				{renderLiveTraffic()}
				<div className="ppla-settings-card-headings">
					<p className="ppla-settings-card-description">
						{__(
							'Pageviews per minute over the last 20 minutes.',
							'primeplaced-logless-analytics'
						)}
					</p>
					<p className="ppla-settings-card-description">
						{sprintf(
							/* translators: %s: localized time when data was last updated. */
							__(
								'Last updated: %s',
								'primeplaced-logless-analytics'
							),
							lastUpdatedLabel
						)}
					</p>
				</div>
			</CardBody>
		</Card>
	);
};

const ActiveUsersSection = ({
	title,
	spyRef,
	isActive,
	className,
}: StickySectionProps) => {
	const cardRef = useRef<HTMLDivElement>(null);
	const { hits, hasError, isLoading, measurementReason } = useContext(RealTimeDataContext)!;
	const config = useRealTimeTableConfig();

	useEffect(() => {
		if (spyRef && cardRef.current) {
			spyRef(cardRef.current);
		}
	}, [spyRef]);

	return (
		<Card
			className={cn(
				'ppla-settings-card',
				className,
				isActive && 'ppla-is-active'
			)}
			ref={cardRef}
		>
			<CardHeader className="ppla-settings-card-header">
				<h2>{title}</h2>
			</CardHeader>
			<CardBody className="ppla-settings-card-body">
				<DataTable<RealTimeStat>
					storageKey="ppla_realtime_hits"
					data={hits}
					columns={config.columns}
					isLoading={isLoading}
					initialPerPage={10}
					perPageOptions={[10, 25, 50]}
					initialSortBy="time_on_page"
					initialSortDirection="desc"
					searchableFields={['url', 'source']}
					searchLabel={__(
						'Search live session stream',
						'primeplaced-logless-analytics'
					)}
					tableLabel={__(
						'Live session stream',
						'primeplaced-logless-analytics'
					)}
					emptyContent={
						hasError
							? __(
									'Live sessions could not be loaded. Use Try again above.',
									'primeplaced-logless-analytics'
								)
							: getMeasurementEmptyMessage( measurementReason, __( 'No active sessions right now.', 'primeplaced-logless-analytics' ) )
					}
				/>
				<div className="ppla-settings-card-headings">
					<p className="ppla-settings-card-description">
						{__(
							'Shows activity from the last 20 minutes and refreshes every 30 seconds.',
							'primeplaced-logless-analytics'
						)}
					</p>
				</div>
			</CardBody>
		</Card>
	);
};

export const RealTime = ({
	className,
}: SettingsComponentProps): JSX.Element => {
	const stats = useRealTimeStats();

	const sections = useMemo<StickySectionDef[]>(
		() => [
			{
				id: 'live-traffic',
				title: <LiveActivityTitle />,
				headerActions: <LiveActivityCount usersOnline={stats.usersOnline} />,
				component: LiveTrafficSection,
			},
			{
				id: 'active-sessions',
				title: __(
					'Live Session Stream',
					'primeplaced-logless-analytics'
				),
				component: ActiveUsersSection,
			},
		],
		[stats.usersOnline]
	);

	return (
		<RealTimeDataContext.Provider value={stats}>
			<div className="ppla-realtime">
				<StickyLayout
					title={__('Real-Time', 'primeplaced-logless-analytics')}
					sections={sections}
					className={className}
				/>
			</div>
		</RealTimeDataContext.Provider>
	);
};
