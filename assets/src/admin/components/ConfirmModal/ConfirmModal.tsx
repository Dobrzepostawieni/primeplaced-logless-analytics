import { __ } from '@wordpress/i18n';
import { Modal, Button } from '@wordpress/components';
import type { ConfirmModalProps } from './types';

export const ConfirmModal = ({
	isOpen,
	title,
	message,
	children,
	confirmLabel = __( 'Approve', 'primeplaced-logless-analytics'),
	cancelLabel = __( 'Cancel', 'primeplaced-logless-analytics'),
	onConfirm,
	onCancel,
	isDestructive = true,
	isConfirming = false,
}: ConfirmModalProps) => {
	if (!isOpen) {
		return null;
	}

	const handleRequestClose = () => {
		if (isConfirming) return;
		onCancel();
	};

	return (
		<Modal
			title={title}
			onRequestClose={handleRequestClose}
			shouldCloseOnClickOutside={!isConfirming}
			shouldCloseOnEsc={!isConfirming}
			className="ppla-confirmation-modal ppla-modal"
		>
			<div className="ppla-confirmation-modal__body">
				<p className="ppla-confirmation-modal__text">{message}</p>
				{children}
				<div className="ppla-modal-footer">
					<div className="ppla-modal-footer-actions">
						<Button
							variant="tertiary"
							onClick={handleRequestClose}
							disabled={isConfirming}
							className="ppla-button"
						>
							{cancelLabel}
						</Button>
						<Button
							variant="primary"
							isDestructive={isDestructive}
							onClick={onConfirm}
							isBusy={isConfirming}
							disabled={isConfirming}
							className="ppla-button"
						>
							{confirmLabel}
						</Button>
					</div>
				</div>
			</div>
		</Modal>
	);
};
