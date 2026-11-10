/**
 * Event Configuration Section Component.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useRef, useEffect } from '@wordpress/element';
import { Card, Panel, PanelBody } from '@wordpress/components';
import { applyFilters } from '@wordpress/hooks';
import type { ReactNode } from 'react';
import { useSettingsStateContext, useSettingsDispatch } from '@shared/contexts';
import { PplaToggler } from '@shared/components/PplaToggler/PplaToggler';
import { cn } from '@shared/utils/formatting';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import { help } from '@wordpress/icons';
import { useEventWorkspacePanel } from './EventWorkspacePanelStore';
import { CustomEventsSection } from './CustomEventsSection';

export const EventConfigurationSection = ( { title, spyRef, isActive, className }: StickySectionProps ) => {	
	const cardRef = useRef<HTMLDivElement>( null );

	useEffect( () => {
		if ( spyRef && cardRef.current ) {
			spyRef( cardRef.current );
		}
	}, [ spyRef ] );

	const { settings, isSaving, isLoading } = useSettingsStateContext();
	const { autosaveSettings } = useSettingsDispatch();

	const isPremium = window.pplaAdminData?.is_premium ?? false;

	const trackOutbound = settings?.track_outbound_links ?? false;
	const trackDownloads = settings?.track_file_downloads ?? false;
	const workspacePanel = useEventWorkspacePanel();
	const isAutomatedPanelOpen = workspacePanel?.activePanelId === 'automated';

	return (
		<Card className={cn( 'ppla-settings-card', className, isActive && 'ppla-is-active' )} ref={cardRef}>
			<Panel header={title} className="ppla-events-workspace-panel">
				<PanelBody
					icon={help}
					opened={isAutomatedPanelOpen}
					buttonProps={{ onClick: () => workspacePanel?.selectPanel( 'automated' ) }}
					scrollAfterOpen={false}
					title={
					<>
					<div className="ppla-settings-card-headings">
							<h2 className='ppla-settings-card-heading'>{__( 'Automatic events', 'primeplaced-logless-analytics' )}</h2>
						<p className="ppla-settings-card-description">
								{__( 'Built-in interactions you can turn on or off.', 'primeplaced-logless-analytics' )}
						</p>
					</div>
					</>}
					className="ppla-events-workspace-panel__body"
				>
					<PplaToggler
						className="ppla-events-workspace-panel__toggle"
						isLoading={isLoading}
						isSaving={isSaving}
						label={__( 'Track outbound links', 'primeplaced-logless-analytics' )}
						help={__( 'Record when a visitor clicks a link leading to an external website', 'primeplaced-logless-analytics' )}
						checked={trackOutbound}
						onChange={( val: boolean ) => void autosaveSettings( { track_outbound_links: val } )}
					/>
					{ /* Premium edits these rules in Event Studio instead. */ }
					{ applyFilters( 'ppla.settings.Events.ShowCustomEventRules', true ) && <CustomEventsSection /> }
					<PplaToggler
						className="ppla-events-workspace-panel__toggle"
						isLoading={isLoading}
						isSaving={isSaving}
						label={__( 'Track file downloads', 'primeplaced-logless-analytics' )}
						help={__( 'Record clicks on files like .pdf, .zip, .docx, .mp4', 'primeplaced-logless-analytics' )}
						checked={trackDownloads}
						onChange={( val: boolean ) => void autosaveSettings( { track_file_downloads: val } )}
					/>
					{ applyFilters(
						'ppla.settings.Events.AutomatedOptions',
						null,
						{ isLoading, isSaving, isPremium, autosaveSettings }
					) as ReactNode }
				</PanelBody>
				{ applyFilters(
					'ppla.settings.Events.Options',
					null,
					{ isLoading, isSaving, isPremium, autosaveSettings }
				) as ReactNode }
			</Panel>
		</Card>
	);
};
