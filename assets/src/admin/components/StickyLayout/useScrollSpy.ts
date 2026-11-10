import { useState, useEffect, useRef, useCallback } from '@wordpress/element';

export const useScrollSpy = () => {
	const [activeSection, setActiveSection] = useState<string | null>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const sectionRefs = useRef<Map<Element, string>>(new Map());

	const [isTopSticky, setIsTopSticky] = useState(false);
	const [isBottomSticky, setIsBottomSticky] = useState(false);

	const topSentinelRef = useRef<HTMLDivElement>(null);
	const bottomSentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleScroll = () => {
			if (!headerRef.current || sectionRefs.current.size === 0) return;

			const headerRect = headerRef.current.getBoundingClientRect();
			const headerTop = headerRect.top + 24;
			const headerBottom = headerRect.bottom + 24;

			let currentActive: string | null = null;

			sectionRefs.current.forEach((title, element) => {
				const cardRect = element.getBoundingClientRect();

				if (
					cardRect.top <= headerTop &&
					cardRect.bottom > headerBottom
				) {
					currentActive = title;
				}
			});

			if (window.scrollY < 50) {
				currentActive = null;
			}

			setActiveSection((prev) => {
				if (prev !== currentActive) {
					return currentActive;
				}
				return prev;
			});
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		handleScroll();

		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	useEffect(() => {
		const topObserver = new IntersectionObserver(
			([entry]) => {
				setIsTopSticky(
					!entry.isIntersecting && entry.boundingClientRect.top < 50
				);
			},
			{ threshold: 0, rootMargin: '-32px 0px 0px 0px' }
		);

		if (topSentinelRef.current) {
			topObserver.observe(topSentinelRef.current);
		}

		const bottomObserver = new IntersectionObserver(
			([entry]) => {
				setIsBottomSticky(
					!entry.isIntersecting && entry.boundingClientRect.top > 0
				);
			},
			{ threshold: 0, rootMargin: '0px 0px 0px 0px' }
		);

		if (bottomSentinelRef.current) {
			bottomObserver.observe(bottomSentinelRef.current);
		}

		return () => {
			topObserver.disconnect();
			bottomObserver.disconnect();
		};
	}, []);

	const registerSection = useCallback(
		(title: string) => (element: Element | null) => {
			if (element && !sectionRefs.current.has(element)) {
				sectionRefs.current.set(element, title);
			}
		},
		[]
	);

	return {
		activeSection,
		registerSection,
		headerRef,
		isTopSticky,
		isBottomSticky,
		topSentinelRef,
		bottomSentinelRef,
	};
};
