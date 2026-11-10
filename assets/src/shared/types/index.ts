import type { PplaFrontendData, PplaAdminData, Settings } from './entities';

export type PplaFrontData = PplaFrontendData;
export type PplaData = PplaAdminData;
/**
 * Unified type for all possible settings data objects.
 */
export type AppSettings = Settings;
export type {
	PplaFrontendData,
	PplaAdminData,
	AnalyticsRoleOption,
	Settings,
	ScriptPosition,
	TrackingMode,
	EventFeatureFlags,
	EventFeaturePolicy,
	EventEnvelope,
	CommerceValueFilter,
	CommerceTrackingProfile,
	CommerceProfileStatus,
	GoalConfig,
	GoalTrackingConfig,
	GoalTrigger,
	GoalValueMode,
	VisualInteractionKind,
	VisualInteractionRule,
	VisualInteractionsConfig,
	CustomEventConfig,
	CustomEventTrigger,
	CustomEventTrackingConfig,
	PrivacyModeHistoryEntry,
	MeasurementMeta,
	MeasurementStatus,
} from './entities';
