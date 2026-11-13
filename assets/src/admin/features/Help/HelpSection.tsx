/**
 * Help tab: questions grouped by dashboard area, plus support links.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useMemo, useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import {
	Button,
	Card,
	CardBody,
	CardHeader,
	Panel,
	PanelBody,
	PanelRow,
} from '@wordpress/components';
import { comment, envelope, group, page } from '@wordpress/icons';
import { useAppState } from '@shared/contexts';
import { cn } from '@shared/utils/formatting';
import {
	CONTACT_URL,
	PLUGIN_PAGE_URL,
	SUPPORT_FORUM_URL,
	openExternalLink,
} from '@shared/utils/links';
import type { SettingsComponentProps } from '@admin/components/AnimatedTabs';
import {
	StickyLayout,
	type StickySectionDef,
	type StickySectionProps,
} from '@admin/components/StickyLayout';
import { getReportPlanLabel } from '@features/Reports/reportCatalog';
import { FREE_FAQS, TAG_ORDER, type FaqItem } from './faqData';

const renderFaqTitle = (item: FaqItem): JSX.Element | string => {
	if (item.tier === 'free') {
		return item.question;
	}

	return (
		<span className="ppla-help-panels-item">
			{item.question}
			<span className={`ppla-help-panels-badge is-${item.tier}`}>
				{getReportPlanLabel(item.tier)}
			</span>
		</span>
	);
};

const FaqPanelGroup = ({ items }: { items: FaqItem[] }): JSX.Element => {
	const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({});

	return (
		<Panel className="ppla-panel ppla-panel--help">
			{items.map((item) => (
				<PanelBody
					key={item.id}
					// PanelBody renders any node as its title; only its typing is string-only.
					title={renderFaqTitle(item) as unknown as string}
					opened={!!openPanels[item.id]}
					onToggle={() =>
						setOpenPanels((prev) => ({
							...prev,
							[item.id]: !prev[item.id],
						}))
					}
					className={`is-${item.tier}`}
				>
					<PanelRow>
						<p>{item.answer}</p>
					</PanelRow>
				</PanelBody>
			))}
		</Panel>
	);
};

const sectionId = (tag: string): string =>
	`faq-${tag.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

export const HelpSection = ({ className }: SettingsComponentProps) => {
	const { proLoaded } = useAppState();

	const tagLabels = useMemo<Record<string, string>>(
		() => ({
			Overview: __('Overview', 'primeplaced-logless-analytics'),
			Reports: __('Report Library', 'primeplaced-logless-analytics'),
			'Traffic & Content': __(
				'Traffic & Content',
				'primeplaced-logless-analytics'
			),
			'Events & Goals': __(
				'Events & Goals',
				'primeplaced-logless-analytics'
			),
			'Real-Time': __('Real-Time', 'primeplaced-logless-analytics'),
			Privacy: __('Privacy', 'primeplaced-logless-analytics'),
			Settings: __('Settings', 'primeplaced-logless-analytics'),
			'Agency tools': __('Agency tools', 'primeplaced-logless-analytics'),
		}),
		[]
	);

	const faqsByTag = useMemo(() => {
		const faqs = applyFilters('ppla.ui.HelpFaqs', [
			...FREE_FAQS,
		]) as FaqItem[];

		return faqs.reduce<Record<string, FaqItem[]>>((acc, item) => {
			const tag = item.tag || 'Settings';
			(acc[tag] = acc[tag] || []).push(item);
			return acc;
		}, {});
		// The Pro bundle registers its questions before proLoaded flips.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [proLoaded]);

	const sections = useMemo<StickySectionDef[]>(() => {
		const knownTags = TAG_ORDER as readonly string[];
		const tags = [
			...knownTags.filter((tag) => faqsByTag[tag]?.length),
			...Object.keys(faqsByTag).filter((tag) => !knownTags.includes(tag)),
		];

		const faqSections: StickySectionDef[] = tags.map((tag) => ({
			id: sectionId(tag),
			title: tagLabels[tag] || tag,
			component: ({
				title,
				isActive,
				spyRef,
				className: sectionClass,
			}: StickySectionProps) => (
				<Card
					className={cn(sectionClass, isActive && 'ppla-is-active')}
					ref={spyRef}
				>
					<CardHeader className="ppla-settings-card-header">
						<h2>{title}</h2>
					</CardHeader>
					<CardBody className="ppla-settings-card-body">
						<FaqPanelGroup items={faqsByTag[tag]} />
					</CardBody>
				</Card>
			),
		}));

		const linksSection: StickySectionDef = {
			id: 'help-links',
			title: __('Useful Links', 'primeplaced-logless-analytics'),
			component: ({
				title,
				isActive,
				spyRef,
				className: sectionClass,
			}: StickySectionProps) => (
				<Card
					className={cn(sectionClass, isActive && 'ppla-is-active')}
					ref={spyRef}
				>
					<CardHeader className="ppla-settings-card-header">
						<h2>{title}</h2>
					</CardHeader>
					<CardBody className="ppla-help-links">
						<Button
							variant="tertiary"
							icon={page}
							href={PLUGIN_PAGE_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="ppla-button"
						>
							{__('Documentation', 'primeplaced-logless-analytics')}
						</Button>
						<Button
							variant="tertiary"
							icon={group}
							href={SUPPORT_FORUM_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="ppla-button"
						>
							{__('Support Forum', 'primeplaced-logless-analytics')}
						</Button>
						<Button
							variant="tertiary"
							icon={envelope}
							href={CONTACT_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="ppla-button"
						>
							{__('Contact', 'primeplaced-logless-analytics')}
						</Button>
					</CardBody>
				</Card>
			),
		};

		const feedbackSection: StickySectionDef = {
			id: 'help-feedback',
			title: __('Feedback', 'primeplaced-logless-analytics'),
			component: ({
				title,
				isActive,
				spyRef,
				className: sectionClass,
			}: StickySectionProps) => (
				<Card
					className={cn(
						sectionClass,
						'ppla-feedback-card is-pro',
						isActive && 'ppla-is-active'
					)}
					ref={spyRef}
				>
					<CardHeader className="ppla-settings-card-header">
						<h2>{title}</h2>
					</CardHeader>
					<CardBody className="ppla-settings-card-body">
						<h3 className="ppla-feedback-card-title">
							💡{' '}
							{__(
								'Have an idea for a new feature?',
								'primeplaced-logless-analytics'
							)}
						</h3>
						<p className="ppla-feedback-card-desc">
							{__(
								'Your feedback is very important to us!',
								'primeplaced-logless-analytics'
							)}
						</p>
						<Button
							variant="primary"
							icon={comment}
							className="ppla-button is-pro"
							onClick={() => openExternalLink(SUPPORT_FORUM_URL)}
						>
							{__('Send feedback', 'primeplaced-logless-analytics')}
						</Button>
					</CardBody>
				</Card>
			),
		};

		return [...faqSections, linksSection, feedbackSection];
	}, [faqsByTag, tagLabels]);

	return (
		<StickyLayout
			title={__('Help and Support', 'primeplaced-logless-analytics')}
			sections={sections}
			className={className}
		/>
	);
};
