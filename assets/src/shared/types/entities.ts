/**
 * Core Entities Foundation.
 * Base types and environment data injected from PHP.
 */

export type Plans = string;

export type ScriptPosition = 'head' | 'footer';

export type TrackingMode = 'failover' | 'rest' | 'beacon';

export type MeasurementStatus = 'waiting' | 'processing' | 'ready' | 'attention' | 'stale' | 'excluded' | 'error';

export interface MeasurementMeta {
	measurement_status?: MeasurementStatus | string;
	measurement_reason?: string;
	measurement_viewer_excluded?: boolean;
	measurement_pending_hits?: number;
	privacy_mode?: 'strict_anonymous' | 'session_hash' | string;
	privacy_changes?: PrivacyModeHistoryEntry[];
}

export type ScrollDepthUnit = '%' | 'px';

export interface ScrollDepthThreshold {
	unit: ScrollDepthUnit;
	value: number;
	label: string;
}

export interface FormTrackingConfig {
	providers: string[];
	events: string[];
}

export interface CommerceValueFilter {
	operator: 'any' | 'gt' | 'lt' | 'eq' | 'between';
	amount?: number;
	min?: number;
	max?: number;
}

export type CommerceProfileStatus = 'active' | 'waiting_for_currency' | 'needs_configuration';

export interface CommerceTrackingProfile {
	provider: string;
	currency: string;
	status: CommerceProfileStatus;
	events: string[];
	abandonment_window_minutes?: number;
	value_rule: CommerceValueFilter;
}

export type GoalTrigger = 'click' | 'submit' | 'event';

export type GoalValueMode = 'fixed' | 'event_amount';

export interface GoalConfig {
	id: string;
	name: string;
	trigger: GoalTrigger;
	selector?: string;
	value: number;
	event_type?: string;
	provider_id?: string;
	value_mode?: GoalValueMode;
}

export interface GoalTrackingConfig {
	goals: GoalConfig[];
}

export type VisualInteractionKind = 'click' | 'submit' | 'scroll_percent' | 'element_visible';

export interface VisualInteractionRule {
	id: string;
	name: string;
	page_path: string;
	kind: VisualInteractionKind;
	selector?: string;
	thresholds?: number[];
	event_type: string;
	is_active: boolean;
}

export interface VisualInteractionsConfig {
	rules: VisualInteractionRule[];
}

export type CustomEventTrigger = 'click' | 'submit' | 'custom';
export interface CustomEventConfig { id: string; event_name: string; trigger_type: CustomEventTrigger; css_selector: string; is_active: boolean; }
export interface CustomEventTrackingConfig { events: CustomEventConfig[]; }

export interface EventFeatureFlags {
	pageviews?: boolean;
	four_oh_four?: boolean;
	iframe_views?: boolean;
	outbound_links?: boolean;
	file_downloads?: boolean;
	scroll_depth?: boolean;
	form_tracking?: boolean;
	goal_tracking?: boolean;
	page_heatmap?: boolean;
	[key: string]: boolean | undefined;
}

export interface EventFeaturePolicy {
	plan: Plans;
	tier: Plans;
	max_events_per_hit: number;
	features: EventFeatureFlags;
	scroll_depth_thresholds?: ScrollDepthThreshold[];
	form_tracking?: FormTrackingConfig;
	goal_tracking?: GoalTrackingConfig;
	visual_interactions?: VisualInteractionsConfig;
	custom_events?: CustomEventTrackingConfig;
}

/** Stable internal tracking envelope shared by all browser producers. */
export interface EventEnvelope {
	contract_version: 1;
	event_id?: string;
	type: string;
	occurred_at?: string;
	source?: {
		channel: 'browser' | 'server' | 'integration';
		provider_id?: string;
	};
	subject?: {
		kind?: string;
		key?: string;
	};
	metrics?: {
		amount?: number;
		currency?: string;
		quantity?: number;
	};
	attributes?: Record<string, string | number | boolean>;
}

/**
 * Base properties shared across all React apps (Frontend & Admin).
 */
export interface PplaBaseData {
	rest_url: string;
	admin_ajax_url: string;
	active_plan: Plans;
	event_features?: EventFeaturePolicy;
}

/**
 * Read-only environment data injected strictly for Frontend tracking.
 */
export interface PplaFrontendData extends PplaBaseData {
	tracking_mode?: TrackingMode;
	track_outbound_links?: boolean;
	track_file_downloads?: boolean;
	is_404?: boolean;
}

/**
 * Read-only environment data injected strictly for the Admin dashboard.
 */
export interface PplaAdminData extends PplaBaseData {
	nonce: string;
	can_manage_settings: boolean;
	is_premium: boolean;
	has_fs_error: boolean;
	site_url?: string;
	geo_map_url?: string;
	form_plugins?: string[];
	commerce_plugins?: string[];
	commerce_provider_currencies?: Record<string, string>;
	available_analytics_roles?: AnalyticsRoleOption[];
	white_label?: { name: string; logo_url: string };
}

export interface AnalyticsRoleOption {
	value: string;
	label: string;
	tier: 'basic' | 'business' | 'agency' | string;
}

export interface Settings {
	script_position?: ScriptPosition;
	tracking_mode?: TrackingMode;
	track_404?: boolean;
	filter_bots?: boolean;
	ignore_admins?: boolean;
	ignore_editors?: boolean;
	ignore_authors?: boolean;
	excluded_ips?: string[];
	excluded_urls?: string[];
	strict_anonymous_mode?: boolean;
	privacy_history?: PrivacyModeHistoryEntry[];
	trust_proxy_headers?: boolean;
	data_retention?: number;
	track_outbound_links?: boolean;
	track_file_downloads?: boolean;
	track_scroll_depth?: boolean;
	scroll_depth_thresholds?: string[];
	track_form_submissions?: boolean;
	form_tracking_providers?: string[];
	form_tracking_events?: string[];
	track_ecommerce_events?: boolean;
	track_goals?: boolean;
	commerce_tracking_profiles?: CommerceTrackingProfile[];
	track_site_search?: boolean;
	role_permissions_enabled?: boolean;
	analytics_role_permissions?: string[];
	white_label_enabled?: boolean;
	white_label_name?: string;
	white_label_logo_url?: string;
	custom_goals?: GoalConfig[];
	visual_interaction_rules?: VisualInteractionRule[];
	report_email_enabled?: boolean;
	report_email_recipients?: string[];
	report_email_day?: string;
	report_email_time?: string;
	report_email_subject?: string;
	report_email_message?: string;
	report_pdf_template?: string;
	report_pdf_sections?: string[];
	report_pdf_rows_per_section?: number;
	report_pdf_hide_empty_sections?: boolean;
	report_pdf_branding_enabled?: boolean;
	report_pdf_title?: string;
	report_pdf_accent_color?: string;
	report_pdf_footer_note?: string;
	[key: string]: unknown;
}

export interface PrivacyModeHistoryEntry {
	from: 'strict_anonymous' | 'session_hash';
	to: 'strict_anonymous' | 'session_hash';
	changed_at: string;
}
