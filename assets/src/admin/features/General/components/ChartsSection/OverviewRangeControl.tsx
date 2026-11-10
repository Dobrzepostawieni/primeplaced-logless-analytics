/**
 * Period selector shared by the Overview cards, charts and daily table.
 *
 * @package
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControl as ToggleGroupControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	SelectControl,
} from '@wordpress/components';
import { useMediaQuery } from '@shared/hooks/useMediaQuery';
import { REPORT_RANGE_OPTIONS } from '@admin/features/Reports/reportNavigation';
import { useChartsData } from './useChartsData';

const getDaysLabel = ( days: number ): string =>
	sprintf(
		/* translators: %d: number of days. */
		_n( '%d day', '%d days', days, 'primeplaced-logless-analytics' ),
		days
	);

export const OverviewRangeControl = (): JSX.Element => {
	const { range, setRange } = useChartsData();
	const isMobile = useMediaQuery( '(max-width: 782px)' );
	const label = __( 'Period', 'primeplaced-logless-analytics' );

	if ( isMobile ) {
		return (
			<div className="ppla-overview-range">
				<SelectControl
					label={ label }
					value={ String( range ) }
					options={ REPORT_RANGE_OPTIONS.map( ( days ) => ( {
						label: getDaysLabel( days ),
						value: String( days ),
					} ) ) }
					onChange={ ( value: string ) => setRange( Number( value ) ) }
					__next40pxDefaultSize
					__nextHasNoMarginBottom
				/>
			</div>
		);
	}

	return (
		<div className="ppla-toggle-group-control ppla-overview-range">
			<ToggleGroupControl
				label={ label }
				value={ String( range ) }
				onChange={ ( value: string | number | undefined ) => {
					if ( value ) {
						setRange( Number( value ) );
					}
				} }
				isBlock={ false }
				__next40pxDefaultSize
				__nextHasNoMarginBottom
			>
				{ REPORT_RANGE_OPTIONS.map( ( days ) => (
					<ToggleGroupControlOption
						key={ days }
						value={ String( days ) }
						label={ getDaysLabel( days ) }
						showTooltip={ false }
					/>
				) ) }
			</ToggleGroupControl>
		</div>
	);
};

