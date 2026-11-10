/**
 * Server-backed report view state shared by the admin application.
 *
 * @package
 */
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import type { ReactNode } from 'react';

import { useApi } from '@shared/api/useApi';
import type {
	ReportPreference,
	ReportPreferenceInput,
	SavedReportView,
	SavedReportViewInput,
	SavedViewAuthor,
	SavedViewVisibility,
} from './types';

type SavedViewsLoadState = 'loading' | 'ready' | 'error';

interface SavedViewApiResponse {
	id: string;
	storage_key: string;
	name: string;
	range_days: number;
	table_state: string | null;
	query_state: string | null;
	visibility: SavedViewVisibility;
	author: SavedViewAuthor;
	can_edit: boolean;
	can_delete: boolean;
	created_at: string;
	updated_at: string;
}

interface SavedViewsResponse {
	views: SavedViewApiResponse[];
}

interface ReportPreferenceApiResponse {
	range: number;
	table_state: string | null;
	query_state: string | null;
	updated_at: string;
}

interface ReportPreferencesResponse {
	preferences: Record<string, ReportPreferenceApiResponse>;
}

interface SavedViewResponse {
	view: SavedViewApiResponse;
}

interface ReportPreferenceResponse {
	preference: ReportPreferenceApiResponse;
}

interface SavedViewsContextValue {
	loadState: SavedViewsLoadState;
	viewsByStorageKey: Record<string, SavedReportView[]>;
	viewLoadStates: Record<string, SavedViewsLoadState>;
	preferences: Record<string, ReportPreference>;
	claimInitialPreferenceHydration: (storageKey: string) => boolean;
	/** True when the user changed the report before its preference arrived. */
	hasChangedBeforeHydration: (storageKey: string) => boolean;
	/** Records a report's range so a pre-hydration range change is noticed. */
	noteRangeBeforeHydration: (storageKey: string, range: number) => void;
	refresh: (storageKey?: string) => Promise<void>;
	/** Fetches a report's saved views once; remounts reuse the loaded list. */
	loadViews: (storageKey: string) => void;
	createView: (input: SavedReportViewInput) => Promise<SavedReportView>;
	updateView: (id: string, input: SavedReportViewInput) => Promise<SavedReportView>;
	deleteView: (id: string) => Promise<void>;
	savePreference: (
		storageKey: string,
		input: ReportPreferenceInput
	) => Promise<ReportPreference>;
}

const SAVED_VIEWS_CONTEXT_KEY = 'pplaSavedViewsContext_v1';

type SavedViewsContextRegistry = Record<string, unknown>;

/**
 * Shares the context instance between the Core bundle and Pro async chunks.
 *
 * Webpack can include this module once in the Core bundle and once in a Pro
 * chunk. Keeping the context on window means a Pro report always consumes the
 * provider mounted by the Core application.
 */
const getSavedViewsContext = (): React.Context<
	SavedViewsContextValue | undefined
> => {
	const registry = window as unknown as SavedViewsContextRegistry;

	if (!registry[SAVED_VIEWS_CONTEXT_KEY]) {
		registry[SAVED_VIEWS_CONTEXT_KEY] = createContext<
			SavedViewsContextValue | undefined
		>(undefined);
	}

	return registry[
		SAVED_VIEWS_CONTEXT_KEY
	] as React.Context<SavedViewsContextValue | undefined>;
};

const SavedViewsContext = getSavedViewsContext();

const mapPreference = (
	preference: ReportPreferenceApiResponse
): ReportPreference => ({
	range: preference.range,
	tableState: preference.table_state,
	queryState: preference.query_state,
	updatedAt: preference.updated_at,
});

const mapView = (view: SavedViewApiResponse): SavedReportView => ({
	id: view.id,
	storageKey: view.storage_key,
	name: view.name,
	range: view.range_days,
	tableState: view.table_state,
	queryState: view.query_state,
	visibility: view.visibility,
	author: view.author,
	canEdit: view.can_edit,
	canDelete: view.can_delete,
	createdAt: view.created_at,
	updatedAt: view.updated_at,
});

const toApiInput = (input: SavedReportViewInput) => ({
	storage_key: input.storageKey,
	name: input.name,
	range_days: input.range,
	table_state: input.tableState ?? '',
	query_state: input.queryState ?? '',
	visibility: input.visibility,
});

export const SavedViewsProvider = ({
	children,
}: {
	children: ReactNode;
}): JSX.Element => {
	const { fetchApi } = useApi();
	const [loadState, setLoadState] = useState<SavedViewsLoadState>('loading');
	const [viewsByStorageKey, setViewsByStorageKey] = useState<
		Record<string, SavedReportView[]>
	>({});
	const [viewLoadStates, setViewLoadStates] = useState<
		Record<string, SavedViewsLoadState>
	>({});
	const [preferences, setPreferences] = useState<
		Record<string, ReportPreference>
	>({});
	const hydratedPreferenceStorageKeysRef = useRef(new Set<string>());
	const requestedViewKeysRef = useRef(new Set<string>());
	const preferencesRef = useRef(preferences);
	preferencesRef.current = preferences;
	const claimInitialPreferenceHydration = useCallback(
		(storageKey: string): boolean => {
			if (hydratedPreferenceStorageKeysRef.current.has(storageKey)) {
				return false;
			}

			hydratedPreferenceStorageKeysRef.current.add(storageKey);
			return true;
		},
		[]
	);

	// Preferences load asynchronously. Anything the user changes before they
	// arrive must win, or a late response silently resets their report.
	// DataTable announces user actions explicitly; report queries announce
	// only explicit changes; ranges are compared with their first value.
	const changedBeforeHydrationRef = useRef(new Set<string>());
	const rangeBaselinesRef = useRef(new Map<string, number>());

	useEffect(() => {
		const markChanged = (event: Event): void => {
			const storageKey = (event as CustomEvent<{ storageKey?: unknown }>).detail?.storageKey;
			if (
				typeof storageKey === 'string' &&
				storageKey !== '' &&
				!hydratedPreferenceStorageKeysRef.current.has(storageKey)
			) {
				changedBeforeHydrationRef.current.add(storageKey);
			}
		};

		window.addEventListener('ppla:table-interaction', markChanged);
		window.addEventListener('ppla:report-query-changed', markChanged);

		return () => {
			window.removeEventListener('ppla:table-interaction', markChanged);
			window.removeEventListener('ppla:report-query-changed', markChanged);
		};
	}, []);

	const hasChangedBeforeHydration = useCallback(
		(storageKey: string): boolean =>
			changedBeforeHydrationRef.current.has(storageKey),
		[]
	);

	const noteRangeBeforeHydration = useCallback(
		(storageKey: string, range: number): void => {
			if (hydratedPreferenceStorageKeysRef.current.has(storageKey)) {
				return;
			}

			const baseline = rangeBaselinesRef.current.get(storageKey);
			if (baseline === undefined) {
				rangeBaselinesRef.current.set(storageKey, range);
			} else if (baseline !== range) {
				changedBeforeHydrationRef.current.add(storageKey);
			}
		},
		[]
	);

	const refresh = useCallback(async (storageKey?: string): Promise<void> => {
		if (storageKey) {
			setViewLoadStates((current) => ({
				...current,
				[storageKey]: 'loading',
			}));

			try {
				const savedViewsResponse = await fetchApi<SavedViewsResponse>({
					path: `/ppla/v1/saved-views?storage_key=${encodeURIComponent(storageKey)}`,
					method: 'GET',
				});

				setViewsByStorageKey((current) => ({
					...current,
					[storageKey]: (savedViewsResponse.views || []).map(mapView),
				}));
				setViewLoadStates((current) => ({
					...current,
					[storageKey]: 'ready',
				}));
			} catch {
				// Allow the next mount to retry a failed request.
				requestedViewKeysRef.current.delete(storageKey);
				setViewLoadStates((current) => ({
					...current,
					[storageKey]: 'error',
				}));
			}

			return;
		}

		setLoadState('loading');

		try {
			const preferencesResponse = await fetchApi<ReportPreferencesResponse>({
				path: '/ppla/v1/report-preferences',
				method: 'GET',
			});

			setPreferences(
				Object.fromEntries(
					Object.entries(preferencesResponse.preferences || {}).map(
						([preferenceStorageKey, preference]) => [
							preferenceStorageKey,
							mapPreference(preference),
						]
					)
				)
			);
			setLoadState('ready');
		} catch {
			setLoadState('error');
		}
	}, [fetchApi]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const loadViews = useCallback(
		(storageKey: string): void => {
			if (requestedViewKeysRef.current.has(storageKey)) {
				return;
			}

			requestedViewKeysRef.current.add(storageKey);
			void refresh(storageKey);
		},
		[refresh]
	);

	const createView = useCallback(
		async (input: SavedReportViewInput): Promise<SavedReportView> => {
			const response = await fetchApi<SavedViewResponse>({
				path: '/ppla/v1/saved-views',
				method: 'POST',
				data: toApiInput(input),
			});
			const view = mapView(response.view);

			setViewsByStorageKey((current) => ({
				...current,
				[input.storageKey]: [
					view,
					...(current[input.storageKey] || []).filter(
						(savedView) => savedView.id !== view.id
					),
				],
			}));

			return view;
		},
		[fetchApi]
	);

	const updateView = useCallback(
		async (
			id: string,
			input: SavedReportViewInput
		): Promise<SavedReportView> => {
			const response = await fetchApi<SavedViewResponse>({
				path: `/ppla/v1/saved-views/${id}`,
				method: 'PUT',
				data: toApiInput(input),
			});
			const view = mapView(response.view);

			setViewsByStorageKey((current) => {
				const next = Object.fromEntries(
					Object.entries(current).map(([key, savedViews]) => [
						key,
						savedViews.filter((savedView) => savedView.id !== id),
					])
				) as Record<string, SavedReportView[]>;

				if (current[view.storageKey]) {
					next[view.storageKey] = [view, ...next[view.storageKey]];
				}

				return next;
			});

			return view;
		},
		[fetchApi]
	);

	const deleteView = useCallback(
		async (id: string): Promise<void> => {
			await fetchApi<{ deleted: boolean }>({
				path: `/ppla/v1/saved-views/${id}`,
				method: 'DELETE',
			});
			setViewsByStorageKey((current) =>
				Object.fromEntries(
					Object.entries(current).map(([key, savedViews]) => [
						key,
						savedViews.filter((savedView) => savedView.id !== id),
					])
				) as Record<string, SavedReportView[]>
			);
		},
		[fetchApi]
	);

	const savePreference = useCallback(
		async (
			storageKey: string,
			input: ReportPreferenceInput
		): Promise<ReportPreference> => {
			// Opening a report must not write anything when its state is unchanged.
			const stored = preferencesRef.current[storageKey];
			if (
				stored &&
				stored.range === input.range &&
				(stored.tableState || null) === (input.tableState || null) &&
				(stored.queryState || null) === (input.queryState || null)
			) {
				return stored;
			}

			const response = await fetchApi<ReportPreferenceResponse>({
				path: `/ppla/v1/report-preferences/${storageKey}`,
				method: 'PUT',
				data: {
					range: input.range,
					table_state: input.tableState ?? '',
					query_state: input.queryState ?? '',
				},
			});
			const preference = mapPreference(response.preference);

			setPreferences((current) => ({
				...current,
				[storageKey]: preference,
			}));

			return preference;
		},
		[fetchApi]
	);

	const value = useMemo<SavedViewsContextValue>(
		() => ({
			loadState,
			viewsByStorageKey,
			viewLoadStates,
			preferences,
			claimInitialPreferenceHydration,
			hasChangedBeforeHydration,
			noteRangeBeforeHydration,
			refresh,
			loadViews,
			createView,
			updateView,
			deleteView,
			savePreference,
		}),
		[
			claimInitialPreferenceHydration,
			hasChangedBeforeHydration,
			noteRangeBeforeHydration,
			createView,
			deleteView,
			loadState,
			loadViews,
			preferences,
			refresh,
			savePreference,
			updateView,
			viewLoadStates,
			viewsByStorageKey,
		]
	);

	return (
		<SavedViewsContext.Provider value={value}>
			{children}
		</SavedViewsContext.Provider>
	);
};

export const useSavedViewsStore = (): SavedViewsContextValue => {
	const context = useContext(SavedViewsContext);

	if (!context) {
		throw new Error(
			'useSavedViewsStore must be used within SavedViewsProvider'
		);
	}

	return context;
};
