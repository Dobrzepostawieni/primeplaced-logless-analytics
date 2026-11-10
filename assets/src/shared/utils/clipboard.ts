/**
 * Copy text using the async Clipboard API when it is available, with a
 * synchronous fallback for WordPress admin contexts where permissions are
 * restricted (for example, an iframe or an older browser).
 */
export const copyTextToClipboard = async ( value: string ): Promise<boolean> => {
	if ( typeof navigator !== 'undefined' && navigator.clipboard?.writeText ) {
		try {
			await navigator.clipboard.writeText( value );
			return true;
		} catch ( error ) {
			// Try the legacy DOM fallback below.
		}
	}

	if ( typeof document === 'undefined' || ! document.body ) {
		return false;
	}

	const textarea = document.createElement( 'textarea' );
	textarea.value = value;
	textarea.setAttribute( 'readonly', '' );
	textarea.style.position = 'fixed';
	textarea.style.inset = '-9999px';
	textarea.style.opacity = '0';
	document.body.appendChild( textarea );
	textarea.select();

	let copied = false;
	try {
		copied = document.execCommand( 'copy' );
	} catch ( error ) {
		copied = false;
	}

	textarea.remove();
	return copied;
};
