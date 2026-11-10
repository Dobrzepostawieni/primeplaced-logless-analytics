/**
 * Privacy & GDPR Section Component.
 *
 * @package
 */
import { __, sprintf } from '@wordpress/i18n';
import { useRef, useEffect, useState } from '@wordpress/element';
import { Card, CardHeader, CardBody } from '@wordpress/components';
import { useAppState, useSettingsStateContext, useSettingsDispatch } from '@shared/contexts';
import { ConfirmModal } from '@admin/components/ConfirmModal';
import { PplaSelectControl } from '@shared/components/PplaSelectControl';
import { cn } from '@shared/utils/formatting';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import type { PrivacyModeHistoryEntry } from '@shared/types';
import { formatDateTime } from '@shared/utils/numberFormat';


const privacyModeLabel = ( mode: PrivacyModeHistoryEntry['from'] ): string => mode === 'session_hash'
	? __( 'Rotating pseudonymous sessions', 'primeplaced-logless-analytics' )
	: __( 'Strict Anonymous Mode', 'primeplaced-logless-analytics' );

const formatHistoryDate = ( value: string ): string => {
	const date = new Date( `${ value.replace( ' ', 'T' ) }Z` );
	return Number.isNaN( date.getTime() ) ? value : formatDateTime( date );
};

export const PrivacySection = ( { title, spyRef, isActive, className }: StickySectionProps ) => {
	const cardRef = useRef<HTMLDivElement>( null );
	const [ isStrictModalOpen, setIsStrictModalOpen ] = useState( false );

	useEffect( () => {
		if ( spyRef && cardRef.current ) {
			spyRef( cardRef.current );
		}
	}, [ spyRef ] );

	const { settings, isSaving, isLoading, isDirty } = useSettingsStateContext();
	const { pplaData } = useAppState();
	const { updateSettings } = useSettingsDispatch();

	const strictAnonymousMode = settings?.strict_anonymous_mode ?? true;
	const privacyHistory = Array.isArray( settings?.privacy_history )
		? [ ...settings.privacy_history ].reverse()
		: [];
	const dataRetention = settings?.data_retention ?? 30;
	const retentionLabel = 0 === dataRetention
		? __( 'until deleted', 'primeplaced-logless-analytics' )
		: sprintf(
			/* translators: %d: number of days analytics data is kept. */
			__( '%d days', 'primeplaced-logless-analytics' ),
			dataRetention
		);
	const isPremium = Boolean( pplaData?.is_premium );
	const activeFilters = [
		settings?.filter_bots && __( 'bots', 'primeplaced-logless-analytics' ),
		settings?.ignore_admins && __( 'administrators', 'primeplaced-logless-analytics' ),
		settings?.ignore_editors && __( 'editors', 'primeplaced-logless-analytics' ),
		settings?.ignore_authors && __( 'authors', 'primeplaced-logless-analytics' ),
		( settings?.excluded_ips || [] ).length > 0 && __( 'excluded addresses', 'primeplaced-logless-analytics' ),
		( settings?.excluded_urls || [] ).length > 0 && __( 'excluded URLs', 'primeplaced-logless-analytics' ),
	].filter( Boolean ) as string[];

	const selectStrictAnonymous = () => {
		updateSettings( { strict_anonymous_mode: true } );
	};

	const selectRotatingSessions = () => {
		if ( strictAnonymousMode ) {
			setIsStrictModalOpen( true );
		}
	};

	const confirmDisableStrictAnonymous = () => {
		updateSettings( { strict_anonymous_mode: false } );
		setIsStrictModalOpen( false );
	};

	return (
		<Card className={cn( 'ppla-settings-card', className, isActive && 'ppla-is-active' )} ref={cardRef}>
			<CardHeader className="ppla-settings-card-header">
				<h2>{title}</h2>
			</CardHeader>
			<CardBody className="ppla-settings-card-body ppla-settings-card-body--padded">
				<div className="ppla-privacy-mode" role="radiogroup" aria-label={__( 'Privacy mode', 'primeplaced-logless-analytics' )}>
					<div className="ppla-privacy-mode__heading">
						<div>
							<span className="ppla-privacy-mode__eyebrow">{__( 'Privacy mode', 'primeplaced-logless-analytics' )}</span>
							<h3>{__( 'Choose how session data is interpreted', 'primeplaced-logless-analytics' )}</h3>
						</div>
						{isDirty && <span className="ppla-privacy-mode__pending">{__( 'Pending save', 'primeplaced-logless-analytics' )}</span>}
					</div>
					<div className="ppla-privacy-mode__options">
						<button
							type="button"
							className={cn( 'ppla-privacy-mode__option', strictAnonymousMode && 'is-selected' )}
							role="radio"
							aria-checked={strictAnonymousMode}
							disabled={isLoading || isSaving}
							onClick={selectStrictAnonymous}
						>
							<span className="ppla-privacy-mode__option-title">{__( 'Strict Anonymous', 'primeplaced-logless-analytics' )}</span>
							<span>{__( 'Aggregate totals only. No visitor or session identifiers are used.', 'primeplaced-logless-analytics' )}</span>
						</button>
						<button
							type="button"
							className={cn( 'ppla-privacy-mode__option', ! strictAnonymousMode && 'is-selected' )}
							role="radio"
							aria-checked={! strictAnonymousMode}
							disabled={isLoading || isSaving}
							onClick={selectRotatingSessions}
						>
							<span className="ppla-privacy-mode__option-title">
								{__( 'Rotating pseudonymous sessions', 'primeplaced-logless-analytics' )}
								<span className="ppla-privacy-mode__recommended">{__( 'Recommended', 'primeplaced-logless-analytics' )}</span>
							</span>
							<span>{__( 'Enables session-based visits, bounce rate and visit duration. Session hashes rotate daily.', 'primeplaced-logless-analytics' )}</span>
						</button>
					</div>
				</div>

				<div className="ppla-privacy-summary" aria-live="polite">
					<div>
						<span>{__( 'Reports', 'primeplaced-logless-analytics' )}</span>
						<strong>{__( 'Aggregate reports stay available', 'primeplaced-logless-analytics' )}</strong>
					</div>
					<div>
						<span>{__( 'Sessions', 'primeplaced-logless-analytics' )}</span>
						<strong>{strictAnonymousMode ? __( 'Aggregate totals only', 'primeplaced-logless-analytics' ) : __( 'Session-based metrics available', 'primeplaced-logless-analytics' )}</strong>
					</div>
					<div>
						<span>{__( 'History', 'primeplaced-logless-analytics' )}</span>
						<strong>{__( 'Existing rows stay unchanged', 'primeplaced-logless-analytics' )}</strong>
					</div>
					{isPremium && (
						<div>
							<span>{__( 'Country reporting', 'primeplaced-logless-analytics' )}</span>
							<strong>{__( 'Local aggregate available', 'primeplaced-logless-analytics' )}</strong>
						</div>
					)}
				</div>

				<div className="ppla-privacy-meta">
					<span>{__( 'Active filters', 'primeplaced-logless-analytics' )}</span>
					<strong>{activeFilters.length > 0 ? activeFilters.join( ', ' ) : __( 'None beyond the privacy mode', 'primeplaced-logless-analytics' )}</strong>
					<span>{__( 'Retention', 'primeplaced-logless-analytics' )}: {retentionLabel}</span>
				</div>

				{! strictAnonymousMode && (
					<p className="ppla-privacy-note" role="note">
						{__( 'Session hashes rotate daily. Raw IP addresses and User-Agent strings are never stored.', 'primeplaced-logless-analytics' )}
					</p>
				)}

				<details className="ppla-privacy-history">
					<summary>
						<span>
							<strong>{__( 'Privacy history', 'primeplaced-logless-analytics' )}</strong>
							<small>{privacyHistory.length > 0 ? __( 'Mode changes are marked for interpretation', 'primeplaced-logless-analytics' ) : __( 'No privacy mode changes recorded yet', 'primeplaced-logless-analytics' )}</small>
						</span>
						<em>{strictAnonymousMode ? __( 'Current: Strict Anonymous', 'primeplaced-logless-analytics' ) : __( 'Current: Rotating sessions', 'primeplaced-logless-analytics' )}</em>
					</summary>
					{privacyHistory.length > 0 ? (
						<ol>
							{privacyHistory.slice( 0, 5 ).map( ( entry ) => (
								<li key={`${entry.changed_at}-${entry.from}-${entry.to}`}>
									<strong>{privacyModeLabel( entry.from )} <span aria-hidden="true">→</span> {privacyModeLabel( entry.to )}</strong>
									<time dateTime={entry.changed_at}>{formatHistoryDate( entry.changed_at )}</time>
									<p>{__( 'This change affects future tracking only. Existing rows remain unchanged, but comparisons across this point may use different session semantics.', 'primeplaced-logless-analytics' )}</p>
								</li>
							) )}
						</ol>
					) : (
						<p className="ppla-privacy-history__empty">{__( 'When the privacy mode changes, PPLA will record the old and new interpretation here without storing visitor information.', 'primeplaced-logless-analytics' )}</p>
					)}
				</details>

				<div className="ppla-setting-group">
					<PplaSelectControl
						label={__( 'Data retention', 'primeplaced-logless-analytics' )}
						value={String( dataRetention )}
						options={[
							{ label: __( '30 days', 'primeplaced-logless-analytics' ), value: '30' },
							{ label: __( '90 days', 'primeplaced-logless-analytics' ), value: '90' },
							{ label: __( '180 days', 'primeplaced-logless-analytics' ), value: '180' },
							{ label: __( '1 year', 'primeplaced-logless-analytics' ), value: '365' },
							{ label: __( 'Keep until I delete it', 'primeplaced-logless-analytics' ), value: '0' },
						]}
						onChange={( val: string ) => updateSettings( { data_retention: Number( val ) } )}
						help={__( 'Analytics data older than this period is deleted automatically once a day. A shorter period keeps less data about your visitors.', 'primeplaced-logless-analytics' )}
						disabled={isLoading || isSaving}
						className="ppla-select-control"
					/>
				</div>
			</CardBody>

			{isStrictModalOpen && (
				<ConfirmModal
					isOpen={isStrictModalOpen}
					title={__( 'Enable pseudonymous sessions?', 'primeplaced-logless-analytics' )}
					message={__( 'Disabling strict anonymous mode creates rotating session hashes from IP address and User-Agent data. This can improve session metrics, but it may require additional privacy disclosures for your site.', 'primeplaced-logless-analytics' )}
					children={
						<div className="ppla-privacy-impact-preview">
							<strong>{__( 'What changes in reports', 'primeplaced-logless-analytics' )}</strong>
							<ul>
								<li>{__( 'Still available: pageviews, top pages, referrers, 404s, device totals and aggregate events.', 'primeplaced-logless-analytics' )}</li>
								<li>{__( 'Calculated differently: visits, bounce rate and conversion rates use rotating pseudonymous sessions.', 'primeplaced-logless-analytics' )}</li>
								{isPremium && <li>{__( 'Available: visitor journeys that require an ordered session.', 'primeplaced-logless-analytics' )}</li>}
								{isPremium && <li>{__( 'Geo remains a country-level aggregate when Geo tracking is enabled; raw IP addresses are not shown.', 'primeplaced-logless-analytics' )}</li>}
							</ul>
						</div>
					}
					confirmLabel={__( 'Use pseudonymous sessions', 'primeplaced-logless-analytics' )}
					cancelLabel={__( 'Keep strict anonymous mode', 'primeplaced-logless-analytics' )}
					onConfirm={confirmDisableStrictAnonymous}
					onCancel={() => setIsStrictModalOpen( false )}
					isDestructive={true}
				/>
			)}
		</Card>
	);
};
