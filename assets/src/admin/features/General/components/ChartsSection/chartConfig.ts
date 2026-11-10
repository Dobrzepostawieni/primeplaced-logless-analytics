/**
 * Shared configuration for Chart.js instances.
 *
 * @package
 */
import { useState, useEffect } from '@wordpress/element';
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	ArcElement,
	Title,
	Tooltip,
	Legend,
	Filler,
} from 'chart.js';

ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	ArcElement,
	Title,
	Tooltip,
	Legend,
	Filler
);

const prefersReducedMotion =
	typeof window !== 'undefined' &&
	typeof window.matchMedia === 'function' &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const chartAnimation: false | { duration: number; easing: 'easeInOutQuart' } =
	prefersReducedMotion
		? false
		: {
				duration: 750,
				easing: 'easeInOutQuart',
			};

export const COMMON_CHART_OPTIONS = {
	// Axis numbers follow the admin language (WordPress sets <html lang>).
	locale:
		( typeof document !== 'undefined' && document.documentElement.lang ) ||
		'en-US',
	responsive: true,
	maintainAspectRatio: false,
	animation: chartAnimation,
	plugins: {
		tooltip: {
			backgroundColor: '#1e293b',
			padding: 12,
			titleFont: {
				size: 13,
				family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
			},
			bodyFont: {
				size: 13,
				family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
			},
			cornerRadius: 6,
			displayColors: true,
		},
	},
};

/**
 * Hook to trigger chart animations smoothly after initial load finishes.
 */
export const useChartAnimation = (isInitialLoad: boolean) => {
	const [shouldAnimate, setShouldAnimate] = useState(false);

	useEffect(() => {
		if (!isInitialLoad) {
			if (prefersReducedMotion) {
				setShouldAnimate(true);
				return;
			}

			const timer = setTimeout(() => setShouldAnimate(true), 50);
			return () => clearTimeout(timer);
		}
	}, [isInitialLoad]);

	return shouldAnimate;
};
