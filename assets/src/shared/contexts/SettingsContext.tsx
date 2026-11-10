import {
	createContext,
	useContext,
	useMemo,
	useEffect,
	useState,
	useCallback,
} from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import { useSettingsApi } from '@shared/contexts/useSettingsApi';
import type {
	AppStateValue,
	AppDispatchValue,
	SettingsStateValue,
	SettingsDispatchValue,
} from './types';
import type { PplaData } from '@shared/types';

const APP_STATE_KEY = 'pplaAppStateContext_v1';
const APP_DISPATCH_KEY = 'pplaAppDispatchContext_v1';
const SETTINGS_STATE_KEY = 'pplaSettingsStateContext_v1';
const SETTINGS_DISPATCH_KEY = 'pplaSettingsDispatchContext_v1';

type ContextRegistry = Record<string, unknown>;

const getRegistry = (): ContextRegistry => window as unknown as ContextRegistry;

const getOrCreateContext = <T,>(key: string) => {
	const registry = getRegistry();

	if (!registry[key]) {
		registry[key] = createContext<T | undefined>(undefined);
	}

	return registry[key] as React.Context<T | undefined>;
};

const AppStateContext =
	getOrCreateContext<AppStateValue>(APP_STATE_KEY);
const AppDispatchContext =
	getOrCreateContext<AppDispatchValue>(APP_DISPATCH_KEY);
const SettingsStateContext =
	getOrCreateContext<SettingsStateValue>(SETTINGS_STATE_KEY);
const SettingsDispatchContext =
	getOrCreateContext<SettingsDispatchValue>(SETTINGS_DISPATCH_KEY);

export const useAppState = () => {
	const context = useContext(AppStateContext) as AppStateValue | undefined;
	if (!context) throw new Error('useAppState must be used within an AppProvider');
	return context;
};

export const useAppDispatch = () => {
	const context = useContext(AppDispatchContext) as AppDispatchValue | undefined;
	if (!context) throw new Error('useAppDispatch must be used within an AppProvider');
	return context;
};

export const useSettingsStateContext = () => {
	const context = useContext(SettingsStateContext) as SettingsStateValue | undefined;
	if (!context) throw new Error('useSettingsStateContext must be used within a SettingsProvider');
	return context;
};

export const useSettingsDispatch = () => {
	const context = useContext(SettingsDispatchContext) as SettingsDispatchValue | undefined;
	if (!context) throw new Error('useSettingsDispatch must be used within a SettingsProvider');
	return context;
};

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
	const pplaData: PplaData = window.pplaAdminData || {
		rest_url: '',
		admin_ajax_url: '',
		nonce: '',
		active_plan: 'free',
		can_manage_settings: false,
		is_premium: false,
		has_fs_error: false,
	};
	const [proLoaded, setProLoaded] = useState<boolean>(false);
	const [dataRefreshKey, setDataRefreshKey] = useState<number>(0);

	const triggerDataRefresh = useCallback(() => {
		setDataRefreshKey((prev) => prev + 1);
	}, []);

	useEffect(() => {
		const loadModules = async () => {
			try {
				const loadExtensions = applyFilters(
					'ppla.admin.load_extensions',
					null,
					pplaData
				) as (() => Promise<void>) | null;

				if (loadExtensions) {
					await loadExtensions();
				}
				setProLoaded(true);
			} catch (error: unknown) {
				if (
					!error ||
					typeof error !== 'object' ||
					!('name' in error) ||
					error.name !== 'ChunkLoadError'
				) {
					// eslint-disable-next-line no-console
					console.error('PPLA: Failed to load modules', error);
				}
				setProLoaded(true);
			}
		};

		void loadModules();
	}, []);

	const stateValue = useMemo<AppStateValue>(
		() => ({
			pplaData,
			proLoaded,
			dataRefreshKey,
		}),
		[pplaData, proLoaded, dataRefreshKey]
	);

	const dispatchValue = useMemo<AppDispatchValue>(
		() => ({
			triggerDataRefresh,
		}),
		[triggerDataRefresh]
	);

	return (
		<AppDispatchContext.Provider value={dispatchValue}>
			<AppStateContext.Provider value={stateValue}>
				{children}
			</AppStateContext.Provider>
		</AppDispatchContext.Provider>
	);
};

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
	const {
		settings,
		isLoading,
		isSaving,
		isDirty,
		updateLocal,
		autosaveSettings,
		saveSettings,
		fetchSettings,
		discard,
	} = useSettingsApi();

	const stateValue = useMemo<SettingsStateValue>(
		() => ({
			settings,
			isLoading,
			isSaving,
			isDirty,
		}),
		[settings, isLoading, isSaving, isDirty]
	);

	const dispatchValue = useMemo<SettingsDispatchValue>(
		() => ({
			updateSettings: updateLocal,
			autosaveSettings,
			saveSettings,
			refetch: fetchSettings,
			discard,
		}),
		[updateLocal, autosaveSettings, saveSettings, fetchSettings, discard]
	);

	return (
		<SettingsDispatchContext.Provider value={dispatchValue}>
			<SettingsStateContext.Provider value={stateValue}>
				{children}
			</SettingsStateContext.Provider>
		</SettingsDispatchContext.Provider>
	);
};
