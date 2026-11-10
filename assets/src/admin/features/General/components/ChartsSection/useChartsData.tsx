import { __ } from '@wordpress/i18n';
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from '@wordpress/element';
import type { ReactNode } from 'react';

import { useApi } from '@shared/api/useApi';
import { useAppState } from '@shared/contexts';
import type { ChartsApiResponse, DevicesData, TrafficData } from './types';
import {
	getReportRangeFromUrl,
	REPORT_RANGE_QUERY,
} from '@admin/features/Reports/reportNavigation';

interface ChartsDataContextValue {
	range: number;
	setRange: (range: number) => void;
	trafficData: TrafficData[];
	devicesData?: DevicesData;
	privacyMode: 'strict_anonymous' | 'session_hash';
	measurementReason: string;
	isInitialLoad: boolean;
	isFetching: boolean;
	hasError: boolean;
	retry: () => void;
}

const ChartsDataContext = createContext<ChartsDataContextValue | null>(null);

export const getTrafficEmptyMessage = (
	reason: string,
	hasError: boolean
): string => {
	if (hasError) {
		return __(
			'Traffic data could not be loaded. Try again to refresh this report.',
			'primeplaced-logless-analytics'
		);
	}

	if (reason === 'buffer_pending') {
		return __(
			'Traffic is waiting for the next aggregation.',
			'primeplaced-logless-analytics'
		);
	}

	return __(
		'No traffic data is available for this range yet.',
		'primeplaced-logless-analytics'
	);
};

interface ChartsDataProviderProps {
	children: ReactNode;
}

export const ChartsDataProvider = ({
	children,
}: ChartsDataProviderProps): JSX.Element => {
	const { fetchApi } = useApi();
	const { dataRefreshKey } = useAppState();

	const [range, setRangeState] = useState(() => getReportRangeFromUrl());
	// Keep the period in the address so a link reopens the same view.
	const setRange = useCallback((nextRange: number) => {
		setRangeState(nextRange);
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.set(REPORT_RANGE_QUERY, String(nextRange));
			window.history.replaceState(window.history.state, '', url);
		}
	}, []);
	const [retryKey, setRetryKey] = useState(0);
	const [isInitialLoad, setIsInitialLoad] = useState(true);
	const [isFetching, setIsFetching] = useState(true);
	const [hasError, setHasError] = useState(false);
	const [trafficData, setTrafficData] = useState<TrafficData[]>([]);
	const [devicesData, setDevicesData] = useState<DevicesData>();
	const [privacyMode, setPrivacyMode] = useState<
		'strict_anonymous' | 'session_hash'
	>('strict_anonymous');
	const [measurementReason, setMeasurementReason] =
		useState('no_data_yet');

	const retry = useCallback(() => {
		setRetryKey((current) => current + 1);
	}, []);

	useEffect(() => {
		let isMounted = true;

		const loadChartsData = async () => {
			setIsFetching(true);

			try {
				const response = await fetchApi<ChartsApiResponse>({
					path: `/ppla/v1/dashboard/charts?range=${range}`,
					method: 'GET',
				});

				if (isMounted && response?.success) {
					setTrafficData(response.traffic);
					setDevicesData(response.devices);
					setPrivacyMode(response.privacy_mode ?? 'strict_anonymous');
					setMeasurementReason(
						response.measurement_reason ?? 'no_data_yet'
					);
					setHasError(false);
				} else if (isMounted) {
					setHasError(true);
				}
			} catch {
				if (isMounted) {
					setHasError(true);
				}
			} finally {
				if (isMounted) {
					setIsFetching(false);
					setIsInitialLoad(false);
				}
			}
		};

		void loadChartsData();

		return () => {
			isMounted = false;
		};
	}, [dataRefreshKey, fetchApi, range, retryKey]);

	return (
		<ChartsDataContext.Provider
			value={{
				range,
				setRange,
				trafficData,
				devicesData,
				privacyMode,
				measurementReason,
				isInitialLoad,
				isFetching,
				hasError,
				retry,
			}}
		>
			{children}
		</ChartsDataContext.Provider>
	);
};

export const useChartsData = (): ChartsDataContextValue => {
	const context = useContext(ChartsDataContext);

	if (!context) {
		throw new Error('useChartsData must be used within ChartsDataProvider');
	}

	return context;
};
