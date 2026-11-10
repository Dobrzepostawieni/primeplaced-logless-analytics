/**
 * Tracker Injection Section Component.
 *
 * @package
 */
import { PplaSelectControl } from '@shared/components/PplaSelectControl';
import { __ } from '@wordpress/i18n';
import { useRef, useEffect } from '@wordpress/element';
import { Card, CardHeader, CardBody} from '@wordpress/components';
import { useSettingsStateContext, useSettingsDispatch } from '@shared/contexts';
import { PplaToggler } from '@shared/components/PplaToggler/PplaToggler';
import { cn } from '@shared/utils/formatting';
import type { StickySectionProps } from '@admin/components/StickyLayout';

export const TrackerInjectionSection = ( { title, spyRef, isActive, className }: StickySectionProps ) => {
	const cardRef = useRef<HTMLDivElement>( null );

	useEffect( () => {
		if ( spyRef && cardRef.current ) {
			spyRef( cardRef.current );
		}
	}, [ spyRef ] );

	const { settings, isSaving, isLoading } = useSettingsStateContext();
	const { updateSettings } = useSettingsDispatch();

	const scriptPosition = settings?.script_position || 'head';
	const trackingMode   = settings?.tracking_mode || 'failover';
	const track404       = settings?.track_404 ?? true;
	const filterBots     = settings?.filter_bots ?? true;

	return (
		<Card className={cn( 'ppla-settings-card', className, isActive && 'ppla-is-active' )} ref={cardRef}>
			<CardHeader className="ppla-settings-card-header">
				<h2>{title}</h2>
			</CardHeader>
			<CardBody className="ppla-settings-card-body ppla-settings-card-body--padded">
				
				<div className="ppla-setting-group">
					<PplaSelectControl
						label={__( 'Script position', 'primeplaced-logless-analytics' )}
						value={scriptPosition}
						options={[
							{ label: __( 'In <head> section (recommended)', 'primeplaced-logless-analytics' ), value: 'head' },
							{ label: __( 'In <footer> section', 'primeplaced-logless-analytics' ), value: 'footer' },
						]}
						onChange={( val: string ) => updateSettings( { script_position: val as 'head' | 'footer' } )}
						help={__( 'Injecting into the <head> ensures more accurate tracking.', 'primeplaced-logless-analytics' )}
						disabled={isSaving}
						className="ppla-select-control"
					/>
				</div>

				<div className="ppla-setting-group">
					<PplaSelectControl
						label={__( 'Tracking mode', 'primeplaced-logless-analytics' )}
						value={trackingMode}
						options={[
							{ label: __( 'Automatic fallback (recommended)', 'primeplaced-logless-analytics' ), value: 'failover' },
							{ label: __( 'REST API only (advanced)', 'primeplaced-logless-analytics' ), value: 'rest' },
							{ label: __( 'Beacon POST only (advanced)', 'primeplaced-logless-analytics' ), value: 'beacon' },
						]}
						onChange={( val: string ) => updateSettings( { tracking_mode: val as 'failover' | 'rest' | 'beacon' } )}
						disabled={isSaving}
						className="ppla-select-control"
					/>
				</div>

				<PplaToggler
					isLoading={isLoading}
					isSaving={isSaving}
					label={__( 'Track 404 pages', 'primeplaced-logless-analytics' )}
					help={__( 'Count 404 errors as events', 'primeplaced-logless-analytics' )}
					checked={track404}
					onChange={( val: boolean ) => updateSettings( { track_404: val } )}
				/>

				<PplaToggler
					isLoading={isLoading}
					isSaving={isSaving}
					label={__( 'Filter bots', 'primeplaced-logless-analytics' )}
					help={__( 'Automatically ignore known bot and crawler User-Agents', 'primeplaced-logless-analytics' )}
					checked={filterBots}
					onChange={( val: boolean ) => updateSettings( { filter_bots: val } )}
				/>

			</CardBody>
		</Card>
	);
};
