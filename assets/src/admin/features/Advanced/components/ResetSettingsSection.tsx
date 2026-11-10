/**
 * Safe settings reset with a short undo window.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import { Button, Card, CardBody, CardHeader, Notice } from '@wordpress/components';
import { useApi } from '@shared/api/useApi';
import { useNotices } from '@shared/components/Notices';
import { useSettingsDispatch } from '@shared/contexts';
import { ConfirmModal } from '@admin/components/ConfirmModal';
import { cn } from '@shared/utils/formatting';
import type { StickySectionProps } from '@admin/components/StickyLayout';

interface ResetResponse {
	success?: boolean;
	undo_token?: string;
}

export const ResetSettingsSection = ( { title, spyRef, isActive, className }: StickySectionProps ) => {
	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ isWorking, setIsWorking ] = useState( false );
	const [ undoToken, setUndoToken ] = useState<string | null>( null );
	const { fetchApi } = useApi();
	const { notify } = useNotices();
	const { refetch } = useSettingsDispatch();

	const resetSettings = async () => {
		setIsWorking( true );
		try {
			const response = await fetchApi<ResetResponse>( {
				path: '/ppla/v1/settings/reset',
				method: 'POST',
				data: {},
			} );
			setUndoToken( response.undo_token || null );
			setIsModalOpen( false );
			await refetch();
			notify( 'SETTINGS_RESET_SUCCESS' );
		} catch ( error ) {
			notify( 'SETTINGS_RESET_ERROR' );
		} finally {
			setIsWorking( false );
		}
	};

	const undoReset = async () => {
		if ( ! undoToken ) return;
		setIsWorking( true );
		try {
			await fetchApi( {
				path: '/ppla/v1/settings/undo-reset',
				method: 'POST',
				data: { token: undoToken },
			} );
			setUndoToken( null );
			await refetch();
			notify( 'SETTINGS_RESET_UNDO_SUCCESS' );
		} catch ( error ) {
			notify( 'SETTINGS_RESET_ERROR' );
		} finally {
			setIsWorking( false );
		}
	};

	return (
		<Card className={cn( 'ppla-settings-card', className, isActive && 'ppla-is-active' )} ref={spyRef}>
			<CardHeader className="ppla-settings-card-header">
				<h2>{title}</h2>
			</CardHeader>
			<CardBody className="ppla-settings-card-body ppla-settings-card-body--padded ppla-reset-settings-section">
				<p>{__( 'Restore every setting to the defaults for the active plugin edition. Analytics data and custom event history are not deleted.', 'primeplaced-logless-analytics' )}</p>
				<div className="ppla-reset-settings-section__actions">
					<Button variant="secondary" isDestructive onClick={() => setIsModalOpen( true )} disabled={isWorking}>
						{__( 'Reset settings', 'primeplaced-logless-analytics' )}
					</Button>
					{undoToken && (
						<Button variant="tertiary" onClick={() => void undoReset()} disabled={isWorking} isBusy={isWorking}>
							{__( 'Undo reset', 'primeplaced-logless-analytics' )}
						</Button>
					)}
				</div>
				{undoToken && (
					<Notice status="info" isDismissible={false}>
						{__( 'The previous settings are available through Undo for about one minute.', 'primeplaced-logless-analytics' )}
					</Notice>
				)}
			</CardBody>
			<ConfirmModal
				isOpen={isModalOpen}
				title={__( 'Reset all settings?', 'primeplaced-logless-analytics' )}
				message={__( 'This replaces your current configuration with the active defaults. Your analytics data is kept. You can undo the settings change for a short time after confirming.', 'primeplaced-logless-analytics' )}
				confirmLabel={__( 'Reset settings', 'primeplaced-logless-analytics' )}
				cancelLabel={__( 'Keep current settings', 'primeplaced-logless-analytics' )}
				onConfirm={() => void resetSettings()}
				onCancel={() => setIsModalOpen( false )}
				isConfirming={isWorking}
			/>
		</Card>
	);
};
