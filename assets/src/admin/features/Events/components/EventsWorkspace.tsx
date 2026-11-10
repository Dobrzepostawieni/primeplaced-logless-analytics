/**
 * Fixed configuration and report workspace for Events & Goals.
 *
 * @package
 */
import {
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis -- ToggleGroupControl is the app's established segmented-control pattern.
	__experimentalToggleGroupControl as ToggleGroupControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis -- ToggleGroupControlOption is required by the WordPress segmented control.
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { PplaSelectControl } from '@shared/components/PplaSelectControl';
import { useMediaQuery } from '@shared/hooks/useMediaQuery';
import type { EventsWorkspaceTab, EventWorkspacePanel, EventWorkspaceReport } from '../types';
import { selectEventWorkspacePanel } from './EventWorkspacePanelStore';

interface EventsWorkspaceProps {
	tabs: EventsWorkspaceTab[];
	eventPanels: EventWorkspacePanel[];
	eventReports: EventWorkspaceReport[];
}

export const EventsWorkspace = ( { tabs, eventPanels, eventReports }: EventsWorkspaceProps ): JSX.Element | null => {
	// A report link such as `#ppla-section-events` opens that workspace tab.
	const [ activeId, setActiveId ] = useState( () => {
		const requested = typeof window !== 'undefined'
			? window.location.hash.replace( /^#ppla-section-/, '' )
			: '';

		return tabs.some( ( tab ) => tab.id === requested ) ? requested : tabs[ 0 ]?.id || '';
	} );
	const [ tabDirection, setTabDirection ] = useState<'forward' | 'backward'>( 'forward' );
	// Five segmented options do not fit a phone; a select keeps one tap per change.
	const isMobile = useMediaQuery( '(max-width: 782px)' );
	const [ activePanelId, setActivePanelId ] = useState( eventPanels[ 0 ]?.id || '' );
	const [ reportDirection, setReportDirection ] = useState<'down' | 'up'>( 'down' );
	const activeIndex = Math.max( 0, tabs.findIndex( ( tab ) => tab.id === activeId ) );
	const activeTab = tabs[ activeIndex ];
	const activePanelIndex = Math.max( 0, eventPanels.findIndex( ( panel ) => panel.id === activePanelId ) );
	const activePanel = eventPanels[ activePanelIndex ];
	const activeReport = eventReports.find( ( report ) => report.id === activePanel?.reportId ) || eventReports[ 0 ];
	const activePanelRef = useRef( activePanelId );

	useEffect( () => {
		if ( eventPanels.some( ( panel ) => panel.id === activePanelId ) ) {
			return;
		}

		setActivePanelId( eventPanels[ 0 ]?.id || '' );
	}, [ activePanelId, eventPanels ] );

	const changeTab = ( nextId: string | number | undefined ): void => {
		const nextIndex = tabs.findIndex( ( tab ) => tab.id === nextId );
		if ( nextIndex < 0 || nextIndex === activeIndex ) {
			return;
		}

		setTabDirection( nextIndex > activeIndex ? 'forward' : 'backward' );
		setActiveId( String( nextId ) );
	};
	const changeTabRef = useRef( changeTab );
	changeTabRef.current = changeTab;
	const selectPanel = useCallback( ( nextPanelId: string ): void => {
		setActivePanelId( ( currentPanelId ) => {
			const currentIndex = eventPanels.findIndex( ( panel ) => panel.id === currentPanelId );
			const nextIndex = eventPanels.findIndex( ( panel ) => panel.id === nextPanelId );

			if ( nextIndex < 0 || nextIndex === currentIndex ) {
				return currentPanelId;
			}

			setReportDirection( nextIndex > currentIndex ? 'down' : 'up' );
			return nextPanelId;
		} );
	}, [ eventPanels ] );

	useEffect( () => {
		activePanelRef.current = activePanelId;
	}, [ activePanelId ] );

	useEffect( () => {
		// Panels share ids with report tabs (forms, commerce), so the event says
		// whether the report or the configuration panel was requested.
		const showConfiguration = ( panelId: string ): void => {
			selectPanel( panelId );
			if ( tabs.some( ( tab ) => tab.id === 'events' ) ) {
				changeTabRef.current( 'events' );
			}
		};
		const handlePanelChange = ( event: Event ): void => {
			const panelId = ( event as CustomEvent<string> ).detail;
			// This component re-broadcasts its own selection; ignore the echo.
			if ( panelId !== activePanelRef.current ) {
				selectPanel( panelId );
			}
		};
		const handleOpenReport = ( event: Event ): void => {
			const reportId = ( event as CustomEvent<string> ).detail;
			// A report with its own workspace tab (e.g. forms, commerce) opens that tab.
			if ( tabs.some( ( tab ) => tab.id === reportId ) ) {
				changeTabRef.current( reportId );
				return;
			}
			showConfiguration( reportId );
		};
		const handleConfigure = ( event: Event ): void => {
			showConfiguration( ( event as CustomEvent<string> ).detail );
		};

		window.addEventListener( 'ppla:event-workspace-panel-change', handlePanelChange );
		window.addEventListener( 'ppla:event-workspace-open-report', handleOpenReport );
		window.addEventListener( 'ppla:event-workspace-configure', handleConfigure );
		return () => {
			window.removeEventListener( 'ppla:event-workspace-panel-change', handlePanelChange );
			window.removeEventListener( 'ppla:event-workspace-open-report', handleOpenReport );
			window.removeEventListener( 'ppla:event-workspace-configure', handleConfigure );
		};
	}, [ selectPanel, tabs ] );

	useEffect( () => {
		selectEventWorkspacePanel( activePanelId );
	}, [ activePanelId ] );

	if ( ! activeTab ) {
		return null;
	}

	const Configuration = activeTab.configuration;
	const Report = activeTab.report;
	const ActiveEventReport = activeReport?.component;
	let workspaceContent: JSX.Element | null = null;

	if ( activeTab.view === 'single' && Configuration ) {
		workspaceContent = (
			<div className={`ppla-events-workspace__panel ppla-events-workspace__panel--full is-${tabDirection}`}>
				<Configuration key={`${activeTab.id}-single`} title={activeTab.configurationTitle || activeTab.reportTitle} isActive={false} />
			</div>
		);
	} else if ( activeTab.view === 'report' ) {
		workspaceContent = (
			<div className={`ppla-events-workspace__panel ppla-events-workspace__panel--full is-${tabDirection}`}>
				<Report key={`${activeTab.id}-report`} title={activeTab.reportTitle} isActive={false} />
			</div>
		);
	} else if ( activeTab.id === 'events' && Configuration && ActiveEventReport && activeReport ) {
		workspaceContent = (
			<div className="ppla-events-workspace__grid">
				<div className={`ppla-events-workspace__panel is-${tabDirection}`}>
					<Configuration key="events-configuration" title={activeTab.configurationTitle} isActive={false} />
				</div>
				<div className={`ppla-events-workspace__panel is-report-${reportDirection}`}>
					<ActiveEventReport key={activeReport.id} title={activeReport.title} isActive={false} />
				</div>
			</div>
		);
	} else if ( Configuration ) {
		workspaceContent = (
			<div className="ppla-events-workspace__grid">
				<div className={`ppla-events-workspace__panel is-${tabDirection}`}>
					<Configuration key={`${activeTab.id}-configuration`} title={activeTab.configurationTitle} isActive={false} />
				</div>
				<div className={`ppla-events-workspace__panel is-${tabDirection}`}>
					<Report key={`${activeTab.id}-report`} title={activeTab.reportTitle} isActive={false} />
				</div>
			</div>
		);
	}

	return (
		<section className="ppla-events-workspace" aria-label={__( 'Events and goals workspace', 'primeplaced-logless-analytics' )}>
			{tabs.length > 1 && isMobile && (
				<PplaSelectControl
					label={__( 'Workspace', 'primeplaced-logless-analytics' )}
					hideLabelFromVision
					value={activeTab.id}
					options={tabs.map( ( tab ) => ( { value: tab.id, label: tab.label } ) )}
					onChange={changeTab}
					className="ppla-events-workspace__tabs-select"
				/>
			)}
			{tabs.length > 1 && ! isMobile && <ToggleGroupControl
				label={__( 'Workspace', 'primeplaced-logless-analytics' )}
				hideLabelFromVision
				value={activeTab.id}
				onChange={changeTab}
				isBlock
				className="ppla-events-workspace__tabs"
				__next40pxDefaultSize
			>
				{tabs.map( ( tab ) => (
					<ToggleGroupControlOption
						key={tab.id}
						value={tab.id}
						label={tab.label}
						showTooltip={false}
					/>
				) )}
			</ToggleGroupControl>}

			{workspaceContent}
		</section>
	);
};
