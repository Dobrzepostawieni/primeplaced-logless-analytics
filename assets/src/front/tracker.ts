/**
 * Frontend Tracker with Failover Routing and Auto-Events.
 *
 * @package
 */
import type {
	CustomEventConfig,
	EventEnvelope,
	PplaFrontData,
} from '@shared/types';

export interface TrackingPayload {
	hit_id?: string;
	url: string;
	referrer: string;
	record_pageview: boolean;
	events?: TrackingEvent[];
	device_hint?: string;
}

export type TrackingEvent = Omit<EventEnvelope, 'contract_version'>;

type PplaConfig = PplaFrontData;

const isFeatureEnabled = (
	config: PplaConfig,
	key: string,
	defaultValue = false
): boolean => {
	const value = config.event_features?.features?.[key];
	return typeof value === 'boolean' ? value : defaultValue;
};

const getMaxEventsPerHit = (config: PplaConfig): number => {
	const value = config.event_features?.max_events_per_hit;
	return typeof value === 'number' && value > 0 ? value : 10;
};

const createTrackingId = (): string => {
	if (typeof window.crypto?.randomUUID === 'function') {
		return window.crypto.randomUUID();
	}

	if (typeof window.crypto?.getRandomValues === 'function') {
		const bytes = window.crypto.getRandomValues(new Uint8Array(16));
		return Array.from(bytes, (byte) =>
			byte.toString(16).padStart(2, '0')
		).join('');
	}

	const randomPart = Math.random().toString(36).slice(2);
	return `${Date.now().toString(36)}_${randomPart}_${randomPart}`.slice(
		0,
		64
	);
};

/**
 * Detects modern iPads that request desktop sites by checking touch capabilities and macOS user agent.
 */
export const getDeviceHint = (): string => {
	try {
		if (
			navigator.maxTouchPoints > 0 &&
			/Macintosh/i.test(navigator.userAgent)
		) {
			return 'tablet';
		}
	} catch (e) {}
	return '';
};

/**
 * Safely resolves the current URL, Referrer, and detects iframe contexts.
 */
export const getPageContext = (): {
	url: string;
	referrer: string;
	isIframe: boolean;
} => {
	let url = window.location.href;
	let referrer = document.referrer || '';
	let isIframe = false;

	try {
		if (window.self !== window.top) {
			isIframe = true;
		}
	} catch (e) {
		// Cross-origin iframe security restrictions might block window.top access.
		isIframe = true;
	}

	if (isIframe) {
		// Explicitly prefix the path to guarantee visibility in the "Top Pages" report.
		// Since mid-session hits cannot alter the session's primary referrer without
		// corrupting data, this ensures the iframe load is properly logged and easily identifiable.
		url = '/iframe' + window.location.pathname;
		// Clear the referrer to avoid self-referencing loops.
		referrer = '';
	}

	return { url, referrer, isIframe };
};

/**
 * Initializes the tracking sequence.
 */
export const initTracker = (): void => {
	const config = window.pplaFrontendData as PplaConfig | undefined;

	if (!config) {
		return;
	}

	const context = getPageContext();

	// A "not found" response is reported only as a navigation event, so missing
	// URLs never inflate pageviews, visits or the list of observed pages.
	const payload: TrackingPayload = {
		url: context.url,
		referrer: context.referrer,
		record_pageview: !config.is_404,
		device_hint: getDeviceHint(),
	};

	const automaticEvents: TrackingEvent[] = [];

	if (config.is_404 && isFeatureEnabled(config, 'four_oh_four', true)) {
		automaticEvents.push({
			type: 'navigation.not_found',
			subject: { kind: 'path', key: window.location.pathname },
		});
	}

	if (context.isIframe && isFeatureEnabled(config, 'iframe_views', true)) {
		automaticEvents.push({
			type: 'embed.iframe.viewed',
			subject: { kind: 'path', key: window.location.pathname },
		});
	}

	if (automaticEvents.length > 0) {
		payload.events = automaticEvents.slice(0, getMaxEventsPerHit(config));
	}

	void sendTrackingData(config, payload);

	initAutoEventTrackers(config);
	initCustomEventTrackers(config);
	initCustomEventSdk(config);
};

const normalizeCustomEventName = (eventName: unknown): string => {
	if (typeof eventName !== 'string') {
		return '';
	}

	const normalized = eventName
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');

	return /^[a-z][a-z0-9_]{0,79}$/.test(normalized) ? normalized : '';
};

const isConfiguredCustomEvent = (
	config: PplaConfig,
	eventName: string
): boolean => {
	const events = config.event_features?.custom_events?.events;

	return (
		Array.isArray(events) &&
		events.some(
			(event: CustomEventConfig) =>
				event.is_active && event.event_name === eventName
		)
	);
};

const trackCustomEvent = (
	config: PplaConfig,
	eventName: unknown,
	value = 0
): void => {
	const name = normalizeCustomEventName(eventName);

	if (!name || !isConfiguredCustomEvent(config, name)) {
		return;
	}

	const context = getPageContext();
	const amount =
		typeof value === 'number' && Number.isFinite(value) ? value : 0;

	void sendTrackingData(config, {
		url: context.url,
		referrer: context.referrer,
		record_pageview: false,
		device_hint: getDeviceHint(),
		events: [
			{
				type: `custom_event.${name}`,
				source: { channel: 'browser', provider_id: 'custom' },
				subject: { kind: 'custom', key: name },
				metrics: { amount },
			},
		],
	});
};

const initCustomEventTrackers = (config: PplaConfig): void => {
	const events = config.event_features?.custom_events?.events;

	if (!Array.isArray(events)) {
		return;
	}

	events.forEach((event: CustomEventConfig) => {
		if (
			!event.is_active ||
			event.trigger_type === 'custom' ||
			!event.css_selector
		) {
			return;
		}

		try {
			document.querySelectorAll(event.css_selector).forEach((element) => {
				element.addEventListener(event.trigger_type, () => {
					trackCustomEvent(config, event.event_name);
				});
			});
		} catch {
			// An invalid administrator-supplied selector must not interrupt page tracking.
		}
	});
};

const initCustomEventSdk = (config: PplaConfig): void => {
	const track = (eventName: string, value = 0): void => {
		trackCustomEvent(config, eventName, value);
	};

	const existingPpla =
		typeof window.ppla === 'function' ? window.ppla : undefined;
	window.ppla = existingPpla
		? (command: 'track', eventName: string, value = 0): void => {
				if (
					isConfiguredCustomEvent(
						config,
						normalizeCustomEventName(eventName)
					)
				) {
					track(eventName, value);
					return;
				}

				existingPpla(command, eventName, value);
			}
		: (command: 'track', eventName: string, value = 0): void => {
				if (command === 'track') {
					track(eventName, value);
				}
			};
};

/**
 * Configures event listeners for automated tracking metrics.
 */
const initAutoEventTrackers = (config: PplaConfig): void => {
	const canTrackOutbound = isFeatureEnabled(config, 'outbound_links', true);
	const canTrackDownloads = isFeatureEnabled(config, 'file_downloads', true);

	if (
		(!config.track_outbound_links || !canTrackOutbound) &&
		(!config.track_file_downloads || !canTrackDownloads)
	) {
		return;
	}

	const fileExtensions = /\.(pdf|zip|rar|docx|xlsx|pptx|mp3|mp4)$/i;
	const currentHostname = window.location.hostname;

	document.addEventListener('click', (e) => {
		const target = e.target as HTMLElement;
		const link = target.closest('a');

		if (!link || !link.href) {
			return;
		}

		try {
			const linkUrl = new URL(link.href);
			const isExternal =
				linkUrl.hostname !== currentHostname &&
				linkUrl.protocol.startsWith('http');
			const isFile = fileExtensions.test(linkUrl.pathname);

			const events: NonNullable<TrackingPayload['events']> = [];

			if (
				canTrackOutbound &&
				config.track_outbound_links &&
				isExternal &&
				!isFile
			) {
				events.push({
					type: 'navigation.outbound.clicked',
					subject: { kind: 'host', key: linkUrl.hostname },
				});
			}

			if (canTrackDownloads && config.track_file_downloads && isFile) {
				const fileName = linkUrl.pathname.split('/').pop() || 'unknown';
				events.push({
					type: 'asset.downloaded',
					subject: { kind: 'asset', key: fileName },
				});
			}

			if (events.length > 0) {
				const context = getPageContext();
				const eventPayload: TrackingPayload = {
					url: context.url,
					referrer: context.referrer,
					record_pageview: false,
					events: events.slice(0, getMaxEventsPerHit(config)),
					device_hint: getDeviceHint(),
				};

				void sendTrackingData(config, eventPayload);
			}
		} catch (err) {
			// Ignore parsing errors for javascript:void(0) or mailto: links
		}
	});
};

/**
 * Dispatches tracking data based on the configured routing mode.
 *
 * @param config  The plugin's frontend configuration data.
 * @param payload The tracking data payload.
 */
export const sendTrackingData = async (
	config: PplaConfig,
	payload: TrackingPayload
): Promise<void> => {
	const mode = config.tracking_mode || 'failover';
	const occurredAt = new Date().toISOString();
	const trackingPayload: TrackingPayload = {
		...payload,
		hit_id: payload.hit_id || createTrackingId(),
		events: payload.events?.map((event) => ({
			...event,
			event_id: event.event_id || createTrackingId(),
			occurred_at: event.occurred_at || occurredAt,
		})),
	};

	const ajaxUrl = config.admin_ajax_url;

	const buildFallbackBody = (): URLSearchParams => {
		const formData = new URLSearchParams();
		formData.append('action', 'ppla_track_hit');
		formData.append('hit_id', trackingPayload.hit_id || '');
		formData.append('url', trackingPayload.url);
		formData.append('referrer', trackingPayload.referrer);
		formData.append(
			'record_pageview',
			trackingPayload.record_pageview ? '1' : '0'
		);

		if (trackingPayload.device_hint) {
			formData.append('device_hint', trackingPayload.device_hint);
		}

		if (trackingPayload.events && trackingPayload.events.length > 0) {
			formData.append('events', JSON.stringify(trackingPayload.events));
		}

		return formData;
	};

	const fireRest = async (): Promise<void> => {
		const response = await fetch(`${config.rest_url}/track`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(trackingPayload),
			keepalive: true,
		});

		if (!response.ok) {
			throw new Error('REST API failed');
		}
	};

	const fireAjax = async (): Promise<void> => {
		const response = await fetch(ajaxUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: buildFallbackBody().toString(),
			keepalive: true,
		});

		if (!response.ok) {
			throw new Error('AJAX fallback failed');
		}
	};

	const fireBeacon = (): void => {
		if (typeof navigator.sendBeacon !== 'function') {
			return;
		}

		navigator.sendBeacon(ajaxUrl, buildFallbackBody());
	};

	// 1. Beacon POST Only Mode
	if (mode === 'beacon') {
		fireBeacon();
		return;
	}

	// 2. REST API Only Mode
	if (mode === 'rest') {
		try {
			await fireRest();
		} catch (error) {
			// Fail silently
		}
		return;
	}

	// 3. Failover Cascading Mode
	try {
		await fireRest();
	} catch (restError) {
		try {
			await fireAjax();
		} catch (ajaxError) {
			fireBeacon();
		}
	}
};
