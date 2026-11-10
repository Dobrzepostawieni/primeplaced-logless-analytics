import { useDispatch } from '@wordpress/data';
import { sprintf } from '@wordpress/i18n';
import { useCallback } from '@wordpress/element';
import { noticeScheme } from './noticesScheme';
import type { NoticeKey } from './types';

type SprintfArgs = [string | number, ...(string | number)[]];
const sprintfDynamic = sprintf as unknown as (
	format: string,
	...args: SprintfArgs
) => string;

/**
 * Custom hook to manage application notices based on a predefined scheme.
 */
export const useNotices = () => {
	const { createNotice, removeNotice } = useDispatch('core/notices');

	const notify = useCallback(
		(
			key: NoticeKey,
			customContentOrArgs?: string | (string | number)[],
			customOptions: Record<string, unknown> = {}
		) => {
			const config = noticeScheme[key];
			if (!config) {
				return;
			}

			let message: string = config.content as unknown as string;

			if (typeof customContentOrArgs === 'string') {
				message = customContentOrArgs;
			} else if (
				Array.isArray(customContentOrArgs) &&
				customContentOrArgs.length > 0
			) {
				const sprintfArgs = customContentOrArgs as SprintfArgs;
				message = sprintfDynamic(message, ...sprintfArgs);
			}

			const noticeId = (customOptions.id as string) || `ppla-notice-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

			createNotice(config.status, message, {
				type: config.type || 'snackbar',
				isDismissible: true,
				id: noticeId, 
				...customOptions,
			});

			setTimeout(() => {
				removeNotice(noticeId);
			}, 'duration' in config ? config.duration : 3000);
		},
		[createNotice, removeNotice]
	);

	return { notify };
};
