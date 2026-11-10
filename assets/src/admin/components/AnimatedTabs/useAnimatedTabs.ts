/**
 * Tab Routing Hook.
 * Handles URL synchronization and dirty state protection for tabs.
 *
 * @package
 */
import { useState, useEffect, useCallback } from '@wordpress/element';
import type { TabDefinition, TabKey } from './types';

const ACTIVE_TAB_STORAGE_KEY = 'ppla_active_admin_tab';

const VALID_TABS: TabKey[] = [
	'general',
	'reports',
	'content',
	'realtime',
	'events',
	'settings',
];

export const useAnimatedTabs = (tabs: TabDefinition[], isDirty: boolean) => {
	const getTabFromUrl = useCallback((): TabKey => {
		if (typeof window === 'undefined') return 'general';

		const params = new URLSearchParams(window.location.search);
		const currentTab = params.get('tab') as TabKey;
		let storedTab: TabKey | null = null;
		try {
			storedTab = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) as TabKey;
		} catch (error) {
			// Private browsing and blocked storage fall back to the URL/default tab.
		}

		if (currentTab && VALID_TABS.includes(currentTab)) return currentTab;
		if (storedTab && VALID_TABS.includes(storedTab)) return storedTab;

		return 'general';
	}, []);

	const [activeTab, setActiveTab] = useState<TabKey>(getTabFromUrl);
	const [pendingTab, setPendingTab] = useState<TabKey | null>(null);

	useEffect(() => {
		const handlePopState = () => setActiveTab(getTabFromUrl());
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, [getTabFromUrl]);

	useEffect(() => {
		if (typeof window === 'undefined') return;

		try {
			window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
		} catch (error) {
			// Private browsing and blocked storage must not interrupt navigation.
		}
	}, [activeTab]);

	const performTabChange = useCallback((nextTab: TabKey) => {
		setActiveTab(nextTab);
		if (typeof window !== 'undefined') {
			// Report filters belong to the tab that set them, so a new tab
			// starts from its own defaults instead of inheriting them.
			const url = new URL(window.location.href);
			const page = url.searchParams.get('page');
			url.search = '';
			if (page) {
				url.searchParams.set('page', page);
			}
			url.searchParams.set('tab', nextTab);
			url.hash = '';
			window.history.pushState({}, '', url);
			try {
				window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, nextTab);
			} catch (error) {
				// Private browsing and blocked storage must not interrupt navigation.
			}
		}
		setPendingTab(null);
	}, []);

	const handleTabChange = useCallback(
		(nextTab: TabKey) => {
			if (!nextTab || nextTab === activeTab) return;
			if (isDirty) {
				setPendingTab(nextTab);
				return;
			}
			performTabChange(nextTab);
		},
		[activeTab, isDirty, performTabChange]
	);

	return {
		activeTab,
		handleTabChange,
		pendingTab,
		confirmTabChange: () => pendingTab && performTabChange(pendingTab),
		cancelTabChange: () => setPendingTab(null),
	};
};
