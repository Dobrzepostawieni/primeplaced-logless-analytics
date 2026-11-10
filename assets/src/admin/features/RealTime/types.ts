import type { MeasurementMeta } from '@shared/types';

export interface RealTimeStat {
	id: string; // Dodajemy ID, którego wymaga nasz DataTable
	url: string;
	device_type: string;
	time_on_page: number; // w sekundach
	source: string;
}

export interface RealTimeApiResponse extends MeasurementMeta {
	success: boolean;
	users_online: number;
	hits: Omit<RealTimeStat, 'id'>[];
	events_history: number[]; // Do wykresu słupkowego na dole (np. tablica 20 intów)
}
