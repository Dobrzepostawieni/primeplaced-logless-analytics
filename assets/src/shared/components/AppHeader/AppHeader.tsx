import { __ } from '@wordpress/i18n';
import { cn } from '@shared/utils/formatting';
import { useSettingsState } from '@shared/contexts';

import logoUrl from '@images/ppla-logo.svg';

export const AppHeader = (): JSX.Element => {
	const { isPremium, activePlan } = useSettingsState();

	const planLabels: Record<string, string> = {
		free: __('Free', 'primeplaced-logless-analytics'),
		basic: __('Basic', 'primeplaced-logless-analytics'),
		business: __('Business', 'primeplaced-logless-analytics'),
		agency: __('Agency', 'primeplaced-logless-analytics'),
	};

	const displayPlan = planLabels[activePlan] || activePlan;
	const whiteLabel = window.pplaAdminData?.white_label;
	const name = whiteLabel?.name || __( 'PrimePlaced - Logless Analytics', 'primeplaced-logless-analytics' );
	const logo = whiteLabel?.logo_url || logoUrl;

	return (
		<div className="ppla-settings-header">
			<span className="ppla-settings-header-logo">
				<img src={logo} alt="" width="40" height="40" />
			</span>
			<div className="ppla-settings-header-wrapper">
				<h1>{name}</h1>
				<p>
					{ __(
						'Privacy-first, zero-bloat analytics for your WordPress site.',
						'primeplaced-logless-analytics'
					) }
				</p>
			</div>
			<div
				className={cn(
					'ppla-settings-header-badge',
					isPremium && `is-${activePlan}`
				)}
			>
				{displayPlan}
			</div>
		</div>
	);
};
