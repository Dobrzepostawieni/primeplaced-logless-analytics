/**
 * Types for PplaToggler component.
 *
 * @package
 */
export interface PplaTogglerProps {
	label: string | JSX.Element;
	checked: boolean;
	onChange: ( checked: boolean ) => void;
	help?: string | JSX.Element;
	isLoading?: boolean;
	isSaving?: boolean;
	disabled?: boolean;
	className?: string;
	hasBorder?: boolean;
	isSmall?: boolean;
	isPro?: boolean;
}