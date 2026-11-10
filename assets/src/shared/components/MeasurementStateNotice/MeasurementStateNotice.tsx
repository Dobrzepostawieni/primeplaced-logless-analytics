import { Button, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useEffect, useRef, useState } from '@wordpress/element';
import { useNotices } from '@shared/components/Notices';
import { getMeasurementEmptyMessage } from '@shared/utils/measurementState';
import { copyTextToClipboard } from '@shared/utils/clipboard';


interface MeasurementStateNoticeProps {
	reason?: string;
	hasData?: boolean;
	isLoading?: boolean;
	hasError?: boolean;
	onRetry?: () => void;
	presentation?: 'inline' | 'section-toast';
}

const WARNING_REASONS = [ 'configuration_error', 'queue_not_scheduled', 'viewer_excluded', 'privacy_restricted', 'session_hash_required' ];

// Section notices go to the app's fixed notices once per page view, so a
// report that refreshes every few seconds does not repeat the same message.
const shownSectionNotices = new Set<string>();

const openSettingsSection = ( section: string ): void => {
	const url = new URL( window.location.href );
	url.searchParams.set( 'tab', 'settings' );
	url.hash = `ppla-section-${ section }`;
	window.history.pushState( {}, '', url );
	window.dispatchEvent( new PopStateEvent( 'popstate' ) );
};

const openPublicSite = (): void => {
	const siteUrl = window.pplaAdminData?.site_url;

	if ( siteUrl ) {
		window.open( siteUrl, '_blank', 'noopener,noreferrer' );
	}
};

/**
 * Adds the next useful action to a report state that has no rows yet.
 *
 * The table remains the source of the empty copy. This notice only makes the
 * next action discoverable and avoids presenting a valid zero as a success.
 */
export const MeasurementStateNotice = ( {
	reason,
	hasData = false,
	isLoading = false,
	hasError = false,
	onRetry,
	presentation = 'inline',
}: MeasurementStateNoticeProps ): JSX.Element | null => {
	const isSectionToast = reason === 'feature_disabled' || presentation === 'section-toast';
	const featureNoticeRef = useRef<HTMLDivElement>( null );
	const [ hasEnteredViewport, setHasEnteredViewport ] = useState( ! isSectionToast );
	const [ copyMessage, setCopyMessage ] = useState( '' );
	const { notify } = useNotices();
	const message = reason ? getMeasurementEmptyMessage( reason, '' ) : '';
	const isWarning = WARNING_REASONS.includes( reason || '' );
	const canShow = Boolean( message ) && ! hasData && ! isLoading && ! hasError && reason !== 'permission_denied';

	useEffect( () => {
		if ( ! isSectionToast || hasEnteredViewport ) {
			return;
		}

		const noticeElement = featureNoticeRef.current;
		if ( ! noticeElement || typeof IntersectionObserver === 'undefined' ) {
			setHasEnteredViewport( true );
			return;
		}

		const observer = new IntersectionObserver(
			( [ entry ] ) => {
				if ( entry?.isIntersecting ) {
					setHasEnteredViewport( true );
					observer.disconnect();
				}
			},
			{ threshold: 0.15 }
		);

		observer.observe( noticeElement );

		return () => observer.disconnect();
	}, [ isSectionToast, hasEnteredViewport ] );

	useEffect( () => {
		if ( ! isSectionToast || ! hasEnteredViewport || ! canShow ) {
			return;
		}

		const noticeKey = `${ reason }|${ window.location.search }`;
		if ( shownSectionNotices.has( noticeKey ) ) {
			return;
		}

		shownSectionNotices.add( noticeKey );
		notify( isWarning ? 'MEASUREMENT_STATE_WARNING' : 'MEASUREMENT_STATE', message );
	}, [ isSectionToast, hasEnteredViewport, canShow, reason, isWarning, message, notify ] );

	if ( isSectionToast ) {
		// Only marks the section position for the viewport check above.
		return <div ref={featureNoticeRef} className="ppla-section-measurement-anchor" aria-hidden="true" />;
	}

	if ( ! canShow || ! reason ) {
		return null;
	}

	let action: JSX.Element | null = null;

	if ( reason === 'viewer_excluded' ) {
		const copySiteAddress = (): void => {
			const siteUrl = window.pplaAdminData?.site_url;
			if ( ! siteUrl ) return;

			void copyTextToClipboard( siteUrl ).then( ( copied ) => {
				setCopyMessage(
					copied
						? __( 'Site address copied.', 'primeplaced-logless-analytics' )
						: __( 'The site address could not be copied.', 'primeplaced-logless-analytics' )
				);
			} );
		};
		action = (
			<>
				{window.pplaAdminData?.site_url && (
					<Button className="ppla-button" variant="secondary" onClick={ openPublicSite }>
						{__( 'Open public site', 'primeplaced-logless-analytics' )}
					</Button>
				)}
				{window.pplaAdminData?.site_url && (
					<Button className="ppla-button" variant="tertiary" onClick={ copySiteAddress }>
						{__( 'Copy site address', 'primeplaced-logless-analytics' )}
					</Button>
				)}
				<Button className="ppla-button" variant="tertiary" onClick={ () => openSettingsSection( 'exclusions' ) }>
					{__( 'Open Exclusions', 'primeplaced-logless-analytics' )}
				</Button>
				{copyMessage && <span role="status">{copyMessage}</span>}
			</>
		);
	} else if ( [ 'privacy_restricted', 'session_hash_required' ].includes( reason ) ) {
		action = (
			<Button className="ppla-button" variant="secondary" onClick={ () => openSettingsSection( 'privacy' ) }>
				{__( 'Open Settings', 'primeplaced-logless-analytics' )}
			</Button>
		);
	} else if ( [ 'queue_not_scheduled', 'configuration_error' ].includes( reason ) ) {
		action = (
			<Button className="ppla-button" variant="secondary" onClick={ () => openSettingsSection( 'maintenance' ) }>
				{__( 'Open Maintenance', 'primeplaced-logless-analytics' )}
			</Button>
		);
	} else if ( reason === 'buffer_pending' && onRetry ) {
		action = (
			<Button className="ppla-button" variant="secondary" onClick={ onRetry }>
				{__( 'Refresh report', 'primeplaced-logless-analytics' )}
			</Button>
		);
	} else if ( [ 'no_data_yet', 'data_stale' ].includes( reason ) && window.pplaAdminData?.site_url ) {
		action = (
			<Button className="ppla-button" variant="secondary" onClick={ openPublicSite }>
				{__( 'Open public site', 'primeplaced-logless-analytics' )}
			</Button>
		);
	}

	return (
		<Notice
			className="ppla-measurement-state-notice"
			status={ isWarning ? 'warning' : 'info' }
			isDismissible={ false }
		>
			<p>{message}</p>
			{action}
		</Notice>
	);
};
