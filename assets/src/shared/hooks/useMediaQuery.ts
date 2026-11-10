import { useState, useEffect } from '@wordpress/element';

/**
 * Hook to detect viewport matching a specific media query.
 *
 * @param query CSS media query string (e.g., '(max-width: 782px)')
 * @return boolean True if viewport matches the query
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState<boolean>(() => {
		if (typeof window !== 'undefined') {
			return window.matchMedia(query).matches;
		}
		return false;
	});

	useEffect(() => {
		if (typeof window === 'undefined') return;

		const mediaQueryList = window.matchMedia(query);

		if (mediaQueryList.matches !== matches) {
			setMatches(mediaQueryList.matches);
		}

		const documentChangeHandler = (event: MediaQueryListEvent) => {
			setMatches(event.matches);
		};

		if (mediaQueryList.addEventListener) {
			mediaQueryList.addEventListener('change', documentChangeHandler);
		} else {
			mediaQueryList.addListener(documentChangeHandler);
		}

		return () => {
			if (mediaQueryList.removeEventListener) {
				mediaQueryList.removeEventListener(
					'change',
					documentChangeHandler
				);
			} else {
				mediaQueryList.removeListener(documentChangeHandler);
			}
		};
	}, [query, matches]);

	return matches;
}
