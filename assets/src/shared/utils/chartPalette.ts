/**
 * Categorical chart colours.
 *
 * Validated with the dataviz palette checks (lightness band, chroma floor,
 * colour-vision separation). Colours are assigned in this fixed order and
 * never cycled: lists show at most six categories and fold the rest into
 * "Other", which always uses the neutral colour.
 *
 * @package
 */

export const CATEGORICAL_COLORS = [
	'#1baf7a',
	'#2a78d6',
	'#eb6834',
	'#4a3aa7',
	'#eda100',
	'#e87ba4',
] as const;

const OTHER_COLOR = '#8a8f98';

export const MAX_CATEGORIES = CATEGORICAL_COLORS.length;

/** Returns the colour of a category by its position in the chart legend. */
export const getCategoryColor = ( index: number, isOther = false ): string =>
	isOther || index >= MAX_CATEGORIES ? OTHER_COLOR : CATEGORICAL_COLORS[ index ];
