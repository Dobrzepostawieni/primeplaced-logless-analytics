/**
 * WordPress dependencies
 */
import { createRoot } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';

/**
 * Internal dependencies
 */
import { App } from './App';

domReady( () => {
	const rootNode = document.getElementById( 'ppla-admin-root' );

	if ( ! rootNode ) {
		return;
	}

	createRoot( rootNode ).render( <App /> );
} );