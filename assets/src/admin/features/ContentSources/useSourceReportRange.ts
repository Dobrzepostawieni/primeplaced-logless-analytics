/**
 * Independent date-range state for a Sources report.
 *
 * Each table owns its range so a report can be compared or exported without
 * changing the period used by neighbouring Sources reports.
 *
 * @package
 */
import { useCallback, useEffect, useState } from '@wordpress/element';
import { normalizeReportRange } from '@admin/features/Reports/reportNavigation';

const DEFAULT_RANGE = 30;
const VALID_RANGES = [7, 30, 90];
const getRangeStorageKey = ( rangeQuery: string ): string => `ppla_preference_${ rangeQuery }`;

const readRangeFromUrl = ( rangeQuery: string ): number => {
	if ( typeof window === 'undefined' ) {
		return DEFAULT_RANGE;
	}

	const params = new URLSearchParams( window.location.search );
	let storedRange: string | null = null;
	try {
		storedRange = window.localStorage.getItem( getRangeStorageKey( rangeQuery ) );
	} catch ( error ) {
		// The range can still use its default when browser storage is unavailable.
	}

	return params.has( rangeQuery )
		? normalizeReportRange( params.get( rangeQuery ), DEFAULT_RANGE )
		: normalizeReportRange( storedRange, DEFAULT_RANGE );
};

const readExplicitRangeFromUrl = (rangeQuery: string): number | undefined => {
	if (typeof window === 'undefined') return undefined;

	const params = new URLSearchParams(window.location.search);
	if (!params.has(rangeQuery)) return undefined;

	const value = Number(params.get(rangeQuery));
	return VALID_RANGES.includes(value) ? value : undefined;
};

export const useSourceReportRange = ( rangeQuery: string ) => {
	const [initialUrlRange] = useState<number | undefined>(() =>
		readExplicitRangeFromUrl(rangeQuery)
	);
	const [ range, setRangeState ] = useState<number>( () =>
		readRangeFromUrl( rangeQuery )
	);

	useEffect( () => {
		const handlePopState = () => {
			setRangeState( readRangeFromUrl( rangeQuery ) );
		};

		window.addEventListener( 'popstate', handlePopState );

		return () => window.removeEventListener( 'popstate', handlePopState );
	}, [ rangeQuery ] );

	const setRange = useCallback(
		( nextRange: number ) => {
			const normalizedRange = normalizeReportRange( nextRange, DEFAULT_RANGE );

			setRangeState( normalizedRange );

			try {
				window.localStorage.setItem( getRangeStorageKey( rangeQuery ), normalizedRange.toString() );
			} catch ( error ) {
				// The current session can keep the selected range when browser storage is unavailable.
			}

			const url = new URL( window.location.href );
			url.searchParams.set( rangeQuery, normalizedRange.toString() );
			window.history.replaceState( window.history.state, '', url );
		},
		[ rangeQuery ]
	);

	return { range, setRange, initialUrlRange };
};
