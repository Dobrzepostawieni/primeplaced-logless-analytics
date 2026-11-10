import { Button, Dropdown, MenuGroup, MenuItem } from '@wordpress/components';
import { moreVertical } from '@wordpress/icons';

import type { ActionDef } from '../types';

type DataTableActionsCellProps<T> = {
	actions: ActionDef<T>[];
	clearSelection: () => void;
	isMobile: boolean;
	row: T;
};

export const DataTableActionsCell = <T,>({
	actions,
	clearSelection,
	isMobile,
	row,
}: DataTableActionsCellProps<T>) => {
	const renderDropdown = (dropdownActions: ActionDef<T>[]) => (
		<Dropdown
			popoverProps={{
				placement: 'bottom-end',
			}}
			renderToggle={({
				isOpen,
				onToggle,
			}: {
				isOpen: boolean;
				onToggle: () => void;
			}) => (
				<Button
					icon={moreVertical}
					onClick={onToggle}
					aria-expanded={isOpen}
					variant="tertiary"
					className="ppla-button"
				/>
			)}
			renderContent={({ onClose }: { onClose: () => void }) => (
				<div className="ppla-datatable__action-dropdown-content">
					<MenuGroup className="ppla-datatable__action-dropdown-group">
						{dropdownActions.map((action) => (
							<MenuItem
								key={action.id}
								icon={action.icon as JSX.Element}
								isDestructive={action.isDestructive}
								disabled={
									action.isDisabled &&
									action.isDisabled(row)
								}
								onClick={() => {
									action.onClick(row, clearSelection);
									onClose();
								}}
								className="ppla-button is-tertiary"
							>
								{action.label}
							</MenuItem>
						))}
					</MenuGroup>
				</div>
			)}
		/>
	);

	if (isMobile) {
		return renderDropdown(actions);
	}

	const primaryActions = actions.filter((action) => action.isPrimary);
	const secondaryActions = actions.filter((action) => !action.isPrimary);

	return (
		<>
			{primaryActions.map((action) => (
				<span
					className="ppla-datatable__action-primary"
					key={action.id}
				>
					<Button
						variant="tertiary"
						size="compact"
						icon={action.icon as JSX.Element}
						disabled={
							action.isDisabled && action.isDisabled(row)
						}
						isDestructive={action.isDestructive}
						onClick={() => {
							action.onClick(row, clearSelection);
						}}
						className="ppla-button"
					>
						{action.label}
					</Button>
				</span>
			))}
			{secondaryActions.length > 0 && renderDropdown(secondaryActions)}
		</>
	);
};
