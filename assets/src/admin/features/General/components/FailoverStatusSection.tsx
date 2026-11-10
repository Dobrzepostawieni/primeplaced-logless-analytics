/**
 * Failover Status Section Component.
 * Handles async live diagnostics for tracking channels without polluting telemetry.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useRef, useEffect, useState } from '@wordpress/element';
import { CardBody, CardHeader, Card } from '@wordpress/components';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import { cn } from '@shared/utils/formatting';
import { useSettingsStateContext } from '@shared/contexts';

type StatusState = 'checking' | 'active' | 'ready' | 'blocked' | 'bypassed';

const getFallbackStatus = (
	isPrimaryWorking: boolean,
	isCurrentWorking: boolean
): StatusState => {
	if (!isCurrentWorking) {
		return 'blocked';
	}

	return isPrimaryWorking ? 'ready' : 'active';
};

export const FailoverStatusSection = ({
	title,
	spyRef,
	isActive,
	className,
}: StickySectionProps): JSX.Element => {
	const cardRef = useRef<HTMLDivElement>(null);
	const { settings } = useSettingsStateContext();
	const trackingMode = settings?.tracking_mode || 'failover';

	const [ restStatus, setRestStatus ] = useState<StatusState>('checking');
	const [ ajaxStatus, setAjaxStatus ] = useState<StatusState>('checking');
	const [ beaconStatus, setBeaconStatus ] = useState<StatusState>('checking');

	useEffect(() => {
		if ( spyRef && cardRef.current ) {
			spyRef( cardRef.current );
		}
	}, [ spyRef ] );

	useEffect(() => {
		const runDiagnostics = async () => {
			const adminConfig = window.pplaAdminData;
			
			if ( ! adminConfig?.rest_url || ! adminConfig.admin_ajax_url ) {
				setRestStatus('blocked');
				setAjaxStatus('blocked');
				setBeaconStatus('blocked');
				return;
			}

			let isRestWorking = false;
			let isAjaxWorking = false;
			let isBeaconAvailable = false;

			// 1. Ping REST API
			try {
				const restResponse = await fetch(`${adminConfig.rest_url}/track`, {
					method: 'POST',
					credentials: 'same-origin',
					headers: {
						'Content-Type': 'application/json',
						'X-PPLA-Diagnostic': 'true',
						'X-WP-Nonce': adminConfig.nonce || '',
					},
					body: JSON.stringify( { hit_id: 'ppla-diagnostic-0001', url: window.location.href, referrer: '', record_pageview: false } ),
				});
				if ( restResponse.status === 201 ) {
					isRestWorking = true;
				}
			} catch ( e ) {}

			// 2. Ping Admin AJAX
			try {
				const formData = new URLSearchParams();
				formData.append('action', 'ppla_track_hit');
				formData.append('is_diagnostic', '1');
				formData.append('_wpnonce', adminConfig.nonce || '');
				const ajaxResponse = await fetch(adminConfig.admin_ajax_url, {
					method: 'POST',
					credentials: 'same-origin',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: formData.toString(),
				});
				if ( ajaxResponse.ok ) {
					isAjaxWorking = true;
				}
			} catch ( e ) {}

			// Beacon uses the same POST endpoint as AJAX, so verify browser support and route availability.
			isBeaconAvailable = typeof navigator.sendBeacon === 'function' && isAjaxWorking;

			if (trackingMode === 'beacon') {
				setRestStatus('bypassed');
				setAjaxStatus('bypassed');
				setBeaconStatus(isBeaconAvailable ? 'active' : 'blocked');
			} else if (trackingMode === 'rest') {
				setRestStatus(isRestWorking ? 'active' : 'blocked');
				setAjaxStatus('bypassed');
				setBeaconStatus('bypassed');
			} else {
				setRestStatus(isRestWorking ? 'active' : 'blocked');
				setAjaxStatus(getFallbackStatus(isRestWorking, isAjaxWorking));
				setBeaconStatus(
					getFallbackStatus(
						isRestWorking || isAjaxWorking,
						isBeaconAvailable
					)
				);
			}
		};

		void runDiagnostics();
	}, [ trackingMode ] );

	const getStatusClass = ( status: StatusState ): string => {
		if ( status === 'active' ) return 'is-active';
		if ( status === 'blocked' ) return 'is-blocked';
		if ( status === 'ready' ) return 'is-ready';
		if ( status === 'bypassed' ) return 'is-bypassed';
		return 'is-checking';
	};

	const getStatusLabel = ( status: StatusState ): string => {
		if ( status === 'checking' ) return __('Checking route…', 'primeplaced-logless-analytics');
		if ( status === 'blocked' ) return __('Route blocked / unavailable', 'primeplaced-logless-analytics');
		if ( status === 'ready' ) return __('Standby fallback ready', 'primeplaced-logless-analytics');
		if ( status === 'bypassed' ) return __('Disabled by settings', 'primeplaced-logless-analytics');
		return __('Working', 'primeplaced-logless-analytics');
	};

	return (
		<Card
			className={cn(
				'ppla-settings-card',
				className,
				isActive && 'ppla-is-active'
			)}
			ref={cardRef}
		>
			<CardHeader className="ppla-settings-card-header">
				<h2>{title}</h2>
			</CardHeader>
			<CardBody className="ppla-settings-card-body">
				<div className="ppla-failover-flow">
					
					<div className={cn('ppla-failover-box', getStatusClass(restStatus))}>
						<div className="ppla-failover-indicator" />
						<strong className="ppla-failover-title">REST API</strong>
						<span className="ppla-failover-desc">
							{getStatusLabel(restStatus)}
						</span>
					</div>
					
					<div className="ppla-failover-arrow">→</div>
					
					<div className={cn('ppla-failover-box', getStatusClass(ajaxStatus))}>
						<div className="ppla-failover-indicator" />
						<strong className="ppla-failover-title">Admin AJAX</strong>
						<span className="ppla-failover-desc">
							{getStatusLabel(ajaxStatus)}
						</span>
					</div>
					
					<div className="ppla-failover-arrow">→</div>
					
					<div className={cn('ppla-failover-box', getStatusClass(beaconStatus))}>
						<div className="ppla-failover-indicator" />
						<strong className="ppla-failover-title">Beacon POST</strong>
						<span className="ppla-failover-desc">
							{getStatusLabel(beaconStatus)}
						</span>
					</div>

				</div>
			</CardBody>
		</Card>
	);
};
