<?php
/**
 * Custom Event Definition.
 *
 * @package Primeplaced_Logless_Analytics
 */

namespace Primeplaced_Logless_Analytics\Services;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Provides the shared naming contract for configured browser events.
 */
class CustomEventDefinition {

	/** Maximum number of characters in a normalized custom event name. */
	public const MAX_NAME_LENGTH = 80;

	/** Prefix used by Event Contract types emitted for configured events. */
	private const TYPE_PREFIX = 'custom_event.';

	/**
	 * Converts a human-entered event label into a stable lower_snake_case name.
	 *
	 * @param mixed $value Untrusted event name.
	 * @return string Empty when the input cannot produce a valid event name.
	 */
	public static function normalize_name( $value ): string {
		$value = \is_string( $value ) ? \sanitize_text_field( $value ) : '';
		$value = \strtolower( \trim( $value ) );
		$value = \preg_replace( '/[^a-z0-9]+/', '_', $value );
		$value = \is_string( $value ) ? \trim( $value, '_' ) : '';

		if ( 1 !== \preg_match( '/^[a-z][a-z0-9_]{0,79}$/', $value ) ) {
			return '';
		}

		return $value;
	}

	/**
	 * Returns the Event Contract type for a normalized custom event name.
	 *
	 * @param string $event_name Valid lower_snake_case event name.
	 * @return string Event Contract type.
	 */
	public static function get_event_type( string $event_name ): string {
		return self::TYPE_PREFIX . $event_name;
	}

	/**
	 * Checks whether an Event Contract type names a valid custom event.
	 *
	 * @param string $type Lowercase Event Contract type.
	 * @return bool True for `custom_event.<valid_name>`.
	 */
	public static function is_event_type( string $type ): bool {
		if ( 0 !== \strpos( $type, self::TYPE_PREFIX ) ) {
			return false;
		}

		$name = \substr( $type, \strlen( self::TYPE_PREFIX ) );

		return '' !== $name && self::normalize_name( $name ) === $name;
	}
}
