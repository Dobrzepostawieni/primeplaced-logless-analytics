/**
 * API Wrapper Hook.
 * Handles nonce injection and global error catching.
 *
 * @package
 */
import { useCallback, useRef } from '@wordpress/element';
import apiFetch, { type APIFetchOptions } from '@wordpress/api-fetch';
import { useNotices } from '@shared/components/Notices/useNotices';

let isSessionDead = false;

type ApiFetchError = {
	code?: string;
	status?: number;
	data?: {
		status?: number;
	};
};

const SESSION_EXPIRED_MESSAGE =
	'PPLA: Session expired. Blocked outgoing request.';

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const isAuthFailure = (error: unknown): boolean => {
	if (!isObject(error)) {
		return false;
	}

	const apiError = error as ApiFetchError;
	const status = apiError.status ?? apiError.data?.status;

	return (
		apiError.code === 'rest_cookie_invalid_nonce' ||
		status === 403 ||
		status === 401
	);
};

const triggerWpAuthCheck = (): void => {
	window.jQuery?.(document).trigger('heartbeat-tick.wp-auth-check', [
		{ 'wp-auth-check': false },
	]);
};

if (typeof window !== 'undefined' && window.jQuery) {
	window.jQuery(document).on('heartbeat-tick.wp-auth-check', () => {
		isSessionDead = false;
	});
}

apiFetch.use((options, next) => {
	if (isSessionDead) {
		return Promise.reject(new Error(SESSION_EXPIRED_MESSAGE));
	}
	return next(options).catch((error: unknown) => {
		if (isAuthFailure(error)) {
			if (!isSessionDead) {
				isSessionDead = true;
				triggerWpAuthCheck();
			}
		}
		throw error;
	});
});

/**
 * Returns the plugin REST client with nonce injection and session handling.
 */
export function useApi() {
	const { notify } = useNotices();
	const hasFatalError = useRef(isSessionDead);

	const fetchApi = useCallback(
		async <T>(options: Omit<APIFetchOptions<true>, 'parse'>): Promise<T> => {
			if (isSessionDead || hasFatalError.current) {
				return Promise.reject(new Error(SESSION_EXPIRED_MESSAGE));
			}

			try {
				let path = options.path;

				if (path && (!options.method || options.method.toUpperCase() === 'GET')) {
					const separator = path.includes('?') ? '&' : '?';
					path = `${path}${separator}_t=${Date.now()}`;
				}

				const fetchOptions: APIFetchOptions<true> = {
					...options,
					path,
					headers: {
						'X-WP-Nonce': window.pplaAdminData?.nonce || '',
						...options.headers,
					},
				};
				return await apiFetch<T>(fetchOptions);
			} catch (error: unknown) {
				if (isSessionDead && !hasFatalError.current) {
					hasFatalError.current = true;
					notify('SETTINGS_SESSION_TIMEOUT');
				}
				throw error;
			}
		},
		[notify]
	);

	return { fetchApi, hasFatalError };
}
