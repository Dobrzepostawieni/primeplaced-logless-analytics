import { useEffect, useRef, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { cn } from '@shared/utils/formatting';
import type { KeyboardEvent } from 'react';
import type { AnimatedTabsProps } from './types';

export const AnimatedTabs = ({
	tabs,
	activeTab,
	onTabChange,
}: AnimatedTabsProps): JSX.Element => {
	const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
	const [lineStyle, setLineStyle] = useState({
		left: 0,
		width: 0,
		isReady: false,
	});

	useEffect(() => {
		const updateLinePosition = () => {
			const activeIndex = tabs.findIndex((t) => t.name === activeTab);
			if (activeIndex === -1) return;

			const currentTabElement = tabsRef.current[activeIndex];
			if (currentTabElement) {
				setLineStyle((prev) => ({
					left: currentTabElement.offsetLeft,
					width: currentTabElement.offsetWidth,
					isReady: true,
				}));
			}
		};

		const timeoutId = setTimeout(updateLinePosition, 10);
		window.addEventListener('resize', updateLinePosition);

		return () => {
			clearTimeout(timeoutId);
			window.removeEventListener('resize', updateLinePosition);
		};
	}, [activeTab, tabs]);

	const focusTab = (index: number) => {
		const nextTab = tabs[index];

		if (!nextTab) {
			return;
		}

		onTabChange(nextTab.name);
		tabsRef.current[index]?.focus();
	};

	const handleTabKeyDown = (
		event: KeyboardEvent<HTMLButtonElement>,
		index: number
	) => {
		let nextIndex: number | undefined;

		switch (event.key) {
			case 'ArrowRight':
				nextIndex = (index + 1) % tabs.length;
				break;
			case 'ArrowLeft':
				nextIndex = (index - 1 + tabs.length) % tabs.length;
				break;
			case 'Home':
				nextIndex = 0;
				break;
			case 'End':
				nextIndex = tabs.length - 1;
				break;
			default:
				return;
		}

		event.preventDefault();
		focusTab(nextIndex);
	};

	return (
		<div className="ppla-animated-tabs">
			<div
				className="ppla-animated-tabs__list"
				role="tablist"
				aria-label={__(
					'Analytics sections',
					'primeplaced-logless-analytics'
				)}
			>
				<div
					className={cn(
						'ppla-animated-tabs__line',
						lineStyle.isReady && 'is-ready'
					)}
					style={
						{
							'--ppla-tab-left': `${lineStyle.left}px`,
							'--ppla-tab-width': `${lineStyle.width}px`,
						} as React.CSSProperties
					}
				/>
				{tabs.map((tab, index) => (
					<Button
						key={tab.name}
						ref={(el: HTMLButtonElement | null) => {
							tabsRef.current[index] = el;
						}}
						className={cn(
							'ppla-animated-tabs__button',
							tab.className,
							activeTab === tab.name && 'is-active'
						)}
						onClick={() => onTabChange(tab.name)}
						onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) =>
							handleTabKeyDown(event, index)
						}
						role="tab"
						id={`ppla-tab-${tab.name}`}
						aria-controls={`ppla-tabpanel-${tab.name}`}
						aria-selected={activeTab === tab.name}
						aria-label={tab.label}
						title={tab.label}
						tabIndex={activeTab === tab.name ? 0 : -1}
					>
						{tab.title}
					</Button>
				))}
			</div>
		</div>
	);
};
