/**
 * Exclusions Section Component.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useRef, useEffect } from '@wordpress/element';
import { Button, Card, CardHeader, CardBody, FormTokenField } from '@wordpress/components';
import { useSettingsStateContext, useSettingsDispatch } from '@shared/contexts';
import { PplaToggler } from '@shared/components/PplaToggler/PplaToggler';
import { useExclusions } from '../useExclusions';
import { cn } from '@shared/utils/formatting';
import type { StickySectionProps } from '@admin/components/StickyLayout';

export const ExclusionsSection = ( { title, spyRef, isActive, className, headerActions }: StickySectionProps ) => {
	const cardRef = useRef<HTMLDivElement>( null );

	useEffect( () => {
		if ( spyRef && cardRef.current ) {
			spyRef( cardRef.current );
		}
	}, [ spyRef ] );

	const { settings, isSaving, isLoading } = useSettingsStateContext();
	const { updateSettings } = useSettingsDispatch();
	const {
		excludedIps,
		excludedUrls,
		ipError,
		currentIpStatus,
		isExcludingCurrentIp,
		urlSuggestions,
		handleIpChange,
		handleUrlChange,
		excludeCurrentIp,
	} = useExclusions();

	const ignoreAdmins = settings?.ignore_admins ?? true;
	const ignoreEditors = settings?.ignore_editors ?? false;
	const ignoreAuthors = settings?.ignore_authors ?? false;
	const availableSuggestions = urlSuggestions.filter( ( url ) => ! excludedUrls.includes( url ) );

	return (
		<Card className={cn( 'ppla-settings-card', className, isActive && 'ppla-is-active' )} ref={cardRef}>
			<CardHeader className="ppla-settings-card-header">
				<h2>{title}</h2>
				{headerActions}
			</CardHeader>
			<CardBody className="ppla-settings-card-body">
				
				<PplaToggler
					isLoading={isLoading}
					isSaving={isSaving}
					label={__( 'Ignore administrators', 'primeplaced-logless-analytics' )}
					help={__( 'Visits from logged-in administrators will not be tracked', 'primeplaced-logless-analytics' )}
					checked={ignoreAdmins}
					onChange={( val: boolean ) => updateSettings( { ignore_admins: val } )}
				/>

				<PplaToggler
					isLoading={isLoading}
					isSaving={isSaving}
					label={__( 'Ignore editors', 'primeplaced-logless-analytics' )}
					help={__( 'Visits from logged-in editors will not be tracked', 'primeplaced-logless-analytics' )}
					checked={ignoreEditors}
					onChange={( val: boolean ) => updateSettings( { ignore_editors: val } )}
				/>

				<PplaToggler
					isLoading={isLoading}
					isSaving={isSaving}
					label={__( 'Ignore authors', 'primeplaced-logless-analytics' )}
					help={__( 'Visits from logged-in authors will not be tracked', 'primeplaced-logless-analytics' )}
					checked={ignoreAuthors}
					onChange={( val: boolean ) => updateSettings( { ignore_authors: val } )}
				/>

				<div className="ppla-setting-group" style={{ marginTop: '16px' }}>
					<FormTokenField
						label={__( 'Excluded IP addresses', 'primeplaced-logless-analytics' )}
						value={excludedIps}
						suggestions={[]}
						onChange={handleIpChange}
						disabled={isSaving}
						placeholder={__( 'Enter IP address and press Enter…', 'primeplaced-logless-analytics' )}
						help=""
						__next40pxDefaultSize
						className="ppla-form-token-field"
					/>
					{ipError && <p className="ppla-help is-error">{ipError}</p>}
					<div className="ppla-setting-group__actions">
						<Button
							variant="secondary"
							onClick={() => void excludeCurrentIp()}
							isBusy={isExcludingCurrentIp}
							disabled={isSaving || isLoading || isExcludingCurrentIp}
							className="ppla-button"
						>
							{__( 'Add my current IP', 'primeplaced-logless-analytics' )}
						</Button>
					</div>
					{currentIpStatus && <p className="ppla-help" role="status">{currentIpStatus}</p>}
					<p className="ppla-help ppla-help--muted">
						{__( 'Press Enter to add. The button safely uses your current public address without showing it. Traffic from these addresses will be fully ignored. On a local site without a public proxy, use Ignore administrators for this preview.', 'primeplaced-logless-analytics' )}
					</p>
				</div>

				<div className="ppla-setting-group">
					<FormTokenField
						label={__( 'Excluded URL patterns', 'primeplaced-logless-analytics' )}
						value={excludedUrls}
						suggestions={availableSuggestions}
						onChange={handleUrlChange}
						disabled={isSaving}
						placeholder={__( 'e.g., /checkout/ or /blog/*', 'primeplaced-logless-analytics' )}
						help=""
						__experimentalExpandOnFocus={true}
						__next40pxDefaultSize
						className="ppla-form-token-field"
					/>
					<p className="ppla-help ppla-help--muted">
						{__( 'Select a suggestion or press Enter to add a path. A path excludes only that page; use * as a wildcard, for example /blog/* for every page below /blog/.', 'primeplaced-logless-analytics' )}
					</p>
				</div>

			</CardBody>
		</Card>
	);
};
