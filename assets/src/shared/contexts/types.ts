import type { AppSettings, PplaData } from '@shared/types';
import type { NoticeKey } from '@shared/components/Notices';

export type { AppSettings };

export type SettingsUpdatePayload = Partial<AppSettings>;

export interface AppStateValue {
	pplaData: PplaData;
	proLoaded: boolean;
	dataRefreshKey: number;
}

export interface AppDispatchValue {
	triggerDataRefresh: () => void;
}

export interface SettingsStateValue {
	settings: AppSettings | null;
	isLoading: boolean;
	isSaving: boolean;
	isDirty: boolean;
}

export interface SettingsDispatchValue {
	updateSettings: (partial: SettingsUpdatePayload) => void;
	autosaveSettings: (partial: SettingsUpdatePayload) => Promise<boolean>;
	saveSettings: (
		newData: SettingsUpdatePayload,
		notice?: NoticeKey | false
	) => Promise<boolean>;
	refetch: () => Promise<void>;
	discard: () => void;
}
