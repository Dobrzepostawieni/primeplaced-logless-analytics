<?php
/**
 * Settings Schema Class.
 *
 * Defines the JSON Schema for the plugin settings via REST API.
 * Critical for validation and sanitization during REST requests.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Rest;

use Primeplaced_Logless_Analytics\Services\ClientIpResolver;
use Primeplaced_Logless_Analytics\Services\RetentionPolicy;
use Primeplaced_Logless_Analytics\Services\UrlExclusionPatterns;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class SettingsSchema
 */
class SettingsSchema {

	/**
	 * Retrieves the JSON schema for the plugin settings.
	 *
	 * @return array<string, mixed>
	 */
	public static function get_schema(): array {
		$schema = array(
			'$schema'              => 'http://json-schema.org/draft-04/schema#',
			'title'                => 'ppla_settings',
			'type'                 => 'object',
			'properties'           => array(
				'script_position'       => array(
					'type'    => 'string',
					'enum'    => array( 'head', 'footer' ),
					'default' => 'head',
				),
				'tracking_mode'         => array(
					'type'    => 'string',
					'enum'    => array( 'failover', 'rest', 'beacon' ),
					'default' => 'failover',
				),
				'track_404'             => array(
					'type'    => 'boolean',
					'default' => true,
				),
				'filter_bots'           => array(
					'type'    => 'boolean',
					'default' => true,
				),
				'ignore_admins'         => array(
					'type'    => 'boolean',
					'default' => true,
				),
				'ignore_editors'        => array(
					'type'    => 'boolean',
					'default' => false,
				),
				'ignore_authors'        => array(
					'type'    => 'boolean',
					'default' => false,
				),
				'excluded_ips'          => array(
					'type'              => 'array',
					'items'             => array(
						'type'   => 'string',
						'format' => 'ip',
					),
					'maxItems'          => 500,
					'default'           => array(),
					'sanitize_callback' => array( ClientIpResolver::class, 'sanitize_ip_list' ),
				),
				'excluded_urls'         => array(
					'type'              => 'array',
					'items'             => array(
						'type'      => 'string',
						'maxLength' => UrlExclusionPatterns::MAX_LENGTH,
					),
					'maxItems'          => UrlExclusionPatterns::MAX_PATTERNS,
					'default'           => array(),
					'sanitize_callback' => array( UrlExclusionPatterns::class, 'sanitize' ),
				),
				'strict_anonymous_mode' => array(
					'type'    => 'boolean',
					'default' => true,
				),
				'trust_proxy_headers'   => array(
					'type'    => 'boolean',
					'default' => false,
				),
				'data_retention'        => array(
					'type'    => 'integer',
					'enum'    => RetentionPolicy::ALLOWED_DAYS,
					'default' => RetentionPolicy::DEFAULT_DAYS,
				),
				'track_outbound_links'  => array(
					'type'    => 'boolean',
					'default' => false,
				),
				'track_file_downloads'  => array(
					'type'    => 'boolean',
					'default' => false,
				),
			),
			'additionalProperties' => false,
		);

		return (array) \apply_filters( 'ppla_rest_settings_schema', $schema );
	}

	/**
	 * Generates endpoint arguments for the REST API based on the schema.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function get_endpoint_args(): array {
		$schema = self::get_schema();
		$args   = array();

		if ( ! isset( $schema['properties'] ) || ! \is_array( $schema['properties'] ) ) {
			return $args;
		}

		foreach ( $schema['properties'] as $key => $config ) {
			$args[ $key ] = array(
				'type'              => $config['type'] ?? 'string',
				'required'          => false,
				'sanitize_callback' => 'rest_sanitize_request_arg',
				'validate_callback' => 'rest_validate_request_arg',
			);

			if ( isset( $config['enum'] ) ) {
				$args[ $key ]['enum'] = $config['enum'];
			}
			if ( isset( $config['items'] ) ) {
				$args[ $key ]['items'] = $config['items'];
			}
			if ( isset( $config['default'] ) ) {
				$args[ $key ]['default'] = $config['default'];
			}
			if ( isset( $config['sanitize_callback'] ) && \is_callable( $config['sanitize_callback'] ) ) {
				$args[ $key ]['sanitize_callback'] = $config['sanitize_callback'];
			}
		}

		return $args;
	}
}
