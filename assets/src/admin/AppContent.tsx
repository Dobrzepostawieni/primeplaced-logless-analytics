/**
 * Main Application Content.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useEffect } from '@wordpress/element';
import {
	useAppState,
	useSettingsStateContext,
	useSettingsDispatch,
	useSettingsState,
} from '@shared/contexts';
import { Notices, useNotices } from '@shared/components/Notices';
import { ConfirmModal } from '@admin/components/ConfirmModal';
import { AnimatedTabs, useAnimatedTabs } from '@admin/components/AnimatedTabs';
import { AppHeader } from '@shared/components/AppHeader';
import { useAppTabs } from './useAppTabs';

export const AppContent = (): JSX.Element => {
	const { pplaData, proLoaded } = useAppState();
	const { isDirty } = useSettingsStateContext();
	const { discard } = useSettingsDispatch();
	const { isPremium } = useSettingsState();
	const { notify } = useNotices();

	useEffect(() => {
		if (pplaData?.has_fs_error) {
			notify('FREEMIUS_API_ERROR');
		}
	}, [pplaData?.has_fs_error, notify]);

	const tabs = useAppTabs();

	const {
		activeTab,
		handleTabChange,
		pendingTab,
		confirmTabChange,
		cancelTabChange,
	} = useAnimatedTabs(tabs, isDirty);

	useEffect(() => {
		if (proLoaded && !tabs.find((t) => t.name === activeTab)) {
			handleTabChange(tabs[0].name);
		}
	}, [proLoaded, tabs, activeTab, handleTabChange]);

	const activeTabDef = tabs.find((t) => t.name === activeTab) || tabs[0];
	const activeTabId = `ppla-tab-${activeTabDef.name}`;
	const activePanelId = `ppla-tabpanel-${activeTabDef.name}`;

	// Name the browser tab after the open dashboard tab, e.g. "Overview ‹ Logless Analytics ‹ Site".
	useEffect(() => {
		const label =
			activeTabDef.label ||
			(typeof activeTabDef.title === 'string' ? activeTabDef.title : '');
		if (typeof document === 'undefined' || !label) {
			return undefined;
		}

		const baseTitle = document.title;
		document.title = `${label} ‹ ${baseTitle}`;

		return () => {
			document.title = baseTitle;
		};
	}, [activeTabDef.label, activeTabDef.title]);

	const handleDiscardAndLeave = () => {
		discard();
		confirmTabChange();
	};

	return (
		<div className="ppla-admin-app" data-theme={isPremium ? 'pro' : 'free'}>
			<Notices />
			<AppHeader />

			<div className="ppla-main-layout">
				{!proLoaded ? (
					<div
						style={{
							display: 'flex',
							justifyContent: 'center',
							padding: '60px 0',
						}}
					>
						<div className="ppla-spinner" />
					</div>
				) : (
					<>
						<AnimatedTabs
							tabs={tabs}
							activeTab={activeTabDef.name}
							onTabChange={handleTabChange}
						/>
						<div
							className="ppla-main-content"
							id={activePanelId}
							role="tabpanel"
							aria-labelledby={activeTabId}
							tabIndex={-1}
						>
							{activeTabDef.components.map((Component, index) => (
								<Component
									key={`tab-${activeTabDef.name}-component-${index}`}
									className="ppla-settings-card"
								/>
							))}
						</div>
					</>
				)}
			</div>

			{pendingTab && (
				<ConfirmModal
					isOpen={!!pendingTab}
					title={__(
						'Unsaved changes',
						'primeplaced-logless-analytics'
					)}
					message={__(
						'You have unsaved changes in the current tab. Are you sure you want to leave? All changes will be lost.',
						'primeplaced-logless-analytics'
					)}
					confirmLabel={__(
						'Discard changes and leave',
						'primeplaced-logless-analytics'
					)}
					cancelLabel={__(
						'Go back and save',
						'primeplaced-logless-analytics'
					)}
					onConfirm={handleDiscardAndLeave}
					onCancel={cancelTabChange}
					isDestructive={true}
				/>
			)}
		</div>
	);
};
