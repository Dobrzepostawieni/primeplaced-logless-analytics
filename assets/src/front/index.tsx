/**
 * Internal dependencies
 */
import { initTracker } from './tracker';

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', initTracker );
} else {
	initTracker();
}