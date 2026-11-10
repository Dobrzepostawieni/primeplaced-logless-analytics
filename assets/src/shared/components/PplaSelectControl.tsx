import { Field, Select, Stack } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';

export type PplaSelectOption = {
	label: string;
	value: string;
	disabled?: boolean;
};

type PplaSelectControlProps = {
	label: string;
	value: string;
	options: PplaSelectOption[];
	onChange: ( value: string ) => void;
	className?: string;
	disabled?: boolean;
	help?: string;
	hideLabelFromVision?: boolean;
	/** `side` keeps the label on the same row, for selects in a header toolbar. */
	labelPosition?: 'top' | 'side';
};

/**
 * A labeled PPLA select using the WordPress Design System popup primitive.
 */
export function PplaSelectControl( {
	label,
	value,
	options,
	onChange,
	className,
	disabled = false,
	help,
	hideLabelFromVision = false,
	labelPosition = 'top',
}: PplaSelectControlProps ): JSX.Element {
	const selectedOption = options.find( ( option ) => option.value === value );
	const controlClassName = [
		'ppla-select-control',
		'side' === labelPosition && 'ppla-select-control--label-side',
		className,
	]
		.filter( Boolean )
		.join( ' ' );

	return (
		<Field.Root
			className={ controlClassName }
			disabled={ disabled }
			render={
				'side' === labelPosition
					? <Stack direction="row" align="center" gap="sm" />
					: <Stack direction="column" gap="xs" />
			}
		>
			<Field.Label
				className="ppla-select-control__label"
				hideFromVision={ hideLabelFromVision }
			>
				{ label }
			</Field.Label>
			<Select.Root
				items={ options }
				value={ selectedOption ?? null }
				disabled={ disabled }
				onValueChange={ ( option ) => onChange( option?.value ?? '' ) }
			>
				<Select.Trigger
					className="ppla-select-control__trigger"
					placeholder={ __( 'Select', 'primeplaced-logless-analytics' ) }
				>
					{selectedOption?.label}
				</Select.Trigger>
				<Select.Popup
					className="ppla-select-control__popup"
					portal={ <Select.Portal className="ppla-select-control__portal" /> }
					// Open below the field like every other dropdown, so the
					// field and its current value stay visible.
					positioner={ <Select.Positioner alignItemWithTrigger={ false } /> }
				>
					{ options.map( ( option, index ) => (
						<Select.Item
							key={ `${ option.value }-${ index }` }
							value={ option }
							disabled={ option.disabled }
							className="ppla-select-control__option"
						>
							<Select.ItemLabel>{ option.label }</Select.ItemLabel>
						</Select.Item>
					) ) }
				</Select.Popup>
			</Select.Root>
			{ help && <Field.Description className="ppla-select-control__help">{ help }</Field.Description> }
		</Field.Root>
	);
}
