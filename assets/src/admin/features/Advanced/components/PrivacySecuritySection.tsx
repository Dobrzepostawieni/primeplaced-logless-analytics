/**
 * Privacy & Security Section Component.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useRef, useState, useEffect } from '@wordpress/element';
import { Card, CardBody, CardHeader, Button } from '@wordpress/components';
import { shield } from '@wordpress/icons';
import { cn } from '@shared/utils/formatting';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import { useApi } from '@shared/api/useApi';
import { useNotices } from '@shared/components/Notices';
import { ConfirmModal } from '@admin/components/ConfirmModal';
import { useSettingsStateContext, useSettingsDispatch } from '@shared/contexts';
import { PplaToggler } from '@shared/components/PplaToggler/PplaToggler';

export const PrivacySecuritySection = ( { title, isActive, spyRef, className }: StickySectionProps ): JSX.Element => {
	const cardRef = useRef<HTMLDivElement>( null );
	const [ isRotating, setIsRotating ] = useState( false );
	const [ isRotateModalOpen, setIsRotateModalOpen ] = useState( false );

	const { fetchApi } = useApi();
	const { notify } = useNotices();
	const { settings, isSaving, isLoading } = useSettingsStateContext();
	const { autosaveSettings } = useSettingsDispatch();

	const trustProxyHeaders = settings?.trust_proxy_headers ?? false;

	useEffect( () => {
		if ( spyRef && cardRef.current ) {
			spyRef( cardRef.current );
		}
	}, [ spyRef ] );

	const confirmSaltRotation = async () => {
		setIsRotating( true );
		try {
			await fetchApi( { path: '/ppla/v1/tools/rotate-salt', method: 'POST' } );
			notify( 'SALT_ROTATION_SUCCESS' );
			setIsRotateModalOpen( false );
		} catch ( error ) {
			notify( 'SALT_ROTATION_ERROR' );
			setIsRotateModalOpen( false );
		} finally {
			setIsRotating( false );
		}
	};

	return (
		<>
			<Card className={cn( 'ppla-settings-card', className, isActive && 'ppla-is-active' )} ref={cardRef}>
				<CardHeader className="ppla-settings-card-header">
					<h2>{title}</h2>
				</CardHeader>
				<CardBody className="ppla-settings-card-body">
					
					<div className="ppla-settings-card-headings">
						<h3 className="ppla-settings-card-heading">{__( 'Reverse Proxy IP Headers', 'primeplaced-logless-analytics' )}</h3>
						<p className="ppla-settings-card-description">
							{__( 'Enable this if your WordPress installation is behind a reverse proxy (e.g. Cloudflare, AWS ELB, NGINX) to safely resolve real visitor IP addresses and prevent analytics poisoning.', 'primeplaced-logless-analytics' )}
						</p>
					</div>

					<PplaToggler
						hasBorder
						isLoading={isLoading}
						isSaving={isSaving}
						label={__( 'Trust proxy headers (X-Forwarded-For, CF-Connecting-IP)', 'primeplaced-logless-analytics' )}
						checked={trustProxyHeaders}
						onChange={( val: boolean ) => void autosaveSettings( { trust_proxy_headers: val } )}
					/>

					<div className="ppla-settings-card-headings" style={{ marginTop: '24px' }}>
						<h3 className="ppla-settings-card-heading">{__( 'Manual Salt Rotation', 'primeplaced-logless-analytics' )}</h3>
						<p className="ppla-settings-card-description">
							{__( 'For privacy reasons, cryptographic salts used to generate session hashes are automatically destroyed at midnight. You can force an immediate rotation if needed.', 'primeplaced-logless-analytics' )}
						</p>
					</div>
					<Button
						variant="secondary"
						isDestructive
						icon={shield}
						isBusy={isRotating}
						disabled={isRotating}
						onClick={() => setIsRotateModalOpen( true )}
						className="ppla-button"
					>
						{__( 'Rotate salt now', 'primeplaced-logless-analytics' )}
					</Button>
				</CardBody>
			</Card>

			<ConfirmModal
				isOpen={isRotateModalOpen}
				title={__( 'Rotate Cryptographic Salt', 'primeplaced-logless-analytics' )}
				message={__( 'This will force all current visitor sessions to reset immediately. Are you sure?', 'primeplaced-logless-analytics' )}
				confirmLabel={__( 'Rotate now', 'primeplaced-logless-analytics' )}
				onConfirm={confirmSaltRotation}
				onCancel={() => setIsRotateModalOpen( false )}
				isConfirming={isRotating}
				isDestructive={true}
			/>
		</>
	);
};
