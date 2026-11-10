/**
 * Declarative interval hook for React.
 * Safely handles React component lifecycle and state closures.
 *
 * @package
 */
import { useEffect, useRef } from '@wordpress/element';

/**
 * Executes a callback at a specified interval.
 *
 * @param callback The function to execute.
 * @param delay    The interval delay in milliseconds, or null to pause.
 */
export function useInterval( callback: () => void, delay: number | null ): void {
	const savedCallback = useRef( callback );

	// Remember the latest callback if it changes.
	useEffect( () => {
		savedCallback.current = callback;
	}, [ callback ] );

	// Set up the interval.
	useEffect( () => {
		// Don't schedule if no delay is specified.
		if ( delay === null ) {
			return;
		}

		const id = setInterval( () => savedCallback.current(), delay );

		return () => clearInterval( id );
	}, [ delay ] );
}