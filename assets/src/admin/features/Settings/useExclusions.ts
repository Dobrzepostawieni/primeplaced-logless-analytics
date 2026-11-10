/**
 * Exclusions Hook.
 * Handles IP validation, URL mapping, and suggestions for TokenFields.
 *
 * @package
 */
import { useState, useCallback, useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { useSettingsDispatch, useSettingsStateContext } from '@shared/contexts';
import { useApi } from '@shared/api/useApi';

const isValidIP = ( ip: string ): boolean => {
	const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
	const ipv6 = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
	return ipv4.test( ip ) || ipv6.test( ip );
};

type ApiError = {
	code?: unknown;
	message?: unknown;
	data?: {
		message?: unknown;
	};
};

const getApiErrorMessage = ( error: unknown ): string => {
	if ( ! error || typeof error !== 'object' ) {
		return '';
	}

	const apiError = error as ApiError;
	if ( typeof apiError.message === 'string' && apiError.message ) {
		return apiError.message;
	}

	if ( typeof apiError.data?.message === 'string' && apiError.data.message ) {
		return apiError.data.message;
	}

	return '';
};

export const useExclusions = () => {
	const { updateSettings, refetch } = useSettingsDispatch();
	const { settings } = useSettingsStateContext();
	const { fetchApi } = useApi();

	const [ ipError, setIpError ] = useState<string | null>( null );
	const [ currentIpStatus, setCurrentIpStatus ] = useState<string | null>( null );
	const [ isExcludingCurrentIp, setIsExcludingCurrentIp ] = useState( false );
	const [ urlSuggestions, setUrlSuggestions ] = useState<string[]>( [] );

	const excludedIps = settings?.excluded_ips || [];
	const excludedUrls = settings?.excluded_urls || [];

	// Fetch native WordPress pages to use as URL suggestions.
	useEffect( () => {
		let isMounted = true;

		const loadSuggestions = async () => {
			try {
				const pages = await fetchApi<{ link: string }[]>( {
					path: '/wp/v2/pages?per_page=50&_fields=link',
					method: 'GET',
				} );

				if ( isMounted && Array.isArray( pages ) ) {
					const paths = pages.map( ( page ) => {
						try {
							return new URL( page.link ).pathname;
						} catch ( e ) {
							return '';
						}
					} ).filter( Boolean );

					paths.unshift( '/' );

					setUrlSuggestions( Array.from( new Set( paths ) ) );
				}
			} catch ( error ) {
				if ( isMounted ) {
					setUrlSuggestions( [ '/' ] );
				}
			}
		};

		void loadSuggestions();

		return () => {
			isMounted = false;
		};
	}, [ fetchApi ] );

	const handleIpChange = useCallback( ( tokens: ( string | { value: string } )[] ) => {
		const normalized = tokens
			.map( ( t ) => ( typeof t === 'string' ? t.trim() : t.value.trim() ) )
			.filter( Boolean );

		const valid = normalized.filter( isValidIP );
		const invalid = normalized.filter( ( ip ) => ! isValidIP( ip ) );

		if ( invalid.length > 0 ) {
			setIpError(
				sprintf(
					/* translators: %s: Comma separated invalid IPs */
					__( 'Rejected invalid IP address: %s', 'primeplaced-logless-analytics' ),
					invalid.join( ', ' )
				)
			);
		} else {
			setIpError( null );
		}

		const uniqueValid = Array.from( new Set( valid ) );
		updateSettings( { excluded_ips: uniqueValid } );
	}, [ updateSettings ] );

	const handleUrlChange = useCallback( ( tokens: ( string | { value: string } )[] ) => {
		const normalized = tokens
			.map( ( t ) => ( typeof t === 'string' ? t.trim() : t.value.trim() ) )
			.filter( Boolean );

		const uniqueUrls = Array.from( new Set( normalized ) );
		updateSettings( { excluded_urls: uniqueUrls } );
	}, [ updateSettings ] );

	const excludeCurrentIp = useCallback( async () => {
		setIsExcludingCurrentIp( true );
		setCurrentIpStatus( null );

		try {
			const response = await fetchApi<{ success?: boolean; message?: string }>( {
				path: '/ppla/v1/settings/exclude-current-ip',
				method: 'POST',
			} );

			if ( response?.success ) {
				setCurrentIpStatus( response.message || __( 'Your current address is now excluded from analytics.', 'primeplaced-logless-analytics' ) );
				await refetch();
				return;
			}

			setCurrentIpStatus( response?.message || __( 'A public address could not be excluded for this request.', 'primeplaced-logless-analytics' ) );
		} catch ( error ) {
			setCurrentIpStatus( getApiErrorMessage( error ) || __( 'A public address could not be excluded for this request.', 'primeplaced-logless-analytics' ) );
		} finally {
			setIsExcludingCurrentIp( false );
		}
	}, [ fetchApi, refetch ] );

	return {
		excludedIps,
		excludedUrls,
		ipError,
		currentIpStatus,
		isExcludingCurrentIp,
		urlSuggestions,
		handleIpChange,
		handleUrlChange,
		excludeCurrentIp,
	};
};
