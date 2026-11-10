import {
	Button,
	Dropdown,
	MenuGroup,
	MenuItem,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalHStack as HStack,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControl as ToggleGroupControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { check, chevronDown, chevronUp } from '@wordpress/icons';
import { useMediaQuery } from '@shared/hooks/useMediaQuery';
import { ExportCsvButton } from './ExportCsvButton';
import { SavedViews } from '@admin/components/SavedViews/SavedViews';
import type { ReportQueryUrlOverrides } from '@admin/components/ReportQuery/reportQueryState';
import type { CsvColumn, ExportRows, RangeOption } from './types';

interface ReportTableActionsProps<T> {
	reportTitle?: string;
	range: number;
	onRangeChange: (range: number) => void;
	isLoading?: boolean;
	csvColumns?: CsvColumn<T>[];
	csvFilename?: string;
	exportRows?: ExportRows<T>;
	/** Rows to export when the report is not rendered by a DataTable. */
	exportData?: T[];
	rangeOptions?: RangeOption[];
	showRange?: boolean;
	savedViewsKey?: string;
	initialUrlRange?: number;
	initialUrlQueryOverrides?: ReportQueryUrlOverrides;
	/** Report-specific actions shown between the export and Saved Views. */
	children?: ReactNode;
}

export interface ReportRangeControlProps {
	range: number;
	onRangeChange: ( range: number ) => void;
	isLoading?: boolean;
	rangeOptions?: RangeOption[];
}

const defaultRangeOptions: RangeOption[] = [
	{
		value: 7,
		label: __('Last 7 days', 'primeplaced-logless-analytics'),
		shortLabel: '7d',
	},
	{
		value: 30,
		label: __('Last 30 days', 'primeplaced-logless-analytics'),
		shortLabel: '30d',
	},
	{
		value: 90,
		label: __('Last 90 days', 'primeplaced-logless-analytics'),
		shortLabel: '90d',
	},
];

const getRangeLabel = (options: RangeOption[], range: number): string => {
	const option = options.find((current) => current.value === range);

	if (option) {
		return option.label;
	}

	return sprintf(
		/* translators: %d: number of days */
		__('Last %d days', 'primeplaced-logless-analytics'),
		range
	);
};

export const ReportRangeControl = ({
	range,
	onRangeChange,
	isLoading = false,
	rangeOptions = defaultRangeOptions,
}: ReportRangeControlProps): JSX.Element => {
	const isMobile = useMediaQuery( '(max-width: 782px)' );

	if ( isMobile ) {
		return (
			<Dropdown
				popoverProps={{ placement: 'bottom-end' }}
				renderToggle={({
					isOpen,
					onToggle,
				}: {
					isOpen: boolean;
					onToggle: () => void;
				}) => (
					<Button
						variant="secondary"
						className="ppla-button"
						onClick={onToggle}
						aria-expanded={isOpen}
						icon={isOpen ? chevronUp : chevronDown}
						disabled={isLoading}
					>
						{getRangeLabel( rangeOptions, range )}
					</Button>
				)}
				renderContent={({ onClose }: { onClose: () => void }) => (
					<MenuGroup>
						{rangeOptions.map( ( option ) => (
							<MenuItem
								key={option.value}
								icon={range === option.value ? check : undefined}
								isDestructive={false}
								onClick={() => {
									onRangeChange( option.value );
									onClose();
								}}
								disabled={isLoading}
							>
								{option.label}
							</MenuItem>
						))}
					</MenuGroup>
				)}
			/>
		);
	}

	return (
		<div className="ppla-toggle-group-control">
			<ToggleGroupControl
				label={__( 'Range', 'primeplaced-logless-analytics' )}
				hideLabelFromVision
				value={range.toString()}
				onChange={( value: string | number | undefined ) => {
					if ( value ) {
						onRangeChange( Number( value ) );
					}
				}}
				__next40pxDefaultSize
				disabled={isLoading}
			>
				{rangeOptions.map( ( option ) => (
					<ToggleGroupControlOption
						key={option.value}
						value={option.value.toString()}
						label={option.shortLabel || option.label}
						showTooltip={false}
					/>
				))}
			</ToggleGroupControl>
		</div>
	);
};

export const ReportTableActions = <T,>({
	reportTitle = __('This report', 'primeplaced-logless-analytics'),
	range,
	onRangeChange,
	isLoading = false,
	csvColumns,
	csvFilename,
	exportRows,
	exportData,
	rangeOptions = defaultRangeOptions,
	showRange = true,
	savedViewsKey,
	initialUrlRange,
	initialUrlQueryOverrides,
	children,
}: ReportTableActionsProps<T>): JSX.Element => {
	const canExport = !!csvColumns && !!csvFilename;

	return (
		<HStack
			spacing={2}
			justify="flex-end"
			alignment="center"
			className="ppla-report-table-actions"
		>
			{showRange && (
				<ReportRangeControl
					range={range}
					onRangeChange={onRangeChange}
					isLoading={isLoading}
					rangeOptions={rangeOptions}
				/>
			)}
			{canExport && (
				<ExportCsvButton<T>
					columns={csvColumns}
					filename={csvFilename}
					storageKey={savedViewsKey}
					reportTitle={reportTitle}
					exportRows={exportRows}
					rows={exportData}
					isLoading={exportData ? isLoading : undefined}
				/>
			)}
			{children}
			{savedViewsKey && (
				<SavedViews
					storageKey={savedViewsKey}
					range={range}
					onRangeChange={onRangeChange}
					reportTitle={reportTitle}
					initialUrlRange={initialUrlRange}
					initialUrlQueryOverrides={initialUrlQueryOverrides}
				/>
			)}
		</HStack>
	);
};
