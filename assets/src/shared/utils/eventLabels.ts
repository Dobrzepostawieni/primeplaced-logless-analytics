import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';

const eventLabels: Record<string, string> = {
	'form.viewed': __( 'Form shown', 'primeplaced-logless-analytics' ),
	'form.started': __( 'Form started', 'primeplaced-logless-analytics' ),
	'form.submitted': __( 'Form submitted', 'primeplaced-logless-analytics' ),
	'form.submission_failed': __( 'Form submission failed', 'primeplaced-logless-analytics' ),
	'goal.completed': __( 'Goal completed', 'primeplaced-logless-analytics' ),
	'commerce.order.completed': __( 'Order completed', 'primeplaced-logless-analytics' ),
	'commerce.checkout.started': __( 'Checkout started', 'primeplaced-logless-analytics' ),
	'commerce.cart.item_added': __( 'Cart item added', 'primeplaced-logless-analytics' ),
	'commerce.cart.abandoned': __( 'Cart abandoned', 'primeplaced-logless-analytics' ),
	'commerce.order.refunded': __( 'Order refunded', 'primeplaced-logless-analytics' ),
	'asset.downloaded': __( 'File downloaded', 'primeplaced-logless-analytics' ),
	'navigation.outbound.clicked': __( 'Outbound link clicked', 'primeplaced-logless-analytics' ),
	'navigation.not_found': __( '404 page viewed', 'primeplaced-logless-analytics' ),
	'engagement.scroll_depth.reached': __( 'Scroll threshold reached', 'primeplaced-logless-analytics' ),
};

/** Returns a human-readable event label while preserving the canonical ID elsewhere. */
export const getEventLabel = ( eventType: string ): string => {
	let fallback: string;

	if ( eventLabels[ eventType ] ) {
		fallback = eventLabels[ eventType ];
	} else if ( eventType.startsWith( 'custom_event.' ) ) {
		fallback = `${ __( 'Custom event', 'primeplaced-logless-analytics' ) }: ${ eventType.replace( 'custom_event.', '' ).replace( /_/g, ' ' ) }`;
	} else {
		const readable = eventType
			.split( '.' )
			.pop()
			?.replace( /_/g, ' ' )
			.replace( /\b\w/g, ( character ) => character.toUpperCase() );

		fallback = readable || __( 'Observed event', 'primeplaced-logless-analytics' );
	}

	const filtered = applyFilters( 'ppla.ui.EventLabel', fallback, eventType );

	return typeof filtered === 'string' && filtered.trim() ? filtered : fallback;
};

/** Returns whether an event should be shown in Core event surfaces. */
export const isEventVisible = ( eventType: string ): boolean => {
	const filtered = applyFilters( 'ppla.ui.EventVisibility', true, eventType );

	return typeof filtered === 'boolean' ? filtered : true;
};
