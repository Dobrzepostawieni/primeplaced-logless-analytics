/**
 * Buffer Status Section Component.
 * Displays buffered hit queue metrics and background cron status.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useState, useCallback, useEffect, useRef } from '@wordpress/element';
import { Button, Card, CardHeader, CardBody, Notice } from '@wordpress/components';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import { useApi } from '@shared/api/useApi';
import { useInterval } from '@shared/hooks/useInterval';
import { useAppState } from '@shared/contexts';
import { cn } from '@shared/utils/formatting';
import { formatNumber } from '@shared/utils/numberFormat';

interface BufferStatusData {
	events_count: number;
	time_to_next: number;
	cron_active: boolean;
	buffer_kb: number;
}

export const BufferStatusSection = ({
	title,
	spyRef,
	isActive,
	className,
}: StickySectionProps): JSX.Element => {
	const { fetchApi } = useApi();
	const { dataRefreshKey } = useAppState();
	const cardRef = useRef<HTMLDivElement>(null);
	const [status, setStatus] = useState<BufferStatusData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [hasError, setHasError] = useState(false);
	const hasLoadedRef = useRef(false);

	useEffect(() => {
		if (spyRef && cardRef.current) {
			spyRef(cardRef.current);
		}
	}, [spyRef]);

	const loadBufferStatus = useCallback(async () => {
		if (hasLoadedRef.current) {
			setIsRefreshing(true);
		} else {
			setIsLoading(true);
		}

		try {
			const data = await fetchApi<BufferStatusData>({
				path: '/ppla/v1/tools/buffer-status',
				method: 'GET',
			});

			if (data && typeof data.events_count === 'number' && typeof data.time_to_next === 'number' && typeof data.cron_active === 'boolean' && typeof data.buffer_kb === 'number') {
				setStatus(data);
				hasLoadedRef.current = true;
				setHasError(false);
			} else {
				throw new Error('Invalid buffer status response');
			}
		} catch {
			setHasError(true);
		} finally {
			setIsLoading(false);
			setIsRefreshing(false);
		}
	}, [fetchApi]);

	// 1. Load immediately on mount and when a forced refresh is triggered manually
	useEffect(() => {
		void loadBufferStatus();
	}, [loadBufferStatus, dataRefreshKey]);

	// 2. Smart Polling: Fetch every 30 seconds, BUT ONLY if the tab is currently visible
	useInterval(() => {
		if (document.hidden) {
			return;
		}
		void loadBufferStatus();
	}, 30000);

	// 3. Instant refresh when the user switches back to this browser tab
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				void loadBufferStatus();
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}, [loadBufferStatus]);

	// 4. Local live countdown: tick the clock down by 1 second visually
	useInterval(() => {
		setStatus((prev) => {
			if (!prev) {
				return prev;
			}
			if (prev.time_to_next <= 0) {
				return prev;
			}
			return {
				...prev,
				time_to_next: prev.time_to_next - 1,
			};
		});
	}, 1000);

	const formatTime = (seconds: number): string => {
		if (seconds <= 0) {
			return __('Now', 'primeplaced-logless-analytics');
		}
		
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		
		if (minutes > 0) {
			return `${minutes} min ${remainingSeconds} s`;
		}
		return `${remainingSeconds} s`;
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
				{status && <span
					className={cn('ppla-settings-card-header-badge')}
					style={{
						background: status.cron_active ? 'var(--ppla-color-primary)' : '#cc1818',
						boxShadow: 'none',
					}}
				>
						{status.cron_active
							? __('Ready', 'primeplaced-logless-analytics')
							: __('Needs attention', 'primeplaced-logless-analytics')}
				</span>}
				{isRefreshing && <span className="ppla-help" role="status">{__('Updating…', 'primeplaced-logless-analytics')}</span>}
			</CardHeader>
			<CardBody className="ppla-settings-card-body">
				{hasError && !status && <Notice status="error" isDismissible={false}>
					{__('The buffer status could not be loaded.', 'primeplaced-logless-analytics')}{' '}
					<Button variant="link" onClick={() => void loadBufferStatus()} disabled={isLoading}>{__('Try again', 'primeplaced-logless-analytics')}</Button>
				</Notice>}
				{isLoading && !status && <div className="ppla-buffer-status-loading" role="status" aria-busy="true">{__('Reading queue status…', 'primeplaced-logless-analytics')}</div>}
				{status && <div className="ppla-buffer-status-grid">
					
					{/* Events Count */}
					<div className="ppla-buffer-status-box">
						<strong className={status.events_count > 0 ? 'is-green' : ''}>
							{formatNumber(status.events_count)}
						</strong>
						<span>{__('Events in buffer', 'primeplaced-logless-analytics')}</span>
					</div>
					
					{/* Time to next aggregation */}
					<div className="ppla-buffer-status-box">
						<strong>{formatTime(status.time_to_next)}</strong>
						<span>{__('Time to next aggregation', 'primeplaced-logless-analytics')}</span>
					</div>
					
					{/* Buffer storage */}
					<div className="ppla-buffer-status-box">
						<strong>{status.buffer_kb} KB</strong>
						<span>{__('Queue table size', 'primeplaced-logless-analytics')}</span>
					</div>
					
				</div>}
				{hasError && status && <Notice status="warning" isDismissible={false}>{__('The queue status could not be refreshed. The last successful values are still shown.', 'primeplaced-logless-analytics')}{' '}<Button variant="link" onClick={() => void loadBufferStatus()} disabled={isRefreshing}>{__('Try again', 'primeplaced-logless-analytics')}</Button></Notice>}
			</CardBody>
		</Card>
	);
};
