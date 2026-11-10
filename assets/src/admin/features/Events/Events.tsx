/**
 * Events Tab Module.
 *
 * @package
 */
import { Button, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useMemo, useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import { StickyLayout, type StickySectionProps } from '@admin/components/StickyLayout';
import { ReportTableActions, type CsvColumn } from '@admin/components/ReportTableActions';
import { ReportTableSection } from '@admin/components/ReportTableSection';
import { SourceDistributionChart } from '@admin/features/ContentSources/components/SourceDistributionChart';
import { useEventsTable } from './useEvents';
import { useEventsTableConfig } from './useEventsTableConfig';
import { EventConfigurationSection } from './components/EventConfigurationSection';
import { EventsWorkspace } from './components/EventsWorkspace';
import { useAppState } from '@shared/contexts';
import type { SettingsComponentProps } from '@admin/components/AnimatedTabs';
import type { EventStat, EventsWorkspaceTab, EventWorkspacePanel, EventWorkspaceReport } from './types';
import { getEventLabel } from '@shared/utils/eventLabels';
import {
	getMeasurementEmptyMessage,
} from '@shared/utils/measurementState';
import { getReportRangeFromUrl } from '@admin/features/Reports/reportNavigation';

const csvColumns: CsvColumn<EventStat>[] = [
	{ header: __('Event', 'primeplaced-logless-analytics'), value: ( row ) => getEventLabel( row.event_type ) },
	{ header: __('Event ID', 'primeplaced-logless-analytics'), value: ( row ) => row.event_type },
	{ header: __('Provider', 'primeplaced-logless-analytics'), value: ( row ) => row.provider_id },
	{ header: __('Total Count', 'primeplaced-logless-analytics'), value: ( row ) => row.total_events },
	{ header: __('Total Value', 'primeplaced-logless-analytics'), value: ( row ) => row.total_value },
];

const EventTrackingSection = ( { title, spyRef, isActive, className }: StickySectionProps ) => {
	const [ range, setRange ] = useState( () => getReportRangeFromUrl() );
	const { isLoading, hasError, data, measurementReason, retry } = useEventsTable( range );
	const { columns } = useEventsTableConfig();

	return (
		<ReportTableSection<EventStat>
			title={title}
			spyRef={spyRef}
			isActive={isActive}
			className={className}
			showPrivacyNotice={false}
				headerActions={
					<ReportTableActions<EventStat>
						reportTitle={__('Events', 'primeplaced-logless-analytics')}
						range={range}
					onRangeChange={setRange}
					isLoading={isLoading}
					csvColumns={csvColumns}
					csvFilename="ppla-tracked-events"
					savedViewsKey="ppla_events_table"
				/>
			}
			aside={
				<SourceDistributionChart
					title={__( 'Most frequent events', 'primeplaced-logless-analytics' )}
					label={__( 'events', 'primeplaced-logless-analytics' )}
					summaryUnit="event"
					variant="ranking"
					showTotal={false}
					items={data.map( ( row ) => ( { label: getEventLabel( row.event_type ), value: row.total_events } ) )}
					emptyMessage={hasError
						? __( 'No event data is available because the report could not be loaded.', 'primeplaced-logless-analytics' )
						: getMeasurementEmptyMessage( measurementReason, __( 'No events recorded yet. Events will appear after the tracker receives an interaction.', 'primeplaced-logless-analytics' ) )}
				/>
			}
			splitStorageKey="events-tracked"
			bodyBeforeTable={
				<>
					{hasError && (
						<Notice status="error" isDismissible={false}>
							{data.length > 0
								? __( 'We could not refresh Events. Your last available rows are still shown.', 'primeplaced-logless-analytics' )
								: __( 'We could not load Events. Please try again.', 'primeplaced-logless-analytics' )}{' '}
							<Button
								variant="link"
								onClick={() => void retry()}
								disabled={isLoading}
							>
								{__( 'Try again', 'primeplaced-logless-analytics' )}
							</Button>
						</Notice>
					)}
					{isLoading && data.length > 0 && (
						<p className="ppla-help" role="status">
							{__( 'Refreshing Events data…', 'primeplaced-logless-analytics' )}
						</p>
					)}
				</>
			}
			table={{
				storageKey: 'ppla_events_table',
				data,
				columns,
				isLoading,
				initialPerPage: 10,
				perPageOptions: [ 10, 25, 50, 100 ],
				initialSortBy: 'total_events',
				initialSortDirection: 'desc',
				searchableFields: [ 'event_type', 'provider_id' ],
				emptyContent: hasError
					? __( 'No event data is available because the report could not be loaded.', 'primeplaced-logless-analytics' )
					: getMeasurementEmptyMessage( measurementReason, __( 'No events recorded yet. Events will appear after the tracker receives an interaction.', 'primeplaced-logless-analytics' ) ),
			}}
		/>
	);
};

export const Events = ( { className }: SettingsComponentProps ): JSX.Element => {
	const { pplaData } = useAppState();
	const canManageSettings = pplaData.can_manage_settings;
	const workspaceTabs = useMemo<EventsWorkspaceTab[]>(
		() => applyFilters(
			'ppla.ui.EventsWorkspaceTabs',
			[
				{
					id: 'events',
					label: __( 'Events', 'primeplaced-logless-analytics' ),
					configurationTitle: __( 'Set up tracking', 'primeplaced-logless-analytics' ),
					reportTitle: __( 'Tracked events', 'primeplaced-logless-analytics' ),
					configuration: canManageSettings ? EventConfigurationSection : undefined,
					report: EventTrackingSection,
					view: canManageSettings ? 'workspace' : 'report',
				},
			] as EventsWorkspaceTab[]
		) as EventsWorkspaceTab[],
		[ canManageSettings ]
	);
	const eventPanels = useMemo<EventWorkspacePanel[]>(
		() => applyFilters(
			'ppla.ui.EventWorkspacePanels',
			[ { id: 'automated', reportId: 'events' } ] as EventWorkspacePanel[]
		) as EventWorkspacePanel[],
		[]
	);
	const eventReports = useMemo<EventWorkspaceReport[]>(
		() => applyFilters(
			'ppla.ui.EventWorkspaceReports',
			[
				{
					id: 'events',
					title: __( 'Tracked events', 'primeplaced-logless-analytics' ),
					component: EventTrackingSection,
				},
			] as EventWorkspaceReport[]
		) as EventWorkspaceReport[],
		[]
	);

	return (
		<StickyLayout
			title={__( 'Events & Goals', 'primeplaced-logless-analytics' )}
			sections={[]}
			className={className}
			beforeSections={<EventsWorkspace tabs={workspaceTabs} eventPanels={eventPanels} eventReports={eventReports} />}
		/>
	);
};
