/**
 * Typed aliases for `@wordpress/components`.
 *
 * The admin uses the components that WordPress ships at runtime, which accept
 * a few props the pinned package types do not declare. These aliases widen only
 * those props, so the casts live in one place instead of at every call site.
 *
 * @package
 */
import { CheckboxControl, FormTokenField, Panel, PanelBody } from '@wordpress/components';
import type { ComponentProps, ComponentType, JSXElementConstructor, ReactNode } from 'react';

type Widen<
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches React's own ComponentProps constraint.
	Component extends JSXElementConstructor<any>,
	Key extends string,
	Value,
> = ComponentType<Omit<ComponentProps<Component>, Key> & { [ K in Key ]?: Value }>;

/**
 * FormTokenField with `help`. Newer components render it in place of the
 * default how-to hint; older ones ignore it and keep the hint.
 */
export const PplaFormTokenField = FormTokenField as Widen<typeof FormTokenField, 'help', string>;

/** Panel whose header may hold markup; it is rendered inside the panel heading. */
export const PplaPanel = Panel as unknown as Widen<typeof Panel, 'header', ReactNode>;

/** PanelBody whose title may hold markup; it is rendered inside the toggle button. */
export const PplaPanelBody = PanelBody as unknown as Widen<typeof PanelBody, 'title', ReactNode>;

/** CheckboxControl whose label may hold markup; it is rendered inside the label element. */
export const PplaCheckboxControl = CheckboxControl as unknown as Widen<typeof CheckboxControl, 'label', ReactNode>;

/**
 * Returns the string value of a FormTokenField token, which is either a plain
 * string or an object with a `value`.
 *
 * @param token Token passed to a FormTokenField `onChange` handler.
 * @return The token value.
 */
export const getTokenValue = ( token: string | { value: string } ): string =>
	typeof token === 'string' ? token : token.value;
