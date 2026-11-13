/**
 * Gradient hero shared by the Upgrade tab and the Freemius pricing page.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { Button, Icon } from '@wordpress/components';
import { starFilled } from '@wordpress/icons';
import {
	PLUGIN_PAGE_URL,
	PRICING_PAGE_URL,
	UPGRADE_TAB_URL,
	openAdminLink,
	openExternalLink,
} from '@shared/utils/links';

export interface UpgradeHeaderProps {
	context?: 'pricing' | 'main';
}

export const UpgradeHeader = ({
	context = 'main',
}: UpgradeHeaderProps): JSX.Element => {
	// The Upgrade tab does not exist on the top plan.
	const canCompare = window.pplaAdminData?.active_plan !== 'agency';

	return (
	<div className="ppla-upgrade-hero is-pro">
		<h2>
			<Icon icon={starFilled} />
			{__(
				'PrimePlaced - Logless Analytics PRO',
				'primeplaced-logless-analytics'
			)}
		</h2>
		<p>
			{__(
				'Get more out of your privacy-first analytics. Longer history, local geolocation, goals, form and store reports, and client-ready exports.',
				'primeplaced-logless-analytics'
			)}
		</p>
		<div className="ppla-upgrade-hero-btns">
			{context === 'pricing' && canCompare && (
				<Button
					variant="tertiary"
					className="ppla-button is-white"
					onClick={() => openAdminLink(UPGRADE_TAB_URL)}
				>
					{__('Compare all features', 'primeplaced-logless-analytics')}
				</Button>
			)}
			{context === 'main' && (
				<>
					<Button
						variant="primary"
						className="ppla-button is-white"
						onClick={() => openAdminLink(PRICING_PAGE_URL)}
					>
						{__(
							'View plans and pricing →',
							'primeplaced-logless-analytics'
						)}
					</Button>
					<Button
						variant="tertiary"
						className="ppla-button is-white"
						onClick={() => openExternalLink(PLUGIN_PAGE_URL)}
					>
						{__('Documentation', 'primeplaced-logless-analytics')}
					</Button>
				</>
			)}
		</div>
	</div>
	);
};
