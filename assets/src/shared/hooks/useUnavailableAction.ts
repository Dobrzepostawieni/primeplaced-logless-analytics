import { useCallback } from '@wordpress/element';
import { useNotices } from '@shared/components/Notices';

export interface UnavailableActionProps {
	disabled?: boolean;
	accessibleWhenDisabled?: boolean;
	showTooltip?: boolean;
	description?: string;
	onClickCapture?: () => void;
}

/**
 * Explains an unavailable action instead of leaving a silent disabled button.
 *
 * Spread the returned props onto a WordPress `Button`: it stays focusable, the
 * reason is a tooltip on hover or focus and a description for assistive
 * technology, and clicking it anyway shows the reason as an info notice.
 * A falsy reason returns no props, so the button keeps its own state.
 */
export const useUnavailableAction = (): ( ( reason?: string | false | null ) => UnavailableActionProps ) => {
	const { notify } = useNotices();

	return useCallback(
		( reason?: string | false | null ): UnavailableActionProps =>
			reason
				? {
						disabled: true,
						accessibleWhenDisabled: true,
						showTooltip: true,
						description: reason,
						onClickCapture: () =>
							notify( 'ACTION_UNAVAILABLE', reason, {
								id: 'ppla-action-unavailable',
							} ),
				  }
				: {},
		[ notify ]
	);
};
