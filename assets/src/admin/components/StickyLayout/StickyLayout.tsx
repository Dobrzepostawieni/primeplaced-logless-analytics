import type { DragEvent, ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import {
	Card,
	CardBody,
	CardHeader,
	CardFooter,
	Button,
	Icon,
	Tooltip,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalHStack as HStack,
} from '@wordpress/components';
import {
	chevronDown,
	chevronRight,
	chevronUp,
	cog,
	dragHandle,
	reset,
} from '@wordpress/icons';
import { useMemo, useState, Fragment, createContext, useEffect } from '@wordpress/element';
import { useSettingsStateContext } from '@shared/contexts';
import { cn } from '@shared/utils/formatting';
import { useScrollSpy } from './useScrollSpy';
import { ConfirmModal } from '../ConfirmModal';
import type { StickyLayoutProps, StickyLayoutSectionSize } from './types';
import { useMediaQuery } from '@shared/hooks/useMediaQuery';
import { useMasonryLayoutPreferences } from './useMasonryLayoutPreferences';


// Core and Pro are separate bundles, so a plain createContext() would give Pro
// sections their own context that never receives the sticky header target.
// Share one instance through window, as DataTableContext does.
const STICKY_ACTIONS_KEY = 'pplaStickyActionsContext_v1';
const contextRegistry = window as unknown as Record<string, unknown>;

if (!contextRegistry[STICKY_ACTIONS_KEY]) {
	contextRegistry[STICKY_ACTIONS_KEY] = createContext<HTMLDivElement | null>(null);
}

export const StickyActionsContext = contextRegistry[STICKY_ACTIONS_KEY] as React.Context<HTMLDivElement | null>;

const masonrySizeOptions: Array<{
	label: string;
	size: StickyLayoutSectionSize;
}> = [
	{
		label: __('1 col', 'primeplaced-logless-analytics'),
		size: 'standard',
	},
	{
		label: __('2 col', 'primeplaced-logless-analytics'),
		size: 'wide',
	},
	{
		label: __('Full', 'primeplaced-logless-analytics'),
		size: 'full',
	},
];

export const StickyLayout = ({
	title,
	sections,
	beforeSections,
	headerActions,
	onSave,
	onDiscard,
	className,
	layout = 'stack',
	layoutStorageKey,
}: StickyLayoutProps) => {
	const { isDirty, isSaving } = useSettingsStateContext();
	const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
	const [splitSectionId, setSplitSectionId] = useState(sections[0]?.id || '');
	const [expandedGroup, setExpandedGroup] = useState(sections[0]?.group || 'other-settings');
	const [selectedGroup, setSelectedGroup] = useState(sections[0]?.group || 'other-settings');
	const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
	const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
	const [isCustomizingLayout, setIsCustomizingLayout] = useState(false);
	const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
	const isMobile = useMediaQuery('(max-width: 782px)');
	const shouldUseSectionContext = layout === 'stack';
	const canCustomizeMasonry = layout === 'masonry' && !!layoutStorageKey;
	const {
		orderedSections,
		preferences,
		getSectionLayoutClassName,
		setSectionSize,
		moveSection,
		moveSectionByOffset,
		resetLayout,
	} = useMasonryLayoutPreferences({
		enabled: canCustomizeMasonry,
		sections,
		storageKey: layoutStorageKey,
	});

	const {
		activeSection: scrollActiveSection,
		registerSection,
		headerRef,
		isTopSticky,
		isBottomSticky,
		topSentinelRef,
		bottomSentinelRef,
	} = useScrollSpy();
	const activeSection = layout === 'split' ? splitSectionId : scrollActiveSection;

	useEffect(() => {
		if ( layout === 'split' && ! sections.some( ( section ) => section.id === splitSectionId ) ) {
			setSplitSectionId( sections[0]?.id || '' );
			setExpandedGroup( sections[0]?.group || 'other-settings' );
		}
		if ( layout === 'grouped' && ! sections.some( ( section ) => ( section.group || 'other-settings' ) === selectedGroup ) ) {
			setSelectedGroup( sections[0]?.group || 'other-settings' );
		}
	}, [ layout, sections, selectedGroup, splitSectionId ]);

	useEffect(() => {
		if ( ! highlightedSectionId || typeof window === 'undefined' ) {
			return undefined;
		}

		const timeoutId = window.setTimeout( () => setHighlightedSectionId( null ), 5000 );
		return () => window.clearTimeout( timeoutId );
	}, [ highlightedSectionId ] );

	const selectSplitSection = ( sectionId: string, shouldHighlight = false ) => {
		const section = sections.find( ( candidate ) => candidate.id === sectionId );
		if ( ! section ) {
			return;
		}

		setSplitSectionId( sectionId );
		setExpandedGroup( section.group || 'other-settings' );
		if ( shouldHighlight ) {
			setHighlightedSectionId( sectionId );
		}
	};

	useEffect(() => {
		if ( typeof window === 'undefined' ) {
			return;
		}

		const selectSectionFromHash = () => {
			let sectionId = '';
			try {
				sectionId = decodeURIComponent( window.location.hash.replace( /^#ppla-section-/, '' ) );
			} catch ( error ) {
				return;
			}
			if ( sections.some( ( section ) => section.id === sectionId ) ) {
				if ( layout === 'split' ) {
					selectSplitSection( sectionId, true );
					return;
				}
				if ( layout === 'grouped' ) {
					setSelectedGroup( sections.find( ( section ) => section.id === sectionId )?.group || 'other-settings' );
				}

				setHighlightedSectionId( sectionId );
			}
		};

		selectSectionFromHash();
		window.addEventListener( 'hashchange', selectSectionFromHash );
		window.addEventListener( 'popstate', selectSectionFromHash );

		return () => {
			window.removeEventListener( 'hashchange', selectSectionFromHash );
			window.removeEventListener( 'popstate', selectSectionFromHash );
		};
	}, [ layout, sections ] );

	const sectionTitles = useMemo(() => {
		const titles: Record<string, ReactNode> = {};
		sections.forEach((sec) => {
			titles[sec.id] = sec.title;
		});
		return titles;
	}, [sections]);

	const splitSectionGroups = useMemo(() => {
		const groups = new Map<string, { title: string; sections: typeof sections }>();
		sections.forEach( ( section ) => {
			const groupId = section.group || 'other-settings';
			const groupTitle = section.group || __( 'Other settings', 'primeplaced-logless-analytics' );
			const existing = groups.get( groupId );
			if ( existing ) {
				existing.sections.push( section );
				return;
			}
			groups.set( groupId, { title: groupTitle, sections: [ section ] } );
		} );
		return Array.from( groups.entries() ).map( ( [ id, group ] ) => ( { id, ...group } ) );
	}, [ sections ] );

	const activeSectionActions = useMemo(() => {
		if (!activeSection) return null;
		const current = sections.find((s) => s.id === activeSection);
		return current?.headerActions || null;
	}, [activeSection, sections]);

	const executeDiscard = () => {
		if (onDiscard) {
			onDiscard();
		}
		setIsDiscardModalOpen(false);
	};

	const handleDragStart = (event: DragEvent<HTMLDivElement>, sectionId: string) => {
		setDraggedSectionId(sectionId);
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', sectionId);
	};

	const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
		if (isCustomizingLayout) {
			event.preventDefault();
			event.dataTransfer.dropEffect = 'move';
		}
	};

	const handleDrop = (event: DragEvent<HTMLDivElement>, targetSectionId: string) => {
		event.preventDefault();
		const sourceSectionId = event.dataTransfer.getData('text/plain') || draggedSectionId;

		if (sourceSectionId) {
			moveSection(sourceSectionId, targetSectionId);
		}

		setDraggedSectionId(null);
	};

	const renderLayoutControls = (Section: typeof sections[number]) => {
		if (!isCustomizingLayout) {
			return null;
		}

		return (
			<div className="ppla-masonry-layout-controls">
				<div className="ppla-masonry-layout-controls__move">
					<Tooltip text={__('Drag to reorder', 'primeplaced-logless-analytics')}>
						<Button
							variant="tertiary"
							icon={dragHandle}
							label={__('Drag to reorder', 'primeplaced-logless-analytics')}
							className="ppla-button ppla-masonry-layout-controls__drag"
						/>
					</Tooltip>
					<Tooltip text={__('Move up', 'primeplaced-logless-analytics')}>
						<Button
							variant="tertiary"
							icon={chevronUp}
							label={__('Move up', 'primeplaced-logless-analytics')}
							onClick={() => moveSectionByOffset(Section.id, -1)}
							className="ppla-button"
						/>
					</Tooltip>
					<Tooltip text={__('Move down', 'primeplaced-logless-analytics')}>
						<Button
							variant="tertiary"
							icon={chevronDown}
							label={__('Move down', 'primeplaced-logless-analytics')}
							onClick={() => moveSectionByOffset(Section.id, 1)}
							className="ppla-button"
						/>
					</Tooltip>
				</div>
				<div className="ppla-masonry-layout-controls__sizes" aria-label={__('Section width', 'primeplaced-logless-analytics')}>
					{masonrySizeOptions.map((option) => (
						<Button
							key={option.size}
							variant="tertiary"
							isPressed={preferences.sizes[Section.id] === option.size}
							onClick={() => setSectionSize(Section.id, option.size)}
							className="ppla-button"
						>
							{option.label}
						</Button>
					))}
				</div>
			</div>
		);
	};

	// The grouped grid has at most two columns. A standard card that would sit
	// alone in its row (before a wide card or at the end) takes the full row
	// instead of leaving an empty half.
	const withFilledRows = (groupSections: typeof sections) => {
		const isFullRow = (Section: typeof sections[number]) =>
			/\bppla-masonry-(wide|full)\b/.test(Section.layoutClassName || '');
		const fillIds = new Set<string>();
		let openRowId: string | null = null;

		groupSections.forEach((Section) => {
			if (isFullRow(Section)) {
				if (openRowId) {
					fillIds.add(openRowId);
				}
				openRowId = null;
				return;
			}
			openRowId = openRowId ? null : Section.id;
		});
		if (openRowId) {
			fillIds.add(openRowId);
		}

		return groupSections.map((Section) =>
			fillIds.has(Section.id)
				? { ...Section, layoutClassName: cn(Section.layoutClassName, 'ppla-masonry-full') }
				: Section
		);
	};

	const renderSectionComponent = (Section: typeof sections[number]) => (
		<Section.component
			key={Section.id}
			title={Section.title}
			isActive={layout === 'split' || layout === 'grouped' ? false : activeSection === Section.id}
			spyRef={layout === 'split' ? undefined : registerSection(Section.id)}
			className={cn(
				className,
				'ppla-sticky-layout-section',
				`ppla-sticky-section-${ Section.id }`,
				layout === 'split' && 'ppla-sticky-layout-section--split',
				layout === 'masonry' && 'ppla-sticky-layout-section--masonry',
				highlightedSectionId === Section.id && 'ppla-sticky-layout-section--focused',
				layout === 'masonry' ? undefined : Section.layoutClassName
			)}
			headerActions={Section.headerActions}
		/>
	);

	const renderSplitLayout = () => (
		<div className="ppla-sticky-layout-split">
			<nav
				className="ppla-sticky-layout-split__nav"
				aria-label={__('Settings sections', 'primeplaced-logless-analytics')}
			>
				<div className="ppla-sticky-layout-split__nav-list">
					{splitSectionGroups.map( ( group ) => {
						const isExpanded = expandedGroup === group.id;
						const groupPanelId = `ppla-settings-group-${ group.id.replace( /[^a-z0-9]+/gi, '-' ).toLowerCase() }`;

						return (
							<div key={group.id} className="ppla-sticky-layout-split__nav-group">
								<button
									type="button"
									className="ppla-sticky-layout-split__nav-group-toggle"
									aria-controls={groupPanelId}
									aria-expanded={isExpanded}
									onClick={() => setExpandedGroup( isExpanded ? '' : group.id )}
								>
									<span>{group.title}</span>
									<Icon icon={isExpanded ? chevronDown : chevronRight} size={18} aria-hidden="true" />
								</button>
								{isExpanded && (
									<div id={groupPanelId} className="ppla-sticky-layout-split__nav-group-items">
										{group.sections.map((section) => {
											const isSelected = splitSectionId === section.id;

											return (
												<button
													key={section.id}
													type="button"
													className={cn(
														'ppla-sticky-layout-split__nav-item',
														isSelected && 'is-selected'
													)}
													aria-current={isSelected ? 'page' : undefined}
													onClick={() => selectSplitSection(section.id)}
												>
													<span>{section.title}</span>
													<Icon icon={chevronRight} size={18} aria-hidden="true" />
												</button>
											);
										})}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</nav>
			<div className="ppla-sticky-layout-split__content">
				{sections
					.filter((section) => section.id === splitSectionId)
					.map(renderSectionComponent)}
			</div>
		</div>
	);

	const renderGroupedLayout = () => {
		const group = splitSectionGroups.find( ( candidate ) => candidate.id === selectedGroup ) || splitSectionGroups[0];

		if ( ! group ) {
			return null;
		}

		return (
			<Card className="ppla-sticky-layout-grouped-card">
				<CardHeader className="ppla-settings-card-header ppla-sticky-layout-grouped-card__header">
					<h2>
						<span className="ppla-breadcrumb-title">{title}</span>
						<Icon icon={chevronRight} size={20} className="ppla-breadcrumb-icon" />
						<span className="ppla-active-section">{group.title}</span>
					</h2>
				</CardHeader>
				<CardBody className="ppla-sticky-layout-grouped-card__body">
			<div className="ppla-sticky-layout-grouped">
				<nav
					className="ppla-sticky-layout-grouped__nav"
					aria-label={__( 'Settings groups', 'primeplaced-logless-analytics')}
				>
					{splitSectionGroups.map( ( candidate ) => {
						const isSelected = candidate.id === group.id;

						return (
							<button
								key={candidate.id}
								type="button"
								className={cn(
									'ppla-sticky-layout-grouped__nav-item',
									isSelected && 'is-selected'
								)}
								aria-current={isSelected ? 'page' : undefined}
								onClick={() => setSelectedGroup(candidate.id)}
							>
								{candidate.title}
							</button>
						);
					})}
				</nav>
				<div className="ppla-sticky-layout-grouped__content">
					<div className="ppla-sticky-layout-grouped__sections">
						{withFilledRows(group.sections).map(renderSectionComponent)}
					</div>
				</div>
			</div>
				</CardBody>
			</Card>
		);
	};

	const renderSection = (Section: typeof sections[number]) => {
		if (layout !== 'masonry') {
			return renderSectionComponent(Section);
		}

		return (
			<div
				key={Section.id}
				className={cn(
					'ppla-masonry-layout-item',
					getSectionLayoutClassName(Section),
					isCustomizingLayout && 'is-customizing',
					draggedSectionId === Section.id && 'is-dragging'
				)}
				draggable={isCustomizingLayout}
				onDragStart={(event) => handleDragStart(event, Section.id)}
				onDragOver={handleDragOver}
				onDrop={(event) => handleDrop(event, Section.id)}
				onDragEnd={() => setDraggedSectionId(null)}
			>
				{renderLayoutControls(Section)}
				{renderSectionComponent(Section)}
			</div>
		);
	};

	const renderLayout = () => {
		if (layout === 'split') {
			return renderSplitLayout();
		}

		if (layout === 'grouped') {
			return renderGroupedLayout();
		}

		if (layout === 'masonry') {
			return (
				<div className={cn('ppla-sticky-layout-masonry', isCustomizingLayout && 'is-customizing')}>
					{orderedSections.map(renderSection)}
				</div>
			);
		}

		return sections.map(renderSection);
	};

	return (
		<StickyActionsContext.Provider value={shouldUseSectionContext ? portalTarget : null}>
			<div
				ref={topSentinelRef}
				style={{
					height: '1px',
					width: '100%',
					pointerEvents: 'none',
					transform: 'translateY(-16px)',
					marginBottom: '-24px',
				}}
			/>

			{layout !== 'grouped' && <Card
				className={cn(
					'ppla-sticky-layout-top',
					layout === 'masonry' && 'ppla-sticky-layout-top--masonry',
					layout === 'stack' && 'ppla-sticky-layout-top--stack',
					className,
					isTopSticky && 'ppla-is-sticky'
				)}
				ref={headerRef}
			>
				<CardHeader className="ppla-settings-card-header ppla-sticky-header">
					<h2>
						{(!shouldUseSectionContext ||
							!isMobile ||
							!activeSection ||
							!sectionTitles[activeSection]) && (
							<span className="ppla-breadcrumb-title">
								{title}
							</span>
						)}
						{shouldUseSectionContext && activeSection && sectionTitles[activeSection] && (
							<Fragment key={`title-${activeSection}`}>
								<Icon
									icon={chevronRight}
									size={20}
									className="ppla-breadcrumb-icon"
								/>
								<span className="ppla-active-section">
									{sectionTitles[activeSection]}
								</span>
							</Fragment>
						)}
					</h2>
					<div className="ppla-sticky-layout-actions">
						{isSaving && <div className="ppla-spinner" />}
						
						{headerActions && (
							<div className="ppla-sticky-global-actions">
								{headerActions}
							</div>
						)}

						{canCustomizeMasonry && (
							<div className="ppla-sticky-layout-customize-actions">
								{isCustomizingLayout && (
									<Button
										variant="tertiary"
										icon={reset}
										onClick={resetLayout}
										className="ppla-button"
									>
										{__('Reset layout', 'primeplaced-logless-analytics')}
									</Button>
								)}
								<Button
									variant={isCustomizingLayout ? 'primary' : 'secondary'}
									icon={cog}
									onClick={() => setIsCustomizingLayout(!isCustomizingLayout)}
									className="ppla-button"
								>
									{isCustomizingLayout
										? __('Done', 'primeplaced-logless-analytics')
										: __('Customize layout', 'primeplaced-logless-analytics')}
								</Button>
							</div>
						)}
						
						{shouldUseSectionContext && activeSection && (
							<div key={`actions-${activeSection}`} ref={setPortalTarget} className="ppla-sticky-section-actions">
								{activeSectionActions}
							</div>
						)}
					</div>
				</CardHeader>
			</Card>}
			{beforeSections}

			{renderLayout()}

			{onSave && (isDirty || isSaving) && (
				<Card
					className={cn(
						className,
						'ppla-sticky-layout-bottom',
						isBottomSticky && 'ppla-is-sticky'
					)}
				>
					<CardFooter>
						<HStack justify="flex-end" spacing={3}>
							{onDiscard && isDirty && (
								<Button
									variant="tertiary"
									onClick={() => setIsDiscardModalOpen(true)}
									disabled={isSaving}
									className="ppla-button"
								>
									{__(
										'Cancel',
										'primeplaced-logless-analytics'
									)}
								</Button>
							)}
							<Button
								variant="primary"
								onClick={onSave}
								isBusy={isSaving}
								disabled={isSaving || !isDirty}
								className="ppla-button"
							>
								{__(
									'Save changes',
									'primeplaced-logless-analytics'
								)}
							</Button>
						</HStack>
					</CardFooter>
				</Card>
			)}

			<ConfirmModal
				isOpen={isDiscardModalOpen}
				title={__('Canceling changes', 'primeplaced-logless-analytics')}
				message={__(
					'Are you sure you want to undo all unsaved changes? The form will be restored to the last saved state.',
					'primeplaced-logless-analytics'
				)}
				confirmLabel={__(
					'Yes, undo changes',
					'primeplaced-logless-analytics'
				)}
				cancelLabel={__(
					'Return to Edit',
					'primeplaced-logless-analytics'
				)}
				onConfirm={executeDiscard}
				onCancel={() => setIsDiscardModalOpen(false)}
				isDestructive={true}
			/>

			{onSave && (
				<div
					ref={bottomSentinelRef}
					style={{
						height: '1px',
						width: '100%',
						pointerEvents: 'none',
						transform: 'translateY(-16px)',
						marginTop: '-24px',
					}}
				/>
			)}
		</StickyActionsContext.Provider>
	);
};
