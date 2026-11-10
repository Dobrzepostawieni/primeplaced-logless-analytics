import { __ } from '@wordpress/i18n';

/** Returns the translated name of a stored device type. */
export const getDeviceLabel = ( value: string ): string => {
	switch ( value.trim().toLowerCase() ) {
		case 'mobile':
			return __( 'Mobile', 'primeplaced-logless-analytics' );
		case 'tablet':
			return __( 'Tablet', 'primeplaced-logless-analytics' );
		default:
			return __( 'Desktop', 'primeplaced-logless-analytics' );
	}
};
