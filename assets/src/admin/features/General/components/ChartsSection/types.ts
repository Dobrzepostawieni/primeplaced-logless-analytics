/**
 * Types for the Charts module.
 *
 * @package
 */

import type { MeasurementMeta } from '@shared/types';

export interface TrafficData {
	id?: string;
	date: string;
	date_iso: string;
	visits: number;
	pageviews: number;
}

export interface DevicesData {
	desktop: number;
	mobile: number;
	tablet: number;
}

export interface ChartsApiResponse extends MeasurementMeta {
	success: boolean;
	range: number;
	privacy_mode?: 'strict_anonymous' | 'session_hash';
	traffic: TrafficData[];
	devices: DevicesData;
}
