/**
 * Settings Tab Main Controller.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import { useSettingsStateContext, useSettingsDispatch } from '@shared/contexts';
import { StickyLayout, type StickySectionDef } from '@admin/components/StickyLayout';
import type { SettingsComponentProps } from '@admin/components/AnimatedTabs';

// Import newly isolated components.
import { PrivacySection } from './components/PrivacySection';
import { TrackerInjectionSection } from './components/TrackerInjectionSection';
import { ExclusionsSection } from './components/ExclusionsSection';
import { DataManagementSection } from '@features/Advanced/components/DataManagementSection';
import { MaintenanceSection } from '@features/Advanced/components/MaintenanceSection';
import { PrivacySecuritySection } from '@features/Advanced/components/PrivacySecuritySection';
import { DatabaseDiagnosticsSection } from '@features/Advanced/components/DatabaseDiagnosticsSection';
import { ResetSettingsSection } from '@features/Advanced/components/ResetSettingsSection';
import { FailoverStatusSection } from '@features/General/components/FailoverStatusSection';
import { BufferStatusSection } from '@features/General/components/BufferStatusSection';

export const Settings = ( { className }: SettingsComponentProps ): JSX.Element => {
	const { settings } = useSettingsStateContext();
	const { saveSettings, discard } = useSettingsDispatch();

	const baseSections = useMemo<StickySectionDef[]>(
		() => [
			{
				id: 'privacy',
				title: __( 'Privacy & GDPR', 'primeplaced-logless-analytics' ),
				group: __( 'Privacy & compliance', 'primeplaced-logless-analytics' ),
				component: PrivacySection,
			},
			{ id: 'privacy-security', title: __( 'Privacy & Security', 'primeplaced-logless-analytics' ), group: __( 'Privacy & compliance', 'primeplaced-logless-analytics' ), component: PrivacySecuritySection },
			{
				id: 'tracker-injection',
				title: __( 'Tracking setup', 'primeplaced-logless-analytics' ),
				group: __( 'Tracking & rules', 'primeplaced-logless-analytics' ),
				component: TrackerInjectionSection,
			},
			{
				id: 'exclusions',
				title: __( 'Exclusions', 'primeplaced-logless-analytics' ),
				group: __( 'Tracking & rules', 'primeplaced-logless-analytics' ),
				component: ExclusionsSection,
			},
			{ id: 'tracking-transport', title: __( 'Tracking transport', 'primeplaced-logless-analytics' ), group: __( 'Tracking & rules', 'primeplaced-logless-analytics' ), component: FailoverStatusSection },
			{ id: 'queue-status', title: __( 'Queue status', 'primeplaced-logless-analytics' ), group: __( 'Queue & maintenance', 'primeplaced-logless-analytics' ), component: BufferStatusSection },
			{ id: 'data-management', title: __( 'Data Management', 'primeplaced-logless-analytics' ), group: __( 'Data & exports', 'primeplaced-logless-analytics' ), component: DataManagementSection },
			{ id: 'maintenance', title: __( 'Maintenance', 'primeplaced-logless-analytics' ), group: __( 'Queue & maintenance', 'primeplaced-logless-analytics' ), component: MaintenanceSection },
			{ id: 'database-diagnostics', title: __( 'Database Diagnostics', 'primeplaced-logless-analytics' ), group: __( 'System & diagnostics', 'primeplaced-logless-analytics' ), component: DatabaseDiagnosticsSection },
			{ id: 'reset-settings', title: __( 'Reset settings', 'primeplaced-logless-analytics' ), group: __( 'System & diagnostics', 'primeplaced-logless-analytics' ), component: ResetSettingsSection },
		],
		[]
	);

	const sections = useMemo(() => {
		return applyFilters(
			'ppla.ui.SettingsSections',
			baseSections
		) as StickySectionDef[];
	}, [baseSections]);

	return (
		<StickyLayout
			title={__( 'Settings', 'primeplaced-logless-analytics' )}
			sections={sections}
			className={className}
			layout="grouped"
			onSave={() => void saveSettings( settings || {} )}
			onDiscard={discard}
		/>
	);
};
