import { useState, useCallback, useEffect, useRef } from '@wordpress/element';
import { isEventVisible } from '@shared/utils/eventLabels';
import { useApi } from '@shared/api/useApi';
import { useAppState } from '@shared/contexts';
import type { EventsApiResponse, EventStat } from './types';
import type { PrivacyModeHistoryEntry } from '@shared/types';

// The report aggregates by event type and provider, so it stays small. The
// table loads every row once and filters, sorts, pages and exports locally;
// column filters then apply to the whole report rather than one server page.
const PAGE_SIZE = 100;

export const useEventsTable = ( range: number ) => {
	const { fetchApi } = useApi();
	const { dataRefreshKey } = useAppState();

	const [ isLoading, setIsLoading ] = useState<boolean>( true );
	const [ data, setData ] = useState<EventStat[]>( [] );
	const [ hasError, setHasError ] = useState<boolean>( false );
	const [ measurementReason, setMeasurementReason ] = useState( 'no_data_yet' );
	const [ privacyChanges, setPrivacyChanges ] = useState<PrivacyModeHistoryEntry[]>( [] );

	const requestIdRef = useRef( 0 );
	const isMountedRef = useRef( true );

	useEffect( () => {
		isMountedRef.current = true;

		return () => {
			isMountedRef.current = false;
			requestIdRef.current += 1;
		};
	}, [] );

	const fetchPage = useCallback( async ( page: number ): Promise<EventsApiResponse & { events: NonNullable<EventsApiResponse[ 'events' ]> }> => {
		const params = new URLSearchParams( {
			range: range.toString(),
			page: page.toString(),
			per_page: PAGE_SIZE.toString(),
			orderby: 'total_events',
			order: 'desc',
		} );

		const response = await fetchApi<EventsApiResponse>( {
			path: `/ppla/v1/dashboard/events?${params.toString()}`,
			method: 'GET',
		} );

		const events = response?.events;
		if ( ! response?.success || ! events || ! Array.isArray( events.items ) ) {
			throw new Error( 'The Events report response was unsuccessful.' );
		}

		return { ...response, events };
	}, [ fetchApi, range ] );

	const loadReport = useCallback( async () => {
		const requestId = requestIdRef.current + 1;
		requestIdRef.current = requestId;

		if ( ! isMountedRef.current ) {
			return;
		}

		setIsLoading( true );

		try {
			const first = await fetchPage( 1 );
			const items = [ ...first.events.items ];
			const pageCount = Math.ceil( first.events.total_items / PAGE_SIZE );
			for ( let page = 2; page <= pageCount; page++ ) {
				const next = await fetchPage( page );
				if ( next.events.items.length === 0 ) {
					break;
				}
				items.push( ...next.events.items );
			}

			if ( requestId !== requestIdRef.current || ! isMountedRef.current ) {
				return;
			}

			setMeasurementReason( first.measurement_reason || 'data_current' );
			setPrivacyChanges( Array.isArray( first.privacy_changes ) ? first.privacy_changes : [] );
			setData(
				items
					.filter( ( item ) => isEventVisible( item.event_type ) )
					.map( ( item ) => ( {
						...item,
						id: `event-${ item.event_type }-${ item.provider_id }`,
					} ) ) as EventStat[]
			);
			setHasError( false );
		} catch ( error ) {
			if ( requestId !== requestIdRef.current || ! isMountedRef.current ) {
				return;
			}

			// Keep the previous rows visible while the report can be retried.
			setHasError( true );
		} finally {
			if ( requestId === requestIdRef.current && isMountedRef.current ) {
				setIsLoading( false );
			}
		}
	}, [ fetchPage ] );

	useEffect( () => {
		void loadReport();
	}, [ dataRefreshKey, loadReport ] );

	return {
		isLoading,
		hasError,
		measurementReason,
		privacyChanges,
		data,
		retry: loadReport,
	};
};
