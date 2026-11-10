import {
	Button,
	Modal,
	Notice,
	Spinner,
	TextControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis -- ToggleGroupControl is the guided trigger selector used by the app.
	__experimentalToggleGroupControl as ToggleGroupControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis -- ToggleGroupControlOption is required for the trigger selector.
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { useCallback, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useApi } from '@shared/api/useApi';
import { PplaToggler } from '@shared/components/PplaToggler/PplaToggler';
import type { CustomEventConfig, CustomEventTrigger } from '@shared/types';
import { useUnavailableAction } from '@shared/hooks/useUnavailableAction';

type CustomEventsResponse = {
	events?: CustomEventConfig[];
};

type CustomEventSetupMode = 'guided' | 'api';

const getErrorMessage = (error: unknown): string => {
	return error instanceof Error
		? error.message
		: __(
				'The custom event could not be saved. Please try again.',
				'primeplaced-logless-analytics'
			);
};

const getTriggerLabel = ( trigger: CustomEventTrigger ): string => {
	const labels: Record<CustomEventTrigger, string> = {
		click: __( 'Click on selected element', 'primeplaced-logless-analytics' ),
		submit: __( 'Form submission', 'primeplaced-logless-analytics' ),
		custom: __( 'JavaScript API call', 'primeplaced-logless-analytics' ),
	};

	return labels[ trigger ];
};

const getEventLabel = ( eventName: string ): string => eventName
	.replace( /_/g, ' ' )
	.replace( /\b\w/g, ( character ) => character.toUpperCase() );

export const CustomEventsSection = (): JSX.Element => {
	const unavailable = useUnavailableAction();
	const { fetchApi } = useApi();
	const [events, setEvents] = useState<CustomEventConfig[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState('');
	const [modalOpen, setModalOpen] = useState(false);
	const [eventName, setEventName] = useState('');
	const [setupMode, setSetupMode] = useState<CustomEventSetupMode>('guided');
	const [trigger, setTrigger] = useState<CustomEventTrigger>('click');
	const [selector, setSelector] = useState('');

	const loadEvents = useCallback(async (): Promise<void> => {
		setIsLoading(true);

		try {
			const response = await fetchApi<CustomEventsResponse>({
				path: '/ppla/v1/custom-events',
				method: 'GET',
			});

			setEvents(Array.isArray(response?.events) ? response.events : []);
			setError('');
		} catch (loadError) {
			setError(getErrorMessage(loadError));
		} finally {
			setIsLoading(false);
		}
	}, [fetchApi]);

	useEffect(() => {
		void loadEvents();
	}, [loadEvents]);

	const closeModal = (): void => {
		setModalOpen(false);
		setEventName('');
		setSetupMode('guided');
		setTrigger('click');
		setSelector('');
	};

	const updateSetupMode = (value: string | number | undefined): void => {
		if (value === 'guided') {
			setSetupMode('guided');
			setTrigger((current) => (current === 'custom' ? 'click' : current));
			return;
		}

		if (value === 'api') {
			setSetupMode('api');
			setTrigger('custom');
		}
	};

	const saveEvent = async (): Promise<void> => {
		setIsSaving(true);
		setError('');

		try {
			await fetchApi({
				path: '/ppla/v1/custom-events',
				method: 'POST',
				data: {
					event_name: eventName,
					trigger_type: trigger,
					css_selector: trigger === 'custom' ? '' : selector,
					is_active: true,
				},
			});

			closeModal();
			await loadEvents();
		} catch (saveError) {
			setError(getErrorMessage(saveError));
		} finally {
			setIsSaving(false);
		}
	};

	const updateActivity = async (
		id: string,
		isActive: boolean
	): Promise<void> => {
		setError('');

		try {
			await fetchApi({
				path: `/ppla/v1/custom-events/${id}`,
				method: 'PATCH',
				data: { is_active: isActive },
			});
			await loadEvents();
		} catch (updateError) {
			setError(getErrorMessage(updateError));
		}
	};

	const removeEvent = async (id: string): Promise<void> => {
		setError('');

		try {
			await fetchApi({
				path: `/ppla/v1/custom-events/${id}`,
				method: 'DELETE',
			});
			await loadEvents();
		} catch (removeError) {
			setError(getErrorMessage(removeError));
		}
	};

	return (
		<section
			className="ppla-custom-events"
			aria-labelledby="ppla-custom-events-title"
		>
			<div className="ppla-custom-events__header">
				<div>
					<h3
						id="ppla-custom-events-title"
						className="ppla-custom-events__title"
					>
						{__('Custom events', 'primeplaced-logless-analytics')}
					</h3>
					<p className="ppla-custom-events__description">
						{__(
							'Track a click, form submission, or developer event without collecting form values.',
							'primeplaced-logless-analytics'
						)}
					</p>
				</div>
				<Button
					variant="primary"
					className="ppla-button"
					onClick={() => setModalOpen(true)}
				>
					{__('Add event', 'primeplaced-logless-analytics')}
				</Button>
			</div>

			{error && (
				<Notice
					status="error"
					isDismissible
					onRemove={() => setError('')}
				>
					{error}{' '}
					<Button
						variant="link"
						onClick={() => void loadEvents()}
						disabled={isLoading}
					>
						{__( 'Try again', 'primeplaced-logless-analytics' )}
					</Button>
				</Notice>
			)}

			{isLoading && 0 === events.length && (
				<div className="ppla-custom-events__loading" role="status" aria-busy="true">
					<Spinner />
					{__( 'Loading configured events…', 'primeplaced-logless-analytics' )}
				</div>
			)}
			{isLoading && events.length > 0 && (
				<p className="ppla-custom-events__refreshing" role="status">
					{__( 'Refreshing configured events…', 'primeplaced-logless-analytics' )}
				</p>
			)}

			{!isLoading && !error && 0 === events.length && (
				<div className="ppla-custom-events__empty" role="status">
					<span className="ppla-custom-events__empty-icon" aria-hidden="true">✦</span>
					<div>
						<strong>{__('Ready for your first event', 'primeplaced-logless-analytics')}</strong>
						<p>{__('Create a rule to start measuring the interactions that matter to your site.', 'primeplaced-logless-analytics')}</p>
					</div>
				</div>
			)}

				{!isLoading && events.length > 0 && (
				<ul className="ppla-custom-events__list">
					{events.map((event) => (
						<li className="ppla-custom-events__item" key={event.id}>
							<div className="ppla-custom-events__content">
								<div className="ppla-custom-events__details">
									<strong>{getEventLabel( event.event_name )}</strong>
									<code>{`custom_event.${event.event_name}`}</code>
									<span>{getTriggerLabel( event.trigger_type )}</span>
									<span>
										{event.css_selector ||
											__(
												'JavaScript SDK',
												'primeplaced-logless-analytics'
											)}
									</span>
								</div>
							</div>
							<div className="ppla-custom-events__actions">
								<PplaToggler
									className="ppla-custom-events__toggle"
									isSmall
									label={__(
										'Active',
										'primeplaced-logless-analytics'
									)}
									checked={event.is_active}
									disabled={isSaving}
									isSaving={isSaving}
									onChange={(isActive) =>
										void updateActivity(event.id, isActive)
									}
								/>
								<Button
									isDestructive
									variant="tertiary"
									className="ppla-button"
									onClick={() => void removeEvent(event.id)}
								>
									{__(
										'Remove',
										'primeplaced-logless-analytics'
									)}
								</Button>
							</div>
						</li>
					))}
					</ul>
				)}

				{modalOpen && (
				<Modal
					title={__(
						'Add event',
						'primeplaced-logless-analytics'
					)}
					onRequestClose={closeModal}
					className="ppla-modal ppla-custom-events__modal"
				>
					<div className="ppla-custom-events__form">
						<div className="ppla-custom-events__intro">
							<h4>{__('What should we track?', 'primeplaced-logless-analytics')}</h4>
							<p>
								{__(
									'Give the interaction a name, then choose how PrimePlaced should detect it.',
									'primeplaced-logless-analytics'
								)}
							</p>
						</div>
						<TextControl
							className="ppla-input ppla-text-control"
							label={__(
								'Event name',
								'primeplaced-logless-analytics'
							)}
							value={eventName}
							onChange={setEventName}
							help={__(
									'Saved as lower_snake_case for reports.',
								'primeplaced-logless-analytics'
							)}
							__nextHasNoMarginBottom={false}
							__next40pxDefaultSize
							hideLabelFromVision={false}
						/>
						<ToggleGroupControl
							label={__('Setup mode', 'primeplaced-logless-analytics')}
							value={setupMode}
							onChange={updateSetupMode}
							isBlock
							__next40pxDefaultSize
							__nextHasNoMarginBottom
						>
							<ToggleGroupControlOption
								value="guided"
								label={__('Guided setup', 'primeplaced-logless-analytics')}
								showTooltip={false}
							/>
							<ToggleGroupControlOption
								value="api"
								label={__('JavaScript API', 'primeplaced-logless-analytics')}
								showTooltip={false}
							/>
						</ToggleGroupControl>
						{setupMode === 'guided' && (
							<>
								<div className="ppla-custom-events__trigger-control">
									<ToggleGroupControl
										label={__( 'Trigger type', 'primeplaced-logless-analytics' )}
										value={trigger}
										onChange={(value: string | number | undefined) => {
											if (value === 'click' || value === 'submit') {
												setTrigger(value);
											}
										}}
										isBlock
										__next40pxDefaultSize
										__nextHasNoMarginBottom
									>
										<ToggleGroupControlOption
											value="click"
											label={__( 'Click', 'primeplaced-logless-analytics' )}
											showTooltip={false}
										/>
										<ToggleGroupControlOption
											value="submit"
											label={__( 'Form submit', 'primeplaced-logless-analytics' )}
											showTooltip={false}
										/>
									</ToggleGroupControl>
								</div>
								<TextControl
									className="ppla-input ppla-text-control"
									label={__( 'CSS selector', 'primeplaced-logless-analytics' )}
									value={selector}
									onChange={setSelector}
									placeholder="#hero-cta"
									help=""
									__nextHasNoMarginBottom={false}
									__next40pxDefaultSize
									hideLabelFromVision={false}
								/>
							</>
						)}
						{setupMode === 'api' && (
							<div className="ppla-custom-events__sdk-card">
								<strong>{__('Developer event call', 'primeplaced-logless-analytics')}</strong>
								<p className="ppla-custom-events__sdk-help">
									{__( 'Call this after the tracker has loaded:', 'primeplaced-logless-analytics' )}
								</p>
								<code>{`window.ppla( 'track', '${eventName || 'cta_clicked'}', 0 )`}</code>
							</div>
						)}
						<div className="ppla-modal-footer">
							<div className="ppla-modal-footer-actions">
								<Button
									variant="tertiary"
									onClick={closeModal}
									disabled={isSaving}
									className="ppla-button"
								>
									{__( 'Cancel', 'primeplaced-logless-analytics' )}
								</Button>
								<Button
									variant="primary"
									className="ppla-button"
									isBusy={isSaving}
									disabled={isSaving || !eventName || (setupMode === 'guided' && !selector)}
									{...unavailable(
										!isSaving && (!eventName
											? __('Enter an event name first.', 'primeplaced-logless-analytics')
											: setupMode === 'guided' && !selector && __('Choose the element to track first.', 'primeplaced-logless-analytics'))
									)}
									onClick={() => void saveEvent()}
								>
									{isSaving ? __('Saving…', 'primeplaced-logless-analytics') : __( 'Save event', 'primeplaced-logless-analytics' )}
								</Button>
							</div>
						</div>
					</div>
				</Modal>
			)}
		</section>
	);
};
