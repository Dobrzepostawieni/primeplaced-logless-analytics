import { useState, useCallback, useEffect } from '@wordpress/element';
import { useApi } from '@shared/api/useApi';
import { useInterval } from '@shared/hooks/useInterval';
import { useAppState } from '@shared/contexts';
import type { RealTimeStat, RealTimeApiResponse } from './types';

export const useRealTimeStats = () => {
	const { fetchApi } = useApi();
	const { dataRefreshKey } = useAppState();
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [usersOnline, setUsersOnline] = useState<number>(0);
	const [hits, setHits] = useState<RealTimeStat[]>([]);
	const [eventsHistory, setEventsHistory] = useState<number[]>([]);
	const [hasError, setHasError] = useState(false);
	const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
	const [measurementReason, setMeasurementReason] = useState('no_data_yet');

	const loadData = useCallback(async () => {
		setIsLoading(true);

		try {
			const response = await fetchApi<RealTimeApiResponse>({
				path: '/ppla/v1/dashboard/realtime',
				method: 'GET',
			});

			if (response?.success) {
				setMeasurementReason(response.measurement_reason || 'data_current');
				const mappedHits = response.hits.map((hit, i) => ({
					...hit,
					id: `rt-${i}-${hit.url}`,
				}));

				setUsersOnline(response.users_online);
				setHits(mappedHits);
				setEventsHistory(response.events_history || []);
				setHasError(false);
				setLastUpdatedAt(Date.now());
			} else {
				setHasError(true);
			}
		} catch {
			setHasError(true);
		} finally {
			setIsLoading(false);
		}
	}, [fetchApi]);

	useEffect(() => {
		void loadData();
	}, [loadData, dataRefreshKey]);

	useInterval(() => {
		if (document.hidden) {
			return;
		}

		void loadData();
	}, 30000);

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				void loadData();
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			document.removeEventListener(
				'visibilitychange',
				handleVisibilityChange
			);
		};
	}, [loadData]);

	return {
		isLoading,
		hasError,
		lastUpdatedAt,
		usersOnline,
		hits,
		eventsHistory,
		measurementReason,
		retry: loadData,
	};
};
