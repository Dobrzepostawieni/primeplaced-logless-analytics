/**
 * Types and interfaces for the Notices component and hook.
 */

/**
 * Internal dependencies
 */
import { noticeScheme } from './noticesScheme';

/**
 * Automatically generated type representing all valid notice keys from the scheme.
 */
export type NoticeKey = keyof typeof noticeScheme;

/**
 * Represents a single notice object from the WordPress core data store.
 */
export interface Notice {
	/** Unique identifier for the notice. */
	id: string;
	/** The severity level of the notice. */
	status: 'success' | 'info' | 'warning' | 'error';
	/** The actual message displayed to the user. */
	content: string;
	/** Whether the user can manually close the notice. */
	isDismissible?: boolean;
	/** Optional CSS class added to the notice wrapper. */
	className?: string;
	/** The display type, usually 'default' or 'snackbar'. */
	type?: string;
}

/**
 * Properties for the Notices component.
 */
export interface NoticesProps {
	/** Optional prefix string applied to all notices rendered by this instance. */
	context?: string;
}

/**
 * Interface representing the structure of a single notice in the scheme.
 */
export interface NoticeConfiguration {
	status: 'success' | 'info' | 'warning' | 'error';
	content: string;
	type?: string;
	/** Milliseconds before the notice is removed; defaults to 3000. */
	duration?: number;
}
