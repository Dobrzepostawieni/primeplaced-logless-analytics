export interface RangeOption {
	label: string;
	value: number;
	shortLabel?: string;
}

export interface CsvColumn<T> {
	header: string;
	value: ( row: T ) => string | number | boolean | null | undefined;
}

export interface ExportProgress {
	completed: number;
	total: number;
}

export type ExportRows<T> = ( onProgress?: ( progress: ExportProgress ) => void ) => Promise<T[]>;
