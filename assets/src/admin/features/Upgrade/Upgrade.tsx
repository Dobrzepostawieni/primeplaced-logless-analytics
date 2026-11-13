/**
 * Upgrade tab: the features of every plan above the active one.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { Button, Card, CardBody, Icon } from '@wordpress/components';
import { useAppState } from '@shared/contexts';
import { UpgradeHeader } from '@shared/components/UpgradeHeader';
import {
	PLUGIN_PAGE_URL,
	PRICING_PAGE_URL,
	openAdminLink,
	openExternalLink,
} from '@shared/utils/links';
import { getReportPlanLabel } from '@features/Reports/reportCatalog';
import { PRO_FEATURES } from './proFeatures';

export const PLAN_WEIGHTS: Record<string, number> = {
	free: 0,
	basic: 1,
	business: 2,
	agency: 3,
};

export const Upgrade = (): JSX.Element => {
	const { pplaData } = useAppState();
	const currentPlanWeight = PLAN_WEIGHTS[pplaData.active_plan] ?? 0;

	const visibleFeatures = PRO_FEATURES.filter(
		(feature) => PLAN_WEIGHTS[feature.plan] > currentPlanWeight
	);

	return (
		<>
			<UpgradeHeader />

			<Card className="ppla-settings-card">
				<CardBody className="ppla-pro-feature-grid">
					{visibleFeatures.map((feature) => (
						<div
							key={`${feature.plan}-${feature.title}`}
							className={`ppla-pro-feature-card is-${feature.plan}`}
						>
							<div className="ppla-pro-feature-card-icon">
								<Icon icon={feature.icon} />
							</div>
							<span className="ppla-pro-feature-card-badge">
								{getReportPlanLabel(feature.plan)}
							</span>
							<h3 className="ppla-pro-feature-card-title">
								{feature.title}
							</h3>
							<p className="ppla-pro-feature-card-description">
								{feature.description}
							</p>
						</div>
					))}
				</CardBody>
			</Card>

			<Card className="ppla-settings-card">
				<CardBody className="ppla-upgrade-footer">
					<div className="ppla-upgrade-footer-header">
						<h4>
							{__('Ready for more?', 'primeplaced-logless-analytics')}
						</h4>
						<p>
							{__(
								'Compare the Basic, Business and Agency plans and pick the one that fits your site.',
								'primeplaced-logless-analytics'
							)}
						</p>
					</div>

					<div className="ppla-upgrade-footer-actions">
						<Button
							variant="primary"
							className="ppla-button is-pro"
							onClick={() => openAdminLink(PRICING_PAGE_URL)}
						>
							{__('View pricing →', 'primeplaced-logless-analytics')}
						</Button>
						<Button
							variant="tertiary"
							className="ppla-button"
							onClick={() => openExternalLink(PLUGIN_PAGE_URL)}
						>
							{__('Documentation', 'primeplaced-logless-analytics')}
						</Button>
					</div>
				</CardBody>
			</Card>
		</>
	);
};
