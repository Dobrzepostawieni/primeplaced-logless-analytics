/**
 * Shared selection state for Event Configuration panels and their reports.
 *
 * The Free admin and Pro extensions are compiled into separate bundles. The
 * browser event bridge keeps both bundles in sync without a cross-bundle React
 * context dependency.
 *
 * @package
 */
import { useEffect, useState } from '@wordpress/element';

const panelChangeEvent = 'ppla:event-workspace-panel-change';

interface EventWorkspaceWindow extends Window {
	__pplaEventWorkspacePanel?: string;
}

export interface EventWorkspacePanelStore {
	activePanelId: string;
	selectPanel: ( panelId: string ) => void;
}

const getActivePanelId = (): string => (
	typeof window === 'undefined'
		? ''
		: String( ( window as unknown as EventWorkspaceWindow ).__pplaEventWorkspacePanel || '' )
);

export const selectEventWorkspacePanel = ( panelId: string ): void => {
	if ( typeof window === 'undefined' ) {
		return;
	}

	( window as unknown as EventWorkspaceWindow ).__pplaEventWorkspacePanel = panelId;
	window.dispatchEvent( new CustomEvent<string>( panelChangeEvent, { detail: panelId } ) );
};

export const useEventWorkspacePanel = (): EventWorkspacePanelStore => {
	const [ activePanelId, setActivePanelId ] = useState( getActivePanelId );

	useEffect( () => {
		const handlePanelChange = ( event: Event ): void => {
			setActivePanelId( ( event as CustomEvent<string> ).detail || getActivePanelId() );
		};

		window.addEventListener( panelChangeEvent, handlePanelChange );
		setActivePanelId( getActivePanelId() );

		return () => window.removeEventListener( panelChangeEvent, handlePanelChange );
	}, [] );

	return { activePanelId, selectPanel: selectEventWorkspacePanel };
};
