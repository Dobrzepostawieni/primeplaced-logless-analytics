import { Button } from '@wordpress/components';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { dragHandle } from '@wordpress/icons';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';

import { cn } from '@shared/utils/formatting';


interface ResizableReportSplitProps {
	table: ReactNode;
	aside: ReactNode;
	storageKey?: string;
	defaultTableWidth?: number;
	minTableWidth?: number;
	maxTableWidth?: number;
}

const STORAGE_PREFIX = 'ppla_report_split_';

const clamp = (value: number, min: number, max: number): number =>
	Math.min(Math.max(value, min), max);

const readStoredWidth = (
	storageKey: string | undefined,
	defaultTableWidth: number,
	minTableWidth: number,
	maxTableWidth: number
): number => {
	if (!storageKey || typeof window === 'undefined') {
		return defaultTableWidth;
	}

	try {
		const storedValue = window.localStorage.getItem(
			`${STORAGE_PREFIX}${storageKey}`
		);
		// `Number(null)` is 0, which would clamp every first visit to the
		// minimum width instead of the default.
		const storedWidth = null === storedValue ? NaN : Number(storedValue);

		return Number.isFinite(storedWidth) && storedWidth > 0
			? clamp(storedWidth, minTableWidth, maxTableWidth)
			: defaultTableWidth;
	} catch (error) {
		return defaultTableWidth;
	}
};

export const ResizableReportSplit = ({
	table,
	aside,
	storageKey,
	defaultTableWidth = 62,
	minTableWidth = 38,
	maxTableWidth = 76,
}: ResizableReportSplitProps): JSX.Element => {
	const splitRef = useRef<HTMLDivElement>(null);
	const [tableWidth, setTableWidth] = useState(() =>
		readStoredWidth(
			storageKey,
			defaultTableWidth,
			minTableWidth,
			maxTableWidth
		)
	);
	const [isDragging, setIsDragging] = useState(false);

	const updateWidth = useCallback(
		(clientX: number) => {
			const splitElement = splitRef.current;
			if (!splitElement) {
				return;
			}

			const bounds = splitElement.getBoundingClientRect();
			const nextWidth = ((clientX - bounds.left) / bounds.width) * 100;

			setTableWidth(clamp(nextWidth, minTableWidth, maxTableWidth));
		},
		[minTableWidth, maxTableWidth]
	);

	useEffect(() => {
		if (!storageKey || typeof window === 'undefined') {
			return;
		}

		try {
			window.localStorage.setItem(
				`${STORAGE_PREFIX}${storageKey}`,
				String(Math.round(tableWidth))
			);
		} catch (error) {
			// A private browsing quota error should not interrupt the report.
		}
	}, [storageKey, tableWidth]);

	useEffect(() => {
		if (!isDragging) {
			return;
		}

		const handlePointerMove = (event: globalThis.PointerEvent) => {
			event.preventDefault();
			updateWidth(event.clientX);
		};
		const handlePointerUp = () => setIsDragging(false);

		window.addEventListener('pointermove', handlePointerMove);
		window.addEventListener('pointerup', handlePointerUp);
		document.body.classList.add('ppla-is-resizing-report');

		return () => {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', handlePointerUp);
			document.body.classList.remove('ppla-is-resizing-report');
		};
	}, [isDragging, updateWidth]);

	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		let nextWidth: number | null = null;

		switch (event.key) {
			case 'ArrowLeft':
				nextWidth = tableWidth - 5;
				break;
			case 'ArrowRight':
				nextWidth = tableWidth + 5;
				break;
			case 'Home':
				nextWidth = minTableWidth;
				break;
			case 'End':
				nextWidth = maxTableWidth;
				break;
			default:
				return;
		}

		event.preventDefault();
		setTableWidth(clamp(nextWidth, minTableWidth, maxTableWidth));
	};

	const chartWidth = Math.round(100 - tableWidth);
	const widthLabel = sprintf(
		/* translators: 1: table width percentage, 2: chart width percentage. */
		__('%1$d%% table, %2$d%% chart', 'primeplaced-logless-analytics'),
		Math.round(tableWidth),
		chartWidth
	);
	const splitStyle = {
		'--ppla-resizable-table-width': `${tableWidth}%`,
	} as CSSProperties;

	return (
		<div
			ref={splitRef}
			className={cn(
				'ppla-resizable-report-split',
				isDragging && 'is-dragging'
			)}
			style={splitStyle}
		>
			<div className="ppla-resizable-report-split__panel ppla-resizable-report-split__table">
				{table}
			</div>
			<Button
				type="button"
				icon={dragHandle}
				className="ppla-resizable-report-split__handle"
				label={__('Resize table and chart', 'primeplaced-logless-analytics')}
				showTooltip
				role="separator"
				aria-orientation="vertical"
				aria-valuemin={minTableWidth}
				aria-valuemax={maxTableWidth}
				aria-valuenow={Math.round(tableWidth)}
				aria-valuetext={widthLabel}
				onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
					event.preventDefault();
					setIsDragging(true);
				}}
				onKeyDown={handleKeyDown}
			/>
			<aside className="ppla-resizable-report-split__panel ppla-resizable-report-split__aside">
				{aside}
			</aside>
		</div>
	);
};
