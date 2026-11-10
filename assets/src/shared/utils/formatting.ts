import clsx, { type ClassValue } from 'clsx';

/**
 * @param inputs
 * @return
 */
export function cn(...inputs: ClassValue[]): string {
	return clsx(...inputs);
}

/**
 * Decodes a stored percent-encoded path for display only; stored values,
 * filters and copied URLs keep the encoded form.
 *
 * @param path Stored URL path.
 * @return Human-readable path, or the input when it is not valid encoding.
 */
export function formatPathForDisplay(path: string): string {
	try {
		return decodeURI(path);
	} catch {
		return path;
	}
}
