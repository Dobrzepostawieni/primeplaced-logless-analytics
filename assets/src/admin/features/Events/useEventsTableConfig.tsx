import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import type { ColumnDef } from '@admin/components/DataTable/types';
import type { EventStat } from './types';
import { getEventLabel } from '@shared/utils/eventLabels';
import { formatDecimal, formatNumber } from '@shared/utils/numberFormat';

export const useEventsTableConfig = () => {
	const columns = useMemo<ColumnDef<EventStat>[]>( () => [
		{
			id: 'event_type',
			header: __( 'Event', 'primeplaced-logless-analytics' ),
			sortable: true,
			isFixed: 'left',
			filterBy: {
				type: 'text',
				operators: [ 'contains', 'is', 'isNot' ]
			},
			cell: ( row ) => (
				<span className="ppla-event-contract-label">{getEventLabel( row.event_type )}</span>
			),
		},
		{
			id: 'provider_id',
			header: __( 'Provider', 'primeplaced-logless-analytics' ),
			sortable: true,
			filterBy: {
				type: 'text',
				operators: [ 'contains', 'is', 'isNot' ]
			},
			cell: ( row ) => row.provider_id || '-',
		},
		{
			id: 'total_events',
			header: __( 'Total Count', 'primeplaced-logless-analytics' ),
			sortable: true,
			filterBy: {
				type: 'text',
				operators: [ 'greater', 'less' ]
			},
			cell: ( row ) => formatNumber(row.total_events),
		},
		{
			id: 'total_value',
			header: __( 'Total Value', 'primeplaced-logless-analytics' ),
			sortable: true,
			filterBy: {
				type: 'text',
				operators: [ 'greater', 'less' ]
			},
			cell: ( row ) => formatDecimal(row.total_value, 2),
		}
	], [] );

	return { columns };
};
