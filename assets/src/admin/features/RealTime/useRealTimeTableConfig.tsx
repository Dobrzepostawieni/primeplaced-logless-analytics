/**
 * Configuration hook for the Real-Time DataTable.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import type { ColumnDef } from '@admin/components/DataTable/types';
import { Icon } from '@wordpress/components';
import { desktop, mobile, tablet, link } from '@wordpress/icons';
import { getDeviceLabel } from '@shared/utils/deviceLabels';
import { formatDuration } from '@shared/utils/numberFormat';
import { getSourceLabel } from '@shared/utils/sourceLabels';
import type { RealTimeStat } from './types';

const clockIcon = (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M12 3c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9zm0 16.5c-4.1 0-7.5-3.4-7.5-7.5S7.9 4.5 12 4.5s7.5 3.4 7.5 7.5-3.4 7.5-7.5 7.5zM12 7l-1 5c0 .3.2.6.4.8l4.2 2.8-2.7-4.1L12 7z"></path></svg>
);

const getDeviceIcon = (deviceType: string) => {
	switch (deviceType?.toLowerCase()) {
		case 'mobile':
			return mobile;
		case 'tablet':
			return tablet;
		default:
			return desktop;
	}
};

export const useRealTimeTableConfig = () => {
	const columns: ColumnDef<RealTimeStat>[] = [
		{
			id: 'url',
			header: __( 'Active Page', 'primeplaced-logless-analytics' ),
			filterBy: {
				type: 'text',
				operators: [ 'contains', 'is', 'isNot' ]
			},
			cell: ( row ) => (
				<span className="ppla-datatable__cell-text" style={{ color: '#1e1e1e', fontWeight: 600 }}>
					{row.url}
				</span>
			),
		},
		{
			id: 'source',
			header: __( 'Source', 'primeplaced-logless-analytics' ),
			filterBy: {
				type: 'text',
				operators: [ 'contains', 'is', 'isNot' ]
			},
			cell: ( row ) => (
				<span className="ppla-datatable__cell-text">
					<Icon icon={ link } />
					{getSourceLabel( row.source )}
				</span>
			),
		},
		{
			id: 'time_on_page',
			header: __( 'Duration', 'primeplaced-logless-analytics' ),
			sortable: true,
			filterBy: {
				type: 'duration',
				operators: [ 'less', 'greater' ]
			},
			cell: ( row ) => {
				const seconds = typeof row.time_on_page === 'number' ? row.time_on_page : parseInt( String(row.time_on_page), 10 ) || 0;
				const formatted = formatDuration( seconds );

				return (
					<span className="ppla-datatable__cell-text">
						<Icon icon={ clockIcon } />
						{formatted}
					</span>
				);
			},
		},
		{
			id: 'device_type',
			header: __( 'Device', 'primeplaced-logless-analytics' ),
			filterBy: {
				type: 'select',
				operators: [ 'is', 'isNot' ]
			},
			filterOptions: [
				{ label: __( 'Desktop', 'primeplaced-logless-analytics' ), value: 'desktop' },
				{ label: __( 'Mobile', 'primeplaced-logless-analytics' ), value: 'mobile' },
				{ label: __( 'Tablet', 'primeplaced-logless-analytics' ), value: 'tablet' },
			],
			cell: ( row ) => (
				<span className="ppla-datatable__cell-text">
					<Icon icon={ getDeviceIcon( row.device_type ) } />
					{getDeviceLabel( row.device_type )}
				</span>
			),
		},
	];

	return {
		columns,
	};
};