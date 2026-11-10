import { useSelect, useDispatch } from '@wordpress/data';
import { SnackbarList } from '@wordpress/components';
import { useEffect, createPortal } from '@wordpress/element';
import type { Notice, NoticesProps } from './types';
import { cn } from '@shared/utils/formatting';

const MAX_VISIBLE_NOTICES = 10;

type NoticesSelector = {
	getNotices: () => Notice[];
};

export const Notices = ({ context }: NoticesProps): JSX.Element | null => {
	const notices = useSelect((select) => {
		return (select('core/notices') as NoticesSelector).getNotices();
	}, []);

	const { removeNotice } = useDispatch('core/notices');

	useEffect(() => {
		if (!notices || notices.length <= MAX_VISIBLE_NOTICES) return;

		let noticeToRemove = notices.find((n) => n.status !== 'error');
		if (!noticeToRemove) noticeToRemove = notices[0];

		if (noticeToRemove) removeNotice(noticeToRemove.id);
	}, [notices, removeNotice]);

	if (!notices || notices.length === 0) return null;

	const styledNotices = notices.map((notice) => {
		const prefix = context ? 'PrimePlaced - Logless Analytics: ' : '';

		return {
			...notice,
			content: `${prefix}${notice.content}`,
			explicitDismiss: true,
			className: cn(
				notice.className,
				`is-${notice.status}`,
				`is-${notice.type}`,
				'ppla-notice'
			),
		};
	});

	return createPortal(
		<div className="ppla-notices-portal-root">
			<SnackbarList
				notices={styledNotices}
				className="ppla-snackbar-list"
				onRemove={removeNotice}
			/>
		</div>,
		document.body
	);
};
