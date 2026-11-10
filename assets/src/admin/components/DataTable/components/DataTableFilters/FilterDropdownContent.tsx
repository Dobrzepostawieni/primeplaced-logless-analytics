/**
 * Filter Dropdown Content Component.
 *
 * @package
 */
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	MenuGroup,
	MenuItem,
	TextControl,
	DatePicker,
	TimePicker,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControl as ToggleGroupControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { check } from '@wordpress/icons';
import type { FilterOperator, FilterDef, ActiveFilterState } from '../../types';

export const OPERATOR_LABELS: Record<string, string> = {
	is: __( 'Equals', 'primeplaced-logless-analytics' ),
	isNot: __( 'Not equals', 'primeplaced-logless-analytics' ),
	contains: __( 'Includes', 'primeplaced-logless-analytics' ),
	notContains: __( 'Not includes', 'primeplaced-logless-analytics' ),
	before: __( 'Before', 'primeplaced-logless-analytics' ),
	after: __( 'After', 'primeplaced-logless-analytics' ),
	on: __( 'On', 'primeplaced-logless-analytics' ),
	greater: __( 'More than', 'primeplaced-logless-analytics' ),
	less: __( 'Less than', 'primeplaced-logless-analytics' ),
};

interface FilterDropdownContentProps {
	filterId: string;
	filterDef: FilterDef;
	activeFilter: ActiveFilterState | undefined; 
	onFilterChange: ( id: string, val: string | number | boolean | (string | number)[] | undefined | null, op: FilterOperator ) => void; 
	onClose: () => void;
}

const getNormalizedFilterValues = ( activeFilter: ActiveFilterState | undefined ): string[] => {
	if ( ! activeFilter?.value ) {
		return [];
	}

	if ( Array.isArray( activeFilter.value ) ) {
		return activeFilter.value.map( String );
	}

	return [ String( activeFilter.value ) ];
};

export const FilterDropdownContent = ( {
	filterId,
	filterDef,
	activeFilter,
	onFilterChange,
	onClose,
}: FilterDropdownContentProps ) => {
	const defaultOperator = (filterDef.operators?.[0] as FilterOperator) || 'is';
	
	const [ localOperator, setLocalOperator ] = useState<FilterOperator>(
		(activeFilter?.operator as FilterOperator) || defaultOperator
	);
	
	const [ localValue, setLocalValue ] = useState<string>(
		typeof activeFilter?.value === 'string' ? activeFilter.value : ''
	);

	const handleOperatorChange = ( val: string | number | undefined ) => {
		const op = val as FilterOperator;
		setLocalOperator( op );
		onFilterChange( filterId, activeFilter?.value, op );
	};

	const handleValueChange = ( val: string ) => {
		setLocalValue( val );
		onFilterChange( filterId, val, localOperator);
	};

	const handleDateChange = ( newDate: string | null | undefined ) => {
		const val = newDate ? newDate.split( 'T' )[0] : '';
		setLocalValue( val );
		onFilterChange( filterId, val, localOperator );
	};

	const operatorSelect = filterDef.operators &&
		filterDef.operators.length > 1 && (
			<ToggleGroupControl
				label={__( 'Select an operator', 'primeplaced-logless-analytics' )}
				hideLabelFromVision={true}
				value={localOperator}
				onChange={( val: string | number | undefined ) => handleOperatorChange( val as FilterOperator )}
				isBlock
				className="ppla-datatable__active-filter-select"
				__next40pxDefaultSize
			>
				{filterDef.operators.map( ( op ) => (
					<ToggleGroupControlOption
						key={op}
						value={op}
						label={OPERATOR_LABELS[op] || op}
						showTooltip={false}
					/>
				) )}
			</ToggleGroupControl>
		);

	if ( filterDef.type === 'text' ) {
		return (
			<div className="ppla-datatable__active-filter-dropdown-content">
				{operatorSelect}
				<TextControl
					label={__( 'Value', 'primeplaced-logless-analytics' )}
					hideLabelFromVision
					value={localValue}
					onChange={handleValueChange}
					placeholder={__( 'Type text…', 'primeplaced-logless-analytics' )}
					autoComplete="off"
					data-1p-ignore="true"
					data-lpignore="true"
					__next40pxDefaultSize
					className=""                  
					help={undefined}              
					__nextHasNoMarginBottom={false} 
				/>
			</div>
		);
	}

	if ( filterDef.type === 'date' ) {
		return (
			<div className="ppla-datatable__active-filter-dropdown-content">
				{operatorSelect}
				<TextControl
					type="date"
					label={__( 'Choose a date', 'primeplaced-logless-analytics' )}
					value={localValue}
					onChange={handleValueChange}
					hideLabelFromVision
					__next40pxDefaultSize
					className=""                  
					help={undefined}              
					__nextHasNoMarginBottom={false} 
				/>
				<DatePicker
					currentDate={localValue}
					onChange={handleDateChange}
				/>
			</div>
		);
	}

	if ( filterDef.type === 'duration' ) {
		const currentTotalSeconds = parseInt( localValue, 10 ) || 0;
		const timeObjectValue = {
			hours: Math.floor( currentTotalSeconds / 60 ), 
			minutes: currentTotalSeconds % 60              
		};

		return (
			<div className="ppla-datatable__active-filter-dropdown-content">
				{operatorSelect}
				<TimePicker.TimeInput
					label={__( 'Duration (Minutes : Seconds)', 'primeplaced-logless-analytics' )}
					hideLabelFromVision
					value={timeObjectValue}
					onChange={( nextTime: string | { hours?: string | number; minutes?: string | number } | undefined | null ) => {
						if ( nextTime && typeof nextTime === 'object' ) {
							const h = parseInt( String( nextTime.hours || '0' ), 10 ) || 0;
							const m = parseInt( String( nextTime.minutes || '0' ), 10 ) || 0;
							const totalSeconds = ( h * 60 ) + m;
							
							handleValueChange( String( totalSeconds ) );
						}
					}}
				/>
			</div>
		);
	}

	const currentValues = getNormalizedFilterValues( activeFilter );

	return (
		<div className="ppla-datatable__active-filter-dropdown-content">
			{operatorSelect && <div>{operatorSelect}</div>}
			<MenuGroup>
				{filterDef.options?.map( ( opt ) => {
					const stringOptVal = String( opt.value );
					const isSelected = currentValues.includes( stringOptVal );

					return (
						<MenuItem
							key={stringOptVal}
							icon={isSelected ? check : undefined}
							isDestructive={false}
							onClick={() => {
								let newValues;
								if ( isSelected ) {
									newValues = currentValues.filter(
										( v ) => v !== stringOptVal && v !== ''
									);
								} else {
									newValues = [
										...currentValues.filter(
											( v ) => v !== ''
										),
										stringOptVal,
									];
								}

								onFilterChange(
									filterId,
									newValues,
									localOperator
								);
							}}
						>
							{opt.label}
						</MenuItem>
					);
				} )}
			</MenuGroup>
		</div>
	);
};
