/**
 * Analytics status and first-value workflow for the Overview tab.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useCallback, useEffect, useState } from '@wordpress/element';
import {
	Button,
	Card,
	CardBody,
	CardHeader,
	Icon,
	Notice,
} from '@wordpress/components';
import { caution, check, info, update } from '@wordpress/icons';
import { Card as UiCard, CollapsibleCard } from '@wordpress/ui';

import { useApi } from '@shared/api/useApi';
import { useAppState } from '@shared/contexts';
import { copyTextToClipboard } from '@shared/utils/clipboard';
import { cn } from '@shared/utils/formatting';
import { MaintenanceSection } from '@features/Advanced/components/MaintenanceSection';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import { BufferStatusSection } from './BufferStatusSection';
import { FailoverStatusSection } from './FailoverStatusSection';

type DashboardStatus =
	| 'waiting'
	| 'processing'
	| 'ready'
	| 'attention'
	| 'stale'
	| 'excluded'
	| 'error';
type NextAction =
	| 'test_measurement'
	| 'review_exclusions'
	| 'open_maintenance'
	| 'review_privacy';

interface AttentionItem {
	id: string;
	kind: string;
	label: string;
	target: string;
	count?: number;
}

interface PrivacyEffects {
	active_filters: string[];
}

interface StatusData {
	status: DashboardStatus;
	reason: string;
	privacy_mode: 'strict_anonymous' | 'session_hash';
	last_received_at: string;
	last_received_display?: string;
	last_processed_at: string;
	last_processed_display?: string;
	last_report_visible_at: string;
	last_report_visible_display?: string;
	last_pageview_at: string;
	oldest_pending_at: string;
	pending_hits: number;
	minutes_since_data: number | null;
	processing_lag_seconds: number | null;
	cron_scheduled: boolean;
	storage_ready: boolean;
	viewer_excluded: boolean;
	exclusion_reasons: string[];
	privacy_effects: PrivacyEffects;
	needs_attention: AttentionItem[];
	next_action: NextAction;
}

interface StatusResponse {
	success?: boolean;
	data?: unknown;
}

type StatusTone = 'ready' | 'processing' | 'attention' | 'error';

interface StatusSummary {
	title: string;
	description: string;
	primaryAction: 'open-public-site' | 'refresh-report' | 'open-maintenance' | null;
}

const isStatusData = (value: unknown): value is StatusData => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const data = value as Partial<StatusData>;
	return (
		(data.status === 'waiting' ||
			data.status === 'processing' ||
			data.status === 'ready' ||
			data.status === 'attention' ||
			data.status === 'stale' ||
			data.status === 'excluded' ||
			data.status === 'error') &&
		typeof data.reason === 'string' &&
		typeof data.privacy_mode === 'string' &&
		typeof data.last_received_at === 'string' &&
		typeof data.last_processed_at === 'string' &&
		typeof data.last_report_visible_at === 'string' &&
		typeof data.last_pageview_at === 'string' &&
		typeof data.oldest_pending_at === 'string' &&
		typeof data.pending_hits === 'number' &&
		(typeof data.minutes_since_data === 'number' ||
			data.minutes_since_data === null) &&
		(typeof data.processing_lag_seconds === 'number' ||
			data.processing_lag_seconds === null) &&
		typeof data.cron_scheduled === 'boolean' &&
		typeof data.storage_ready === 'boolean' &&
		typeof data.viewer_excluded === 'boolean' &&
		Array.isArray(data.exclusion_reasons) &&
		Array.isArray(data.needs_attention) &&
		Array.isArray(data.privacy_effects?.active_filters) &&
		(data.next_action === 'test_measurement' ||
			data.next_action === 'review_exclusions' ||
			data.next_action === 'open_maintenance' ||
			data.next_action === 'review_privacy')
	);
};

const getStatusSummary = (
	status: DashboardStatus,
	reason: string,
	nextAction?: NextAction
): StatusSummary => {
	if (status === 'ready' || reason === 'data_current') {
		return {
			title: __('Analytics is working', 'primeplaced-logless-analytics'),
			description: __(
				'Your latest activity is ready to view in the reports.',
				'primeplaced-logless-analytics'
			),
			primaryAction: null,
		};
	}

	if (status === 'processing' || reason === 'buffer_pending') {
		return {
			title: __(
				'New activity is being processed',
				'primeplaced-logless-analytics'
			),
			description: __(
				'We received activity. It will appear in your reports shortly.',
				'primeplaced-logless-analytics'
			),
			primaryAction: 'refresh-report',
		};
	}

	if (status === 'waiting' || reason === 'no_data_yet') {
		return {
			title: __(
				'Waiting for the first visit',
				'primeplaced-logless-analytics'
			),
			description: __(
				'Visit your site in a private or logged-out window, then refresh this report.',
				'primeplaced-logless-analytics'
			),
			primaryAction: 'open-public-site',
		};
	}

	if (status === 'excluded' || reason === 'viewer_excluded') {
		return {
			title: __(
				'Analytics needs attention',
				'primeplaced-logless-analytics'
			),
			description: __(
				'Your administrator account is excluded from tracking. Use a private window or review Exclusions.',
				'primeplaced-logless-analytics'
			),
			primaryAction: 'open-public-site',
		};
	}

	if (status === 'stale' || reason === 'data_stale') {
		return {
			title: __(
				'Analytics needs attention',
				'primeplaced-logless-analytics'
			),
			description: __(
				'Visit your site once, then refresh this report. If activity is still missing, open Maintenance.',
				'primeplaced-logless-analytics'
			),
			primaryAction: 'open-public-site',
		};
	}

	if (nextAction === 'open_maintenance') {
		return {
			title: __('Analytics needs attention', 'primeplaced-logless-analytics'),
			description: __(
				'Review the technical details below to check storage and the processing schedule.',
				'primeplaced-logless-analytics'
			),
			primaryAction: 'open-maintenance',
		};
	}

	return {
		title: __('Analytics needs attention', 'primeplaced-logless-analytics'),
		description: __(
			'Review the technical details below to check storage and the processing schedule.',
			'primeplaced-logless-analytics'
		),
		primaryAction: null,
	};
};

const getStatusLabel = (tone: StatusTone): string => {
	switch (tone) {
		case 'ready':
			return __('Working', 'primeplaced-logless-analytics');
		case 'processing':
			return __('Processing', 'primeplaced-logless-analytics');
		case 'error':
			return __('Needs attention', 'primeplaced-logless-analytics');
		case 'attention':
		default:
			return __('Needs attention', 'primeplaced-logless-analytics');
	}
};

const getStatusTone = (status: DashboardStatus, reason: string): StatusTone => {
	if (status === 'ready' || reason === 'data_current') {
		return 'ready';
	}

	if (status === 'processing' || reason === 'buffer_pending') {
		return 'processing';
	}

	if (status === 'error') {
		return 'error';
	}

	return 'attention';
};

const getStatusIcon = (tone: StatusTone) => {
	switch (tone) {
		case 'ready':
			return check;
		case 'error':
			return caution;
		case 'processing':
		case 'attention':
		default:
			return info;
	}
};

const navigateToTab = (
	tab: 'settings' | 'content' | 'events',
	section?: string
): void => {
	const url = new URL(window.location.href);
	url.searchParams.set('tab', tab);
	url.hash = section ? `ppla-section-${section}` : '';
	window.history.pushState({}, '', url);
	window.dispatchEvent(new PopStateEvent('popstate'));
};

const getPublicSiteUrl = (): string => window.pplaAdminData?.site_url || '';

const openPublicSite = (): void => {
	const siteUrl = getPublicSiteUrl();
	if (siteUrl) {
		window.open(siteUrl, '_blank', 'noopener,noreferrer');
	}
};

export const DashboardStatusSection = ({
	title,
}: Pick<StickySectionProps, 'title'>): JSX.Element => {
	const { fetchApi } = useApi();
	const { dataRefreshKey } = useAppState();
	const [data, setData] = useState<StatusData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [loadError, setLoadError] = useState(false);
	const [copyMessage, setCopyMessage] = useState('');
	const [areDetailsOpen, setAreDetailsOpen] = useState<boolean | null>(null);

	const loadStatus = useCallback(
		async (initial = false): Promise<void> => {
			if (initial) {
				setIsLoading(true);
			} else {
				setIsRefreshing(true);
			}

			try {
				const response = await fetchApi<StatusResponse>({
					path: '/ppla/v1/dashboard/status',
					method: 'GET',
				});

				if (!response?.success || !isStatusData(response.data)) {
					throw new Error('invalid_status_response');
				}

				setData(response.data);
				setLoadError(false);
			} catch {
				setLoadError(true);
			} finally {
				setIsLoading(false);
				setIsRefreshing(false);
			}
		},
		[fetchApi]
	);

	useEffect(() => {
		void loadStatus(!data);
	}, [dataRefreshKey, loadStatus]);

	const copyPublicSiteAddress = async (): Promise<void> => {
		const siteUrl = getPublicSiteUrl();
		if (!siteUrl) return;

		const wasCopied = await copyTextToClipboard(siteUrl);
		setCopyMessage(
			wasCopied
				? __('Site address copied.', 'primeplaced-logless-analytics')
				: __(
						'The site address could not be copied.',
						'primeplaced-logless-analytics'
					)
		);
	};

	const status = data?.status || 'waiting';
	const reason = data?.reason || 'no_data_yet';
	const summary = getStatusSummary(status, reason, data?.next_action);
	const statusTone = getStatusTone(status, reason);
	const statusIcon = getStatusIcon(statusTone);
	const statusLabel = getStatusLabel(statusTone);
	const canOpenPublicSite = Boolean(getPublicSiteUrl());
	const showLoadError = loadError && !data;
	const showLoading = isLoading && !data;
	const showStatus = !showLoadError && !showLoading;
	const hasSecondaryActions =
		status === 'excluded' || Boolean(data?.viewer_excluded);
	const hasNextAction =
		Boolean(summary.primaryAction) ||
		hasSecondaryActions ||
		status === 'stale';
	const hasMultipleNextSteps = hasSecondaryActions || status === 'stale';
	// A healthy setup needs no attention, so it gets a one-line summary.
	const isQuiet = statusTone === 'ready' && !hasNextAction;
	// Diagnostics probe the tracking routes, so they run only when opened.
	const showDetails =
		areDetailsOpen ?? (status === 'attention' || status === 'error');

	const renderPrimaryAction = (): JSX.Element | null => {
		if (summary.primaryAction === 'open-public-site' && canOpenPublicSite) {
			return (
				<Button
					variant="primary"
					className="ppla-button"
					onClick={openPublicSite}
				>
					{__('Open public site', 'primeplaced-logless-analytics')}
				</Button>
			);
		}

		if (summary.primaryAction === 'refresh-report') {
			return (
				<Button
					variant="primary"
					className="ppla-button"
					onClick={() => void loadStatus()}
					disabled={isRefreshing}
					isBusy={isRefreshing}
				>
					{__('Refresh report', 'primeplaced-logless-analytics')}
				</Button>
			);
		}

		if (summary.primaryAction === 'open-maintenance') {
			return (
				<Button
					variant="primary"
					className="ppla-button"
					onClick={() => navigateToTab('settings', 'maintenance')}
				>
					{__('Open Maintenance', 'primeplaced-logless-analytics')}
				</Button>
			);
		}

		return null;
	};

	return (
		<Card className="ppla-settings-card ppla-dashboard-status-card">
			<CardHeader className="ppla-settings-card-header">
				<div className="ppla-dashboard-status-card__header-content">
					<div className="ppla-dashboard-status-card__title-row">
						<h2>
							{title ||
								__(
									'Measurement status',
									'primeplaced-logless-analytics'
								)}
						</h2>
						{showStatus && (
							<span
								className={cn(
									'ppla-dashboard-status-card__status-label',
									`is-${statusTone}`
								)}
							>
								{statusLabel}
							</span>
						)}
					</div>
				</div>
				<Button
					icon={update}
					variant="tertiary"
					className="ppla-button"
					onClick={() => void loadStatus()}
					disabled={isLoading || isRefreshing}
					isBusy={isRefreshing}
				>
					{__('Refresh', 'primeplaced-logless-analytics')}
				</Button>
			</CardHeader>
			<CardBody className="ppla-settings-card-body">
				{showLoadError && (
					<div
						className="ppla-dashboard-status-card__error"
						role="alert"
					>
						<strong>
							{__(
								'The status could not be loaded.',
								'primeplaced-logless-analytics'
							)}
						</strong>
						<p>
							{__(
								'Try again when the administrator session or REST API is available.',
								'primeplaced-logless-analytics'
							)}
						</p>
						<Button
							variant="primary"
							className="ppla-button"
							onClick={() => void loadStatus(true)}
						>
							{__('Try again', 'primeplaced-logless-analytics')}
						</Button>
					</div>
				)}
				{showLoading && (
					<div
						className="ppla-dashboard-status-card__loading"
						role="status"
						aria-busy="true"
					>
						<span className="ppla-spinner" aria-hidden="true" />
						{__(
							'Checking analytics status…',
							'primeplaced-logless-analytics'
						)}
					</div>
				)}
				{showStatus && isQuiet && (
					<p
						className="ppla-dashboard-status-card__reason is-quiet"
						role="status"
					>
						{summary.description}
					</p>
				)}
				{showStatus && (
					<>
						{!isQuiet && (
						<div
							className={cn(
								'ppla-dashboard-status-card__state',
								`is-${statusTone}`,
								hasNextAction && 'has-next-action'
							)}
						>
							<div className="ppla-dashboard-status-card__state-content">
								<span className="ppla-dashboard-status-card__state-icon-wrap">
									<Icon
										icon={statusIcon}
										size={24}
										className="ppla-dashboard-status-card__state-icon"
										aria-hidden="true"
									/>
								</span>
								<div className="ppla-dashboard-status-card__state-copy">
									<h3 className="ppla-dashboard-status-card__state-kicker">
										{summary.title}
									</h3>
									<p
										className="ppla-dashboard-status-card__reason"
										role="status"
									>
										{summary.description}
									</p>
								</div>
							</div>
							{hasNextAction && (
								<div className="ppla-dashboard-status-card__next-actions">
									<span className="ppla-dashboard-status-card__next-label">
										{hasMultipleNextSteps
											? __(
													'Next steps',
													'primeplaced-logless-analytics'
												)
											: __(
													'Next step',
													'primeplaced-logless-analytics'
												)}
									</span>
									<div className="ppla-dashboard-status-card__next-buttons">
										{renderPrimaryAction()}
										{hasSecondaryActions && (
											<>
												<Button
													variant="secondary"
													className="ppla-button"
													onClick={() =>
														void copyPublicSiteAddress()
													}
												>
													{__(
														'Copy site address',
														'primeplaced-logless-analytics'
													)}
												</Button>
												<Button
													variant="tertiary"
													className="ppla-button"
													onClick={() =>
														navigateToTab(
															'settings',
															'exclusions'
														)
													}
												>
													{__(
														'Open Exclusions',
														'primeplaced-logless-analytics'
													)}
												</Button>
											</>
										)}
										{status === 'stale' && (
											<Button
												variant="tertiary"
												className="ppla-button"
												onClick={() =>
													void loadStatus()
												}
											>
												{__(
													'Refresh report',
													'primeplaced-logless-analytics'
												)}
											</Button>
										)}
									</div>
								</div>
							)}
						</div>
						)}
						{copyMessage && (
							<p className="ppla-help" role="status">
								{copyMessage}
							</p>
						)}

						<CollapsibleCard.Root
							className="ppla-dashboard-status-card__technical-details"
							open={showDetails}
							onOpenChange={setAreDetailsOpen}
						>
							<CollapsibleCard.Header
								className="ppla-dashboard-status-card__technical-details-header"
								render={
									// eslint-disable-next-line jsx-a11y/heading-has-content
									<h3
										aria-label={__(
											'Technical details',
											'primeplaced-logless-analytics'
										)}
									/>
								}
							>
								<UiCard.Title>
									{__(
										'Technical details',
										'primeplaced-logless-analytics'
									)}
								</UiCard.Title>
							</CollapsibleCard.Header>
							<CollapsibleCard.Content className="ppla-dashboard-status-card__technical-details-content">
								{showDetails && (
									<div className="ppla-dashboard-status-card__technical-panels">
										<FailoverStatusSection
											title={__(
												'Tracking transport',
												'primeplaced-logless-analytics'
											)}
											isActive={false}
										/>
										<BufferStatusSection
											title={__(
												'Queue status',
												'primeplaced-logless-analytics'
											)}
											isActive={false}
										/>
										<MaintenanceSection
											title={__(
												'Maintenance',
												'primeplaced-logless-analytics'
											)}
											isActive={false}
										/>
									</div>
								)}

								{data?.needs_attention?.[0] && (
									<Notice
										status={
											status === 'error'
												? 'error'
												: 'warning'
										}
										isDismissible={false}
									>
										{data.needs_attention[0].label}
									</Notice>
								)}
							</CollapsibleCard.Content>
						</CollapsibleCard.Root>
					</>
				)}
			</CardBody>
		</Card>
	);
};
