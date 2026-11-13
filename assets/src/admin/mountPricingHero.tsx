/**
 * Adds the upgrade hero to the Freemius pricing page.
 *
 * Freemius renders its pricing app asynchronously, so the hero is inserted
 * once the "custom implementation" section exists.
 *
 * @package
 */
import { createRoot, useEffect, useState } from '@wordpress/element';
import { Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { UpgradeHeader } from '@shared/components/UpgradeHeader';

const TARGET_SELECTOR = '.fs-section--custom-implementation';
const ROOT_ID = 'ppla-pricing-root';

const PricingHero = (): JSX.Element => {
	const [isCheckoutBlocked, setIsCheckoutBlocked] = useState(false);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			if (typeof (window as { FS?: unknown }).FS === 'undefined') {
				setIsCheckoutBlocked(true);
			}
		}, 1500);

		return () => window.clearTimeout(timer);
	}, []);

	return (
		<>
			{isCheckoutBlocked && (
				<Notice status="warning" isDismissible={false}>
					{__(
						'The checkout could not be loaded. A browser extension or firewall may be blocking Freemius; allow it and reload this page.',
						'primeplaced-logless-analytics'
					)}
				</Notice>
			)}
			<UpgradeHeader context="pricing" />
		</>
	);
};

export const mountPricingHero = (): void => {
	if (!document.getElementById('fs_pricing')) {
		return;
	}

	const inject = (): boolean => {
		const target = document.querySelector(TARGET_SELECTOR);

		if (!target?.parentNode || document.getElementById(ROOT_ID)) {
			return !!target;
		}

		const rootNode = document.createElement('div');
		rootNode.id = ROOT_ID;
		target.parentNode.insertBefore(rootNode, target);
		createRoot(rootNode).render(<PricingHero />);

		return true;
	};

	if (inject()) {
		return;
	}

	const observer = new MutationObserver(() => {
		if (inject()) {
			observer.disconnect();
		}
	});

	observer.observe(document.body, { childList: true, subtree: true });
};
