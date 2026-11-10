import type { ReactNode } from 'react';

export interface ConfirmModalProps {
	isOpen: boolean;
	title: string;
	message: string | ReactNode;
	children?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
	isDestructive?: boolean;
	isConfirming?: boolean;
}
