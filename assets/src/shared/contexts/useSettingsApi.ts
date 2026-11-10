/**
 * Settings API Hook.
 * Manages application settings state and communicates with the REST API.
 *
 * @package
 */
import {
	useState,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from '@wordpress/element';
import { useNotices, type NoticeKey } from '@shared/components/Notices';
import { useApi } from '@shared/api/useApi';
import type { AppSettings, SettingsUpdatePayload } from './types';

/**
 *
 */
export function useSettingsApi() {
	const { notify } = useNotices();
	const { fetchApi, hasFatalError } = useApi();
	const [settings, setSettings] = useState<AppSettings | null>(null);
	const [originalSettings, setOriginalSettings] = useState<AppSettings | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const isFetchingRef = useRef(false);
	const settingsRef = useRef<AppSettings | null>(null);
	const originalSettingsRef = useRef<AppSettings | null>(null);
	const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
	const latestWriteIdRef = useRef(0);
	const pendingWritesRef = useRef(0);
	const visibleWritesRef = useRef(0);

	const enqueueWrite = useCallback(<T,>(write: () => Promise<T>): Promise<T> => {
		const queuedWrite = writeQueueRef.current.then(write, write);
		writeQueueRef.current = queuedWrite.then(
			() => undefined,
			() => undefined
		);
		return queuedWrite;
	}, []);

	const beginWrite = useCallback((showSavingState: boolean) => {
		pendingWritesRef.current += 1;
		if (showSavingState) {
			visibleWritesRef.current += 1;
			setIsSaving(true);
		}
	}, []);

	const endWrite = useCallback((showSavingState: boolean) => {
		pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
		if (showSavingState) {
			visibleWritesRef.current = Math.max(0, visibleWritesRef.current - 1);
			if (visibleWritesRef.current === 0) {
				setIsSaving(false);
			}
		}
	}, []);

	const isDirty = useMemo(() => {
		if (!settings || !originalSettings) return false;
		return JSON.stringify(settings) !== JSON.stringify(originalSettings);
	}, [settings, originalSettings]);

	const isDirtyRef = useRef(isDirty);

	useEffect(() => {
		isDirtyRef.current = isDirty;
	}, [isDirty]);

	useEffect(() => {
		if (!isDirty) return;

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	}, [isDirty]);

	const fetchSettings = useCallback(
		async (silent: boolean = false) => {
			if (hasFatalError.current || isFetchingRef.current) return;
			isFetchingRef.current = true;
			if (!silent) setIsLoading(true);

			try {
				const fetchedData = await fetchApi<AppSettings>({
					path: `/ppla/v1/settings?t=${Date.now()}`,
				});

				const cleanData = structuredClone(fetchedData);
				settingsRef.current = cleanData;
				originalSettingsRef.current = cleanData;
				setSettings(cleanData);
				setOriginalSettings(cleanData);
			} catch (error) {
				if (!hasFatalError.current && !silent) {
					notify('SETTINGS_FETCH_ERROR');
				}
			} finally {
				isFetchingRef.current = false;
				if (!silent) setIsLoading(false);
			}
		},
		[fetchApi, hasFatalError, notify]
	);

	/**
	 * Adopts a saved server response without discarding other local edits:
	 * a key the user changed locally keeps its value unless that exact value
	 * was the one just written.
	 */
	const applySavedSettings = useCallback(
		(saved: AppSettings, payload: SettingsUpdatePayload) => {
			const local = settingsRef.current;
			const previous = originalSettingsRef.current;
			const next = { ...saved } as Record<string, unknown>;

			if (local && previous) {
				const written = payload as Record<string, unknown>;
				for (const [key, value] of Object.entries(local)) {
					const baseline =
						key in written
							? written[key]
							: (previous as Record<string, unknown>)[key];
					if (JSON.stringify(value) !== JSON.stringify(baseline)) {
						next[key] = value;
					}
				}
			}

			settingsRef.current = next as AppSettings;
			originalSettingsRef.current = saved;
			setSettings(next as AppSettings);
			setOriginalSettings(saved);
		},
		[]
	);

	const saveSettings = useCallback(
		async (
			newData: SettingsUpdatePayload,
			notice: NoticeKey | false = 'SETTINGS_SAVE_SUCCESS',
			silent: boolean = false
		) => {
			if (hasFatalError.current) return false;

			const writeId = ++latestWriteIdRef.current;
			beginWrite(!silent);

			try {
				const responseData = await enqueueWrite(() =>
					fetchApi<AppSettings>({
						path: '/ppla/v1/settings',
						method: 'POST',
						data: newData,
					})
				);

				const cleanData = structuredClone(responseData);
				if (writeId === latestWriteIdRef.current) {
					applySavedSettings(cleanData, newData);
				}

				if (notice !== false && !silent) notify(notice);
				return true;
			} catch (error) {
				if (!hasFatalError.current && !silent) {
					notify('SETTINGS_SAVE_ERROR');
				}
				if (writeId === latestWriteIdRef.current) {
					await fetchSettings(true);
				}
				return false;
			} finally {
				endWrite(!silent);
			}
		},
		[
			applySavedSettings,
			beginWrite,
			endWrite,
			enqueueWrite,
			fetchApi,
			hasFatalError,
			notify,
			fetchSettings,
		]
	);

	const autosaveSettings = useCallback(
		async (partial: SettingsUpdatePayload) => {
			if (hasFatalError.current) return false;

			const writeId = ++latestWriteIdRef.current;
			if (settingsRef.current) {
				const optimisticSettings = {
					...settingsRef.current,
					...partial,
				} as AppSettings;
				settingsRef.current = optimisticSettings;
				setSettings(optimisticSettings);
			}
			beginWrite(true);

			try {
				const responseData = await enqueueWrite(() =>
					fetchApi<AppSettings>({
						path: '/ppla/v1/settings',
						method: 'POST',
						data: partial,
					})
				);

				const cleanData = structuredClone(responseData);
				if (writeId === latestWriteIdRef.current) {
					applySavedSettings(cleanData, partial);
				}
				return true;
			} catch (error) {
				if (!hasFatalError.current) {
					notify('SETTINGS_SAVE_ERROR');
				}
				if (writeId === latestWriteIdRef.current) {
					await fetchSettings(true);
				}
				return false;
			} finally {
				endWrite(true);
			}
		},
		[
			applySavedSettings,
			beginWrite,
			endWrite,
			enqueueWrite,
			fetchApi,
			fetchSettings,
			hasFatalError,
			notify,
		]
	);

	useEffect(() => {
		let lastFetchTime = 0;
		const onFocus = () => {
			const now = Date.now();
			if (
				pendingWritesRef.current === 0 &&
				!isDirtyRef.current &&
				now - lastFetchTime > 10000
			) {
				lastFetchTime = now;
				void fetchSettings(true);
			}
		};

		window.addEventListener('focus', onFocus);
		return () => window.removeEventListener('focus', onFocus);
	}, [fetchSettings]);

	useEffect(() => {
		void fetchSettings();
	}, [fetchSettings]);

	const updateLocal = useCallback((partial: SettingsUpdatePayload) => {
		setSettings((prev) => {
			const next = prev ? ({ ...prev, ...partial } as AppSettings) : prev;
			settingsRef.current = next;
			return next;
		});
	}, []);

	const discard = useCallback(() => {
		if (originalSettings) {
			const restoredSettings = structuredClone(originalSettings);
			settingsRef.current = restoredSettings;
			setSettings(restoredSettings);
		} else {
			void fetchSettings();
		}
	}, [originalSettings, fetchSettings]);

	return {
		settings,
		isLoading,
		isSaving,
		isDirty,
		updateLocal,
		autosaveSettings,
		saveSettings,
		fetchSettings,
		discard,
	};
}
