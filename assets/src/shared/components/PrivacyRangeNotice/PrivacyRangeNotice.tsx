import { Button, Notice } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';

import { useSettingsStateContext } from '@shared/contexts';
import type { PrivacyModeHistoryEntry } from '@shared/types';

interface PrivacyRangeNoticeProps {
	range: number;
	/** Sanitized transitions returned by the report endpoint for this range. */
	changes?: PrivacyModeHistoryEntry[];
}

const parseUtcTimestamp = ( value: string ): number | null => {
	const normalized = value.includes( 'T' ) ? value : value.replace( ' ', 'T' );
	const timestamp = Date.parse( /(?:Z|[+-]\d{2}:?\d{2})$/.test( normalized ) ? normalized : `${ normalized }Z` );

	return Number.isFinite( timestamp ) ? timestamp : null;
};

const getModeLabel = ( mode: PrivacyModeHistoryEntry['from'] ): string => mode === 'strict_anonymous'
	? __( 'Strict Anonymous', 'primeplaced-logless-analytics' )
	: __( 'Rotating pseudonymous sessions', 'primeplaced-logless-analytics' );

const formatChangedAt = ( value: string ): string => {
	const timestamp = parseUtcTimestamp( value );
	if ( null === timestamp ) {
		return value;
	}

	return new Intl.DateTimeFormat( undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	} ).format( new Date( timestamp ) );
};

const openPrivacySettings = (): void => {
	const url = new URL( window.location.href );
	url.searchParams.set( 'tab', 'settings' );
	url.hash = 'ppla-section-privacy';
	window.history.pushState( {}, '', url );
	window.dispatchEvent( new PopStateEvent( 'popstate' ) );
};

/**
 * Explains when the selected report range crosses a privacy mode transition.
 *
 * The notice is deliberately based on the short, sanitized settings history;
 * it never receives or displays visitor data.
 */
export const PrivacyRangeNotice = ( { range, changes: reportChanges }: PrivacyRangeNoticeProps ): JSX.Element | null => {
	const { settings } = useSettingsStateContext();
	const changes = useMemo( () => {
		let history: PrivacyModeHistoryEntry[] = [];
		if ( Array.isArray( reportChanges ) ) {
			history = reportChanges;
		} else if ( Array.isArray( settings?.privacy_history ) ) {
			history = settings.privacy_history;
		}
		const now = Date.now();
		const start = now - ( Math.max( 1, range ) * 24 * 60 * 60 * 1000 );

		return history.filter( ( entry ) => {
			const timestamp = parseUtcTimestamp( entry.changed_at );
			return null !== timestamp && timestamp >= start && timestamp <= now;
		} );
	}, [ range, reportChanges, settings?.privacy_history ] );

	if ( changes.length === 0 ) {
		return null;
	}

	const latestChange = changes[ changes.length - 1 ];
	const transition = `${ getModeLabel( latestChange.from ) } → ${ getModeLabel( latestChange.to ) }`;
	const changeSummary = changes.length === 1
		? sprintf(
			/* translators: 1: privacy mode transition, 2: transition date */
			__( 'This range includes a privacy change from %1$s on %2$s.', 'primeplaced-logless-analytics' ),
			transition,
			formatChangedAt( latestChange.changed_at )
		)
		: sprintf(
			/* translators: 1: number of changes, 2: latest transition date */
			__( 'This range includes %1$d privacy changes; the latest was recorded on %2$s.', 'primeplaced-logless-analytics' ),
			changes.length,
			formatChangedAt( latestChange.changed_at )
		);

	return (
		<Notice className="ppla-privacy-range-notice" status="warning" isDismissible={false}>
			<strong>{__( 'Privacy settings changed during this range.', 'primeplaced-logless-analytics' )}</strong>{' '}
			{changeSummary}{' '}
			{__( 'The change affects future tracking only; existing rows were not rewritten. Compare session-based rates and journeys with care.', 'primeplaced-logless-analytics' )}{' '}
			<ul className="ppla-privacy-range-notice__changes">
				{changes.map( ( change ) => (
					<li key={`${ change.changed_at }-${ change.from }-${ change.to }`}>
						<strong>{`${ getModeLabel( change.from ) } → ${ getModeLabel( change.to ) }`}</strong>{' '}
						<time dateTime={change.changed_at}>{formatChangedAt( change.changed_at )}</time>
					</li>
				) )}
			</ul>{' '}
			<Button variant="link" onClick={openPrivacySettings}>
				{__( 'Review privacy settings', 'primeplaced-logless-analytics' )}
			</Button>
		</Notice>
	);
};
