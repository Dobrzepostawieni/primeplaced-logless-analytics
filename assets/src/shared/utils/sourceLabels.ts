import { __ } from '@wordpress/i18n';

/** Keeps source labels human-readable without changing the stored value. */
export const getSourceLabel = ( value: string ): string => {
	const source = value.trim();

	if ( ! source || source.toLowerCase() === 'direct' ) {
		return __( 'Direct', 'primeplaced-logless-analytics' );
	}

	return source;
};
