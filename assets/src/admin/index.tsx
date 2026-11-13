/**
 * WordPress dependencies
 */
import { createRoot } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';

/**
 * Internal dependencies
 */
import { App } from './App';
import { mountPricingHero } from './mountPricingHero';

domReady( () => {
	const rootNode = document.getElementById( 'ppla-admin-root' );

	if ( ! rootNode ) {
		// The same bundle loads on the Freemius pricing page, which has no app root.
		mountPricingHero();
		return;
	}

	createRoot( rootNode ).render( <App /> );
} );