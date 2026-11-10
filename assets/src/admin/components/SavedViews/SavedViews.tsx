/**
 * Server-backed saved report view manager.
 *
 * @package
 */
import { PplaSelectControl } from '@shared/components/PplaSelectControl';
import { __, sprintf } from '@wordpress/i18n';
import {
	Button,
	Dropdown,
	MenuGroup,
	MenuItem,
	TextControl,
} from '@wordpress/components';
import {
	useCallback,
	useEffect,
	useRef,
	useState,
} from '@wordpress/element';
import { check, download, starFilled, trash } from '@wordpress/icons';
import { ConfirmModal } from '@admin/components/ConfirmModal';
import { useNotices } from '@shared/components/Notices';
import { useSavedViewsStore } from './SavedViewsContext';
import {
	getSerializedStoredReportQueryState,
	getStoredReportQueryState,
	mergeReportQueryState,
	setSerializedStoredReportQueryState,
	type ReportQueryUrlOverrides,
} from '@admin/components/ReportQuery/reportQueryState';
import type {
	SavedReportView,
	SavedViewVisibility,
} from './types';
import { useUnavailableAction } from '@shared/hooks/useUnavailableAction';

interface SavedViewsProps {
	reportTitle?: string;
	storageKey: string;
	range: number;
	onRangeChange: (range: number) => void;
	initialUrlRange?: number;
	initialUrlQueryOverrides?: ReportQueryUrlOverrides;
}

interface TableStateChangeDetail {
	storageKey?: unknown;
	tableState?: unknown;
}

interface ReportQueryStateChangeDetail {
	storageKey?: unknown;
	queryState?: unknown;
}

const getTableState = (storageKey: string): string | null => {
	try {
		return window.localStorage.getItem(`ppla_table_${storageKey}`);
	} catch {
		return null;
	}
};

const setTableState = (storageKey: string, tableState: string | null): void => {
	try {
		if (tableState) {
			window.localStorage.setItem(`ppla_table_${storageKey}`, tableState);
		} else {
			window.localStorage.removeItem(`ppla_table_${storageKey}`);
		}
	} catch {
		// The report can still open with its selected date range.
	}
};

const getSnapshotKey = (
	range: number,
	tableState: string | null,
	queryState: string | null
): string => JSON.stringify([range, tableState || null, queryState || null]);

export const SavedViews = ({
	reportTitle = __('This report', 'primeplaced-logless-analytics'),
	storageKey,
	range,
	onRangeChange,
	initialUrlRange,
	initialUrlQueryOverrides,
}: SavedViewsProps): JSX.Element => {
	const unavailable = useUnavailableAction();
	const {
		loadState,
		viewsByStorageKey,
		viewLoadStates,
		preferences,
		claimInitialPreferenceHydration,
		hasChangedBeforeHydration,
		noteRangeBeforeHydration,
		loadViews,
		createView,
		updateView,
		deleteView,
		savePreference,
	} = useSavedViewsStore();
	const viewLoadState = viewLoadStates[storageKey] || 'loading';

	// Declared before the hydration effect so the first range is the baseline.
	useEffect(() => {
		noteRangeBeforeHydration(storageKey, range);
	}, [noteRangeBeforeHydration, range, storageKey]);
	const { notify } = useNotices();
	const [name, setName] = useState('');
	const [visibility, setVisibility] = useState<SavedViewVisibility>('private');
	const [editingViewId, setEditingViewId] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [viewPendingDelete, setViewPendingDelete] =
		useState<SavedReportView | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const appliedPreferenceRef = useRef(false);
	const isApplyingPreferenceRef = useRef(false);
	const preferenceTimerRef = useRef<number | undefined>(undefined);
	// Without a stored preference, the state at hydration is the default and
	// does not need to be written until the user changes something.
	const defaultSnapshotRef = useRef<string | null>(null);
	const applyStoredState = useCallback(
		(tableState: string | null, queryState: string | null, nextRange: number): void => {
			isApplyingPreferenceRef.current = true;
			// Persist the whole snapshot before notifying either state consumer so
			// table and query listeners cannot observe a partial view.
			setTableState(storageKey, tableState);
			setSerializedStoredReportQueryState(storageKey, queryState);
			window.dispatchEvent(
				new CustomEvent('ppla:apply-table-state', {
					detail: {
						storageKey,
						// DataTable listeners use this string as the apply signal. An
						// empty object means "reset to defaults" while storage stays
						// absent for a genuinely empty snapshot.
						tableState: tableState || '{}',
					},
				})
			);
			window.dispatchEvent(
				new CustomEvent('ppla:apply-report-query-state', {
					detail: { storageKey, queryState },
				})
			);
			if (nextRange !== range) onRangeChange(nextRange);
			window.setTimeout(() => {
				isApplyingPreferenceRef.current = false;
			}, 0);
		},
		[onRangeChange, range, storageKey]
	);

	const reportViews = viewsByStorageKey[storageKey] || [];
	const editingView = reportViews.find((view) => view.id === editingViewId);

	useEffect(() => {
		loadViews(storageKey);
	}, [loadViews, storageKey]);

	const persistPreference = useCallback(
		(
			tableState = getTableState(storageKey),
			queryState = getSerializedStoredReportQueryState(storageKey)
		): void => {
			window.clearTimeout(preferenceTimerRef.current);
			preferenceTimerRef.current = window.setTimeout(() => {
				if (
					getSnapshotKey(range, tableState, queryState) ===
					defaultSnapshotRef.current
				) {
					return;
				}

				defaultSnapshotRef.current = null;
				void savePreference(storageKey, { range, tableState, queryState }).catch(() => {
					// The report remains usable if a preference update is temporarily unavailable.
				});
			}, 350);
		},
		[range, savePreference, storageKey]
	);

	useEffect(() => {
		return () => window.clearTimeout(preferenceTimerRef.current);
	}, []);

	useEffect(() => {
		if (loadState !== 'ready' || appliedPreferenceRef.current) return;

		appliedPreferenceRef.current = true;
		if (!preferences[storageKey]) {
			defaultSnapshotRef.current = getSnapshotKey(
				range,
				getTableState(storageKey),
				getSerializedStoredReportQueryState(storageKey)
			);
		}
		if (!claimInitialPreferenceHydration(storageKey)) {
			// A sticky header can remount this component while the report stays
			// mounted. Keep its current state and let the next effect save it.
			return;
		}
		if (hasChangedBeforeHydration(storageKey)) {
			// The user changed the report while preferences were loading; keep
			// their state and let the next effect save it as the preference.
			return;
		}

		const preference = preferences[storageKey];
		if (!preference) return;

		const currentTableState = getTableState(storageKey);
		const currentQueryState = getSerializedStoredReportQueryState(storageKey);
		const queryFilterIds = initialUrlQueryOverrides?.filterIds;
		const nextQueryState = queryFilterIds
			? JSON.stringify(
					mergeReportQueryState(
						preference.queryState,
						getStoredReportQueryState(storageKey, queryFilterIds),
						queryFilterIds,
						initialUrlQueryOverrides
					)
				)
			: preference.queryState;
		const nextRange = initialUrlRange ?? preference.range;
		const hasNewTableState = preference.tableState !== currentTableState;
		const hasNewQueryState =
			nextQueryState !== null && nextQueryState !== currentQueryState;
		if (hasNewTableState || hasNewQueryState || nextRange !== range) {
			applyStoredState(
				preference.tableState,
				nextQueryState,
				nextRange
			);
		}
	}, [
		applyStoredState,
		claimInitialPreferenceHydration,
		hasChangedBeforeHydration,
		loadState,
		initialUrlRange,
		initialUrlQueryOverrides,
		preferences,
		range,
		storageKey,
	]);

	useEffect(() => {
		if (
			loadState !== 'ready' ||
			!appliedPreferenceRef.current
		) {
			return;
		}
		if (isApplyingPreferenceRef.current) {
			isApplyingPreferenceRef.current = false;
			return;
		}

		persistPreference();
	}, [loadState, persistPreference, range, storageKey]);

	useEffect(() => {
		const handleTableStateChange = (event: Event): void => {
			const detail = (event as CustomEvent<TableStateChangeDetail>).detail;
			if (
				loadState !== 'ready' ||
				!appliedPreferenceRef.current ||
				isApplyingPreferenceRef.current ||
				detail?.storageKey !== storageKey ||
				typeof detail.tableState !== 'string'
			) {
				return;
			}

			persistPreference(detail.tableState);
		};

		window.addEventListener('ppla:table-state-changed', handleTableStateChange);

		return () =>
			window.removeEventListener(
				'ppla:table-state-changed',
				handleTableStateChange
			);
	}, [loadState, persistPreference, storageKey]);

	useEffect(() => {
		const handleReportQueryStateChange = (event: Event): void => {
			const detail = (event as CustomEvent<ReportQueryStateChangeDetail>).detail;
			if (
				loadState !== 'ready' ||
				!appliedPreferenceRef.current ||
				isApplyingPreferenceRef.current ||
				detail?.storageKey !== storageKey ||
				typeof detail.queryState !== 'string'
			) {
				return;
			}

			persistPreference(getTableState(storageKey), detail.queryState);
		};

		window.addEventListener(
			'ppla:report-query-changed',
			handleReportQueryStateChange
		);

		return () =>
			window.removeEventListener(
				'ppla:report-query-changed',
				handleReportQueryStateChange
			);
	}, [loadState, persistPreference, storageKey]);

	const resetForm = useCallback(() => {
		setName('');
		setVisibility('private');
		setEditingViewId(null);
	}, []);

	const saveView = useCallback(async (): Promise<void> => {
		const cleanName = name.trim();
		if (!cleanName || isSaving) return;

		setIsSaving(true);
		const input = {
			storageKey,
			name: cleanName,
			range,
			tableState: getTableState(storageKey),
			queryState: getSerializedStoredReportQueryState(storageKey),
			visibility,
		};

		try {
			if (editingViewId) {
				await updateView(editingViewId, input);
			} else {
				await createView(input);
			}
			resetForm();
			notify(
				'SETTINGS_SAVE_SUCCESS',
				__('View saved.', 'primeplaced-logless-analytics')
			);
		} catch {
			notify(
				'SETTINGS_SAVE_ERROR',
				__(
					'The saved view could not be stored. Please try again.',
					'primeplaced-logless-analytics'
				)
			);
		} finally {
			setIsSaving(false);
		}
	}, [
		createView,
		editingViewId,
		isSaving,
		name,
		notify,
		range,
		resetForm,
		storageKey,
		updateView,
		visibility,
	]);

	const openView = useCallback((view: SavedReportView): void => {
		if (view.storageKey !== storageKey) return;
		applyStoredState(view.tableState, view.queryState, view.range);
	}, [applyStoredState, storageKey]);

	const editView = useCallback((view: SavedReportView): void => {
		if (!view.canEdit) return;

		setEditingViewId(view.id);
		setName(view.name);
		setVisibility(view.visibility);
	}, []);

	const copyView = useCallback((view: SavedReportView): void => {
		setEditingViewId(null);
		setName(
			sprintf(
				/* translators: %s: name of the saved view being duplicated. */
				__('%s (copy)', 'primeplaced-logless-analytics'),
				view.name
			)
		);
		setVisibility('private');
	}, []);

	const removeView = useCallback(async (view: SavedReportView): Promise<void> => {
		if (!view.canDelete) return;

		setIsDeleting(true);
		try {
			await deleteView(view.id);
			if (editingViewId === view.id) resetForm();
			notify(
				'SETTINGS_SAVE_SUCCESS',
				__('Saved view deleted.', 'primeplaced-logless-analytics')
			);
		} catch {
			notify(
				'SETTINGS_SAVE_ERROR',
				__(
					'The saved view could not be removed. Please try again.',
					'primeplaced-logless-analytics'
				)
			);
		} finally {
			setIsDeleting(false);
			setViewPendingDelete(null);
		}
	}, [deleteView, editingViewId, notify, resetForm]);

	const exportViews = useCallback(() => {
		const blob = new Blob([JSON.stringify(reportViews, null, 2)], {
			type: 'application/json',
		});
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `ppla-${storageKey}-saved-views.json`;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
		notify(
			'EXPORT_SUCCESS',
			__(
				'Saved views export started.',
				'primeplaced-logless-analytics'
			)
		);
	}, [notify, reportViews, storageKey]);

	return (
		<>
			<Dropdown
				popoverProps={{ placement: 'bottom-end' }}
				renderToggle={({
					isOpen,
					onToggle,
				}: {
					isOpen: boolean;
					onToggle: () => void;
				}) => (
					<Button
						variant="secondary"
						icon={starFilled}
						onClick={onToggle}
						aria-expanded={isOpen}
						label={sprintf(
							/* translators: %s: report name. */
							__('Saved views for %s', 'primeplaced-logless-analytics'),
							reportTitle
						)}
						className="ppla-button"
					>
						{__('Views', 'primeplaced-logless-analytics')}
					</Button>
				)}
				renderContent={() => (
					<div
						className="ppla-saved-views-dropdown"
						aria-label={sprintf(
							/* translators: %s: report name. */
							__('Saved views for %s', 'primeplaced-logless-analytics'),
							reportTitle
						)}
					>
						<form
							className="ppla-saved-views-dropdown__form"
							onSubmit={(event) => {
								event.preventDefault();
								void saveView();
							}}
						>
							<TextControl
								label={
									editingView
										? __('Edit saved view', 'primeplaced-logless-analytics')
										: __('Save current view as', 'primeplaced-logless-analytics')
								}
								value={name}
								onChange={setName}
								help={__(
									'Includes the range, filters, sorting and visible columns.',
									'primeplaced-logless-analytics'
								)}
								className="ppla-text-control"
								hideLabelFromVision={false}
								__next40pxDefaultSize
								__nextHasNoMarginBottom
							/>
							<PplaSelectControl
								label={__('Visibility', 'primeplaced-logless-analytics')}
								value={visibility}
								onChange={(value: string) =>
									setVisibility(value as SavedViewVisibility)
								}
								options={[
									{
										label: __('Private — only me', 'primeplaced-logless-analytics'),
										value: 'private',
									},
									{
										label: __('Shared — analytics team', 'primeplaced-logless-analytics'),
										value: 'shared',
									},
								]}
							/>
							<div className="ppla-saved-views-dropdown__form-actions">
								<Button
									className="ppla-button"
									variant="primary"
									type="submit"
									disabled={!name.trim() || isSaving}
									{...unavailable(
										!name.trim() && !isSaving &&
											__('Enter a name for this view first.', 'primeplaced-logless-analytics')
									)}
								>
									{editingView
										? __('Update view', 'primeplaced-logless-analytics')
										: __('Save view', 'primeplaced-logless-analytics')}
								</Button>
								{editingView && (
									<Button
										className="ppla-button"
										variant="tertiary"
										onClick={resetForm}
										disabled={isSaving}
									>
										{__('Cancel', 'primeplaced-logless-analytics')}
									</Button>
								)}
							</div>
						</form>

						{viewLoadState === 'loading' && (
							<p className="ppla-saved-views-dropdown__status" role="status">
								{__('Loading saved views…', 'primeplaced-logless-analytics')}
							</p>
						)}
						{viewLoadState === 'error' && (
							<p className="ppla-saved-views-dropdown__status" role="alert">
								{__(
									'Saved views are temporarily unavailable. You can keep using this report.',
									'primeplaced-logless-analytics'
								)}
							</p>
						)}

						{reportViews.length > 0 && (
							<MenuGroup
								label={__('Open a saved view', 'primeplaced-logless-analytics')}
							>
								{reportViews.map((view) => (
									<div className="ppla-saved-view-menu-item" key={view.id}>
										<MenuItem
											isDestructive={false}
											onClick={() => openView(view)}
										>
											{view.name}
										</MenuItem>
										<div className="ppla-saved-view-menu-item__meta">
											<span>
												{__('Author:', 'primeplaced-logless-analytics')} {view.author.name}
											</span>
											<span>
												{view.visibility === 'shared'
													? __('Shared', 'primeplaced-logless-analytics')
													: __('Private', 'primeplaced-logless-analytics')}
											</span>
										</div>
										<div className="ppla-saved-view-menu-item__actions">
											{view.canEdit ? (
												<Button
													variant="tertiary"
													icon={check}
													label={__('Edit saved view', 'primeplaced-logless-analytics')}
													onClick={() => editView(view)}
													className="ppla-button"
												/>
											) : (
												<Button
													variant="tertiary"
													label={__('Save a private copy', 'primeplaced-logless-analytics')}
													onClick={() => copyView(view)}
													className="ppla-button"
												>
													{__('Copy', 'primeplaced-logless-analytics')}
												</Button>
											)}
											{view.canDelete && (
												<Button
													variant="tertiary"
													icon={trash}
													label={__('Delete saved view', 'primeplaced-logless-analytics')}
													onClick={() => setViewPendingDelete(view)}
													className="ppla-button is-destructive"
												/>
											)}
										</div>
									</div>
								))}
							</MenuGroup>
						)}

						<MenuGroup>
							<MenuItem
								isDestructive={false}
								icon={download}
								onClick={exportViews}
								disabled={reportViews.length === 0}
							>
								{__('Export saved views', 'primeplaced-logless-analytics')}
							</MenuItem>
						</MenuGroup>
					</div>
				)}
			/>
			<ConfirmModal
				isOpen={viewPendingDelete !== null}
				title={__('Delete saved view?', 'primeplaced-logless-analytics')}
				message={sprintf(
					/* translators: %s: saved view name. */
					__(
						'“%s” will be removed for everyone who can open it. This cannot be undone.',
						'primeplaced-logless-analytics'
					),
					viewPendingDelete?.name || ''
				)}
				confirmLabel={__('Delete', 'primeplaced-logless-analytics')}
				isConfirming={isDeleting}
				onConfirm={() => {
					if (viewPendingDelete) void removeView(viewPendingDelete);
				}}
				onCancel={() => setViewPendingDelete(null)}
			/>
		</>
	);
};
