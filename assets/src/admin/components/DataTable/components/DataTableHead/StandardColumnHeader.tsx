import { __ } from '@wordpress/i18n';
import {
	Button,
	Dropdown,
	Icon,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalHStack as HStack,
} from '@wordpress/components';
import { arrowUp, arrowDown } from '@wordpress/icons';
import { cn } from '@shared/utils/formatting';
import type { ColumnDef } from '../../types';
import { useDataTableContext } from '../../DataTableContext';
import { ColumnDropdownMenu } from './ColumnDropdownMenu';

type DropdownRenderProps = {
	isOpen: boolean;
	onToggle: () => void;
	onClose: () => void;
};

export const StandardColumnHeader = <T,>({
	column,
	idx,
}: {
	column: ColumnDef<T>;
	idx: number;
}) => {
	const { totalItems, sortBy, sortDirection } = useDataTableContext<T>();

	if (totalItems === 0) {
		return (
			<th
				className={cn(
					column.headerClassName,
					column.isFixed === 'left' &&
						'ppla-datatable__head-fixed-left',
					column.hideOnMobile && 'ppla-hide-on-mobile'
				)}
				scope="col"
			>
				<span>{column.header}</span>
			</th>
		);
	}

	return (
		<th
			className={cn(
				column.headerClassName,
				column.isFixed === 'left' && 'ppla-datatable__head-fixed-left',
				sortBy === column.id && `ppla-sorted-${sortDirection}`,
				column.hideOnMobile && 'ppla-hide-on-mobile'
			)}
			scope="col"
		>
			<Dropdown
				popoverProps={{ placement: 'bottom-start' }}
				renderToggle={({ isOpen, onToggle }: DropdownRenderProps) => (
					<Button
						className={cn(
							'ppla-datatable__head-btn',
							isOpen && 'is-open'
						)}
						onClick={onToggle}
						aria-expanded={isOpen}
						variant="tertiary"
					>
						<HStack spacing={1}>
							<span>{column.header}</span>
							{sortBy === column.id && (
								<Icon
									icon={
										sortDirection === 'asc'
											? arrowUp
											: arrowDown
									}
									size={16}
									className="ppla-datatable__head-sort-icon"
								/>
							)}
						</HStack>
					</Button>
				)}
				renderContent={({ onClose }: DropdownRenderProps) => (
					<ColumnDropdownMenu<T>
						column={column}
						columnIndex={idx}
						closeDropdown={onClose}
					/>
				)}
			/>
		</th>
	);
};
