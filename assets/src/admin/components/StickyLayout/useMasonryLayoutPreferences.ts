import { useCallback, useEffect, useMemo, useState } from '@wordpress/element';

import type {
	StickyLayoutPreferences,
	StickyLayoutSectionSize,
	StickySectionDef,
} from './types';

const STORAGE_VERSION = 1;
const SIZE_CLASS_MAP: Record<StickyLayoutSectionSize, string> = {
	standard: 'ppla-masonry-standard',
	wide: 'ppla-masonry-wide',
	full: 'ppla-masonry-full',
};

interface StoredPreferences extends StickyLayoutPreferences {
	version?: number;
}

interface UseMasonryLayoutPreferencesArgs {
	enabled: boolean;
	sections: StickySectionDef[];
	storageKey?: string;
}

const getStorageKey = ( storageKey?: string ): string | null => (
	storageKey ? `ppla_masonry_layout_${storageKey}` : null
);

const getDefaultSize = ( section: StickySectionDef ): StickyLayoutSectionSize => {
	const className = section.layoutClassName || '';

	if ( className.includes( 'ppla-masonry-full' ) ) {
		return 'full';
	}

	if ( className.includes( 'ppla-masonry-wide' ) ) {
		return 'wide';
	}

	return 'standard';
};

const stripSizeClasses = ( className = '' ): string => (
	className
		.split( /\s+/ )
		.filter( Boolean )
		.filter( ( value ) => ! Object.values( SIZE_CLASS_MAP ).includes( value ) )
		.join( ' ' )
);

const normalizePreferences = (
	sections: StickySectionDef[],
	preferences?: Partial<StickyLayoutPreferences>
): StickyLayoutPreferences => {
	const sectionIds = sections.map( ( section ) => section.id );
	const knownIds = new Set( sectionIds );
	const order = [
		...( preferences?.order || [] ).filter( ( id ) => knownIds.has( id ) ),
		...sectionIds.filter( ( id ) => ! preferences?.order?.includes( id ) ),
	];
	const sizes: Record<string, StickyLayoutSectionSize> = {};

	sections.forEach( ( section ) => {
		const storedSize = preferences?.sizes?.[section.id];
		sizes[section.id] = storedSize && storedSize in SIZE_CLASS_MAP
			? storedSize
			: getDefaultSize( section );
	} );

	return {
		order,
		sizes,
	};
};

const loadPreferences = (
	sections: StickySectionDef[],
	storageKey?: string
): StickyLayoutPreferences => {
	const key = getStorageKey( storageKey );

	if ( ! key || typeof window === 'undefined' ) {
		return normalizePreferences( sections );
	}

	try {
		const stored = window.localStorage.getItem( key );
		const parsed = stored ? JSON.parse( stored ) as StoredPreferences : null;

		return normalizePreferences( sections, parsed || undefined );
	} catch ( error ) {
		return normalizePreferences( sections );
	}
};

const savePreferences = (
	storageKey: string | undefined,
	preferences: StickyLayoutPreferences
): void => {
	const key = getStorageKey( storageKey );

	if ( ! key || typeof window === 'undefined' ) {
		return;
	}

	window.localStorage.setItem(
		key,
		JSON.stringify( {
			version: STORAGE_VERSION,
			...preferences,
		} )
	);
};

const reorderItems = ( order: string[], sourceId: string, targetId: string ): string[] => {
	if ( sourceId === targetId ) {
		return order;
	}

	const nextOrder = order.filter( ( id ) => id !== sourceId );
	const targetIndex = nextOrder.indexOf( targetId );

	if ( targetIndex === -1 ) {
		return order;
	}

	nextOrder.splice( targetIndex, 0, sourceId );

	return nextOrder;
};

export const useMasonryLayoutPreferences = ( {
	enabled,
	sections,
	storageKey,
}: UseMasonryLayoutPreferencesArgs ) => {
	const [preferences, setPreferences] = useState<StickyLayoutPreferences>(
		() => loadPreferences( sections, storageKey )
	);

	useEffect( () => {
		setPreferences( ( current ) => normalizePreferences( sections, current ) );
	}, [sections] );

	useEffect( () => {
		if ( enabled ) {
			savePreferences( storageKey, preferences );
		}
	}, [enabled, preferences, storageKey] );

	const orderedSections = useMemo( () => {
		if ( ! enabled ) {
			return sections;
		}

		const sectionMap = new Map( sections.map( ( section ) => [ section.id, section ] ) );

		return preferences.order
			.map( ( id ) => sectionMap.get( id ) )
			.filter( ( section ): section is StickySectionDef => !! section );
	}, [enabled, preferences.order, sections] );

	const getSectionLayoutClassName = useCallback(
		( section: StickySectionDef ) => {
			if ( ! enabled ) {
				return section.layoutClassName;
			}

			const size = preferences.sizes[section.id] || getDefaultSize( section );

			return [
				stripSizeClasses( section.layoutClassName ),
				SIZE_CLASS_MAP[size],
			].filter( Boolean ).join( ' ' );
		},
		[enabled, preferences.sizes]
	);

	const setSectionSize = useCallback(
		( sectionId: string, size: StickyLayoutSectionSize ) => {
			setPreferences( ( current ) => ( {
				...current,
				sizes: {
					...current.sizes,
					[sectionId]: size,
				},
			} ) );
		},
		[]
	);

	const moveSection = useCallback(
		( sourceId: string, targetId: string ) => {
			setPreferences( ( current ) => ( {
				...current,
				order: reorderItems( current.order, sourceId, targetId ),
			} ) );
		},
		[]
	);

	const moveSectionByOffset = useCallback(
		( sectionId: string, offset: number ) => {
			setPreferences( ( current ) => {
				const currentIndex = current.order.indexOf( sectionId );
				const nextIndex = Math.max( 0, Math.min( current.order.length - 1, currentIndex + offset ) );

				if ( currentIndex === -1 || currentIndex === nextIndex ) {
					return current;
				}

				const nextOrder = [...current.order];
				nextOrder.splice( currentIndex, 1 );
				nextOrder.splice( nextIndex, 0, sectionId );

				return {
					...current,
					order: nextOrder,
				};
			} );
		},
		[]
	);

	const resetLayout = useCallback(
		() => setPreferences( normalizePreferences( sections ) ),
		[sections]
	);

	return {
		orderedSections,
		preferences,
		getSectionLayoutClassName,
		setSectionSize,
		moveSection,
		moveSectionByOffset,
		resetLayout,
	};
};
