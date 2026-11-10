<?php
/**
 * Event Feature Policy Service.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Services;

use Primeplaced_Logless_Analytics\Data\CustomEventRepository;
use Primeplaced_Logless_Analytics\Engine\Base;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Defines the Core event feature contract and lets premium code extend it.
 */
class EventFeaturePolicy extends Base {

	/**
	 * Default number of accepted events per tracking hit.
	 */
	public const DEFAULT_MAX_EVENTS_PER_HIT = 10;

	/**
	 * Active custom events the tracker accepts; creation stops at this cap.
	 */
	public const MAX_ACTIVE_CUSTOM_EVENTS = 50;

	/**
	 * Core event definitions. Pro extends this registry through the existing
	 * policy filter; Core never names or enables premium event types.
	 */
	private const CORE_EVENT_DEFINITIONS = array(
		'navigation.not_found'        => array(
			'type'          => 'navigation.not_found',
			'subject_kinds' => array( 'path' ),
		),
		'embed.iframe.viewed'         => array(
			'type'          => 'embed.iframe.viewed',
			'subject_kinds' => array( 'path' ),
		),
		'navigation.outbound.clicked' => array(
			'type'          => 'navigation.outbound.clicked',
			'subject_kinds' => array( 'host' ),
		),
		'asset.downloaded'            => array(
			'type'          => 'asset.downloaded',
			'subject_kinds' => array( 'asset' ),
		),
	);

	/**
	 * Custom-event configuration storage.
	 */
	private CustomEventRepository $custom_event_repository;

	/**
	 * Normalized policy cache for the current request.
	 *
	 * @var array{
	 *     plan: string,
	 *     tier: string,
	 *     max_events_per_hit: int,
	 *     features: array<string, bool>,
	 *     event_definitions: array<string, array<string, mixed>>,
	 *     scroll_depth_thresholds: array<int, array{unit: string, value: float, label: string}>,
	 *     form_tracking: array{providers: array<int,string>, events: array<int,string>},
	 *     goal_tracking: array{goals: array<int,array{id:string,name:string,trigger:string,selector:string,value:float}>},
	 *     visual_interactions: array{rules: array<int,array<string,mixed>>},
	 *     custom_events: array{events: array<int,array{id:string,event_name:string,trigger_type:string,css_selector:string,is_active:bool}>}
	 * }|null
	 */
	private ?array $policy_cache = null;

	/**
	 * Creates the event feature policy.
	 *
	 * @param CustomEventRepository|null $custom_event_repository Custom-event storage.
	 */
	public function __construct( ?CustomEventRepository $custom_event_repository = null ) {
		$this->custom_event_repository = $custom_event_repository ?? new CustomEventRepository();
	}

	/**
	 * Returns the active event feature policy.
	 *
	 * @return array{
	 *     plan: string,
	 *     tier: string,
	 *     max_events_per_hit: int,
	 *     features: array<string, bool>,
	 *     event_definitions: array<string, array<string, mixed>>,
	 *     scroll_depth_thresholds: array<int, array{unit: string, value: float, label: string}>,
	 *     form_tracking: array{providers: array<int,string>, events: array<int,string>},
	 *     goal_tracking: array{goals: array<int,array{id:string,name:string,trigger:string,selector:string,value:float}>},
	 *     visual_interactions: array{rules: array<int,array<string,mixed>>},
	 *     custom_events: array{events: array<int,array{id:string,event_name:string,trigger_type:string,css_selector:string,is_active:bool}>}
	 * }
	 */
	public function get_policy(): array {
		if ( null !== $this->policy_cache ) {
			return $this->policy_cache;
		}

		$policy = array(
			'plan'                    => 'free',
			'tier'                    => 'free',
			'max_events_per_hit'      => self::DEFAULT_MAX_EVENTS_PER_HIT,
			'features'                => array(
				'pageviews'      => true,
				'four_oh_four'   => true,
				'iframe_views'   => true,
				'outbound_links' => true,
				'file_downloads' => true,
				'scroll_depth'   => false,
				'form_tracking'  => false,
				'goal_tracking'  => false,
			),
			'event_definitions'       => self::CORE_EVENT_DEFINITIONS,
			'scroll_depth_thresholds' => array(
				array(
					'unit'  => '%',
					'value' => 25.0,
					'label' => '25%',
				),
			),
			'form_tracking'           => array(
				'providers' => array( 'contact_form_7', 'wpforms' ),
				'events'    => array( 'success' ),
			),
			'goal_tracking'           => array(
				'goals' => array(),
			),
			// Neutral extension contract. Premium modules may supply rules; Core
			// deliberately provides neither UI nor browser tracking for them.
			'visual_interactions'     => array(
				'rules' => array(),
			),
			'custom_events'           => array(
				'events' => $this->custom_event_repository->get_active(),
			),
		);

		$filtered   = \apply_filters( 'ppla_event_feature_policy', $policy );
		$normalized = $this->normalize_policy( \is_array( $filtered ) ? $filtered : $policy );
		foreach ( $normalized['custom_events']['events'] as $event ) {
			$type = CustomEventDefinition::get_event_type( $event['event_name'] );

			$normalized['event_definitions'][ $type ] = array(
				'type'          => $type,
				'attributes'    => array(),
				'metrics'       => array( 'amount' ),
				'provider_ids'  => array( 'custom' ),
				'subject_kinds' => array( 'custom' ),
			);
		}

		$this->policy_cache = $normalized;

		return $this->policy_cache;
	}

	/**
	 * Returns a registered, currently allowed event definition.
	 *
	 * @param string $type Event type.
	 * @return array<string, mixed>|null
	 */
	public function get_event_definition( string $type ): ?array {
		$definitions = $this->get_policy()['event_definitions'];
		return isset( $definitions[ $type ] ) && \is_array( $definitions[ $type ] ) ? $definitions[ $type ] : null;
	}

	/**
	 * Whether a normalized event may be associated with a stored session.
	 *
	 * Extensions can opt an event out through the neutral event-definition
	 * privacy contract. Core does not name or create premium event types.
	 *
	 * @param array<string,mixed> $event Normalized event envelope.
	 */
	public function event_uses_session( array $event ): bool {
		$privacy = $this->get_event_privacy_from_event( $event );

		return empty( $privacy['sessionless'] );
	}

	/**
	 * Whether a normalized event may create an attribution projection.
	 *
	 * @param array<string,mixed> $event Normalized event envelope.
	 */
	public function event_allows_attribution( array $event ): bool {
		$privacy = $this->get_event_privacy_from_event( $event );

		return ! isset( $privacy['allow_attribution'] ) || (bool) $privacy['allow_attribution'];
	}

	/**
	 * Returns an event definition's internal storage privacy flags.
	 *
	 * EventContract copies this neutral metadata into its normalized envelope so
	 * a queued event keeps the privacy decision made when it was accepted. This
	 * avoids making historical queue rows depend on a later plan downgrade.
	 *
	 * @param string $type Registered event type.
	 * @return array{sessionless?:bool,allow_attribution?:bool}
	 */
	public function get_event_privacy( string $type ): array {
		$definition = $this->get_event_definition( $type );
		$privacy    = isset( $definition['privacy'] ) && \is_array( $definition['privacy'] ) ? $definition['privacy'] : array();

		return $this->normalize_event_privacy( $privacy );
	}

	/**
	 * Reads immutable normalized privacy metadata before falling back to policy.
	 *
	 * @param array<string,mixed> $event Normalized event envelope.
	 * @return array{sessionless?:bool,allow_attribution?:bool}
	 */
	private function get_event_privacy_from_event( array $event ): array {
		if ( isset( $event['privacy'] ) && \is_array( $event['privacy'] ) ) {
			return $this->normalize_event_privacy( $event['privacy'] );
		}

		$type = isset( $event['type'] ) && \is_string( $event['type'] ) ? $event['type'] : '';
		return $this->get_event_privacy( $type );
	}

	/**
	 * Returns frontend-safe feature flags.
	 *
	 * @return array<string, mixed>
	 */
	public function get_public_features(): array {
		$policy = $this->get_policy();

		return array(
			'plan'                    => $policy['plan'],
			'tier'                    => $policy['tier'],
			'max_events_per_hit'      => $policy['max_events_per_hit'],
			'features'                => $policy['features'],
			'scroll_depth_thresholds' => $policy['scroll_depth_thresholds'],
			'form_tracking'           => $policy['form_tracking'],
			'goal_tracking'           => $policy['goal_tracking'],
			'visual_interactions'     => $policy['visual_interactions'],
			'custom_events'           => $policy['custom_events'],
		);
	}

	/**
	 * Returns the maximum accepted event count per hit.
	 */
	public function get_max_events_per_hit(): int {
		return $this->get_policy()['max_events_per_hit'];
	}

	/**
	 * Sanitizes the policy shape after extension filters run.
	 *
	 * @param array<string, mixed> $policy Policy map.
	 * @return array{
	 *     plan: string,
	 *     tier: string,
	 *     max_events_per_hit: int,
	 *     features: array<string, bool>,
	 *     event_definitions: array<string, array<string, mixed>>,
	 *     scroll_depth_thresholds: array<int, array{unit: string, value: float, label: string}>,
	 *     form_tracking: array{providers: array<int,string>, events: array<int,string>},
	 *     goal_tracking: array{goals: array<int,array{id:string,name:string,trigger:string,selector:string,value:float}>},
	 *     visual_interactions: array{rules: array<int,array<string,mixed>>},
	 *     custom_events: array{events: array<int,array{id:string,event_name:string,trigger_type:string,css_selector:string,is_active:bool}>}
	 * }
	 */
	private function normalize_policy( array $policy ): array {
		$features = isset( $policy['features'] ) && \is_array( $policy['features'] ) ? $policy['features'] : array();

		$normalized_features = array();
		foreach ( $features as $key => $enabled ) {
			if ( ! \is_string( $key ) ) {
				continue;
			}
			$normalized_features[ \sanitize_key( $key ) ] = (bool) $enabled;
		}

		return array(
			'plan'                    => isset( $policy['plan'] ) && \is_string( $policy['plan'] ) ? \sanitize_key( $policy['plan'] ) : 'free',
			'tier'                    => isset( $policy['tier'] ) && \is_string( $policy['tier'] ) ? \sanitize_key( $policy['tier'] ) : 'free',
			'max_events_per_hit'      => isset( $policy['max_events_per_hit'] ) ? \max( 1, \min( 50, (int) $policy['max_events_per_hit'] ) ) : self::DEFAULT_MAX_EVENTS_PER_HIT,
			'features'                => $normalized_features,
			'event_definitions'       => $this->normalize_event_definitions( $policy['event_definitions'] ?? array() ),
			'scroll_depth_thresholds' => $this->normalize_scroll_depth_thresholds( $policy['scroll_depth_thresholds'] ?? null ),
			'form_tracking'           => $this->normalize_form_tracking_config( $policy['form_tracking'] ?? null ),
			'goal_tracking'           => $this->normalize_goal_tracking_config( $policy['goal_tracking'] ?? null ),
			'visual_interactions'     => $this->normalize_visual_interactions_config( $policy['visual_interactions'] ?? null ),
			'custom_events'           => $this->normalize_custom_events_config( $policy['custom_events'] ?? null ),
		);
	}

	/**
	 * Preserves a bounded, frontend-safe visual-interaction rule list supplied
	 * by a premium extension. The Core contract never creates or acts on rules.
	 *
	 * @param mixed $config Extension configuration.
	 * @return array{rules: array<int,array<string,mixed>>}
	 */
	private function normalize_visual_interactions_config( $config ): array {
		$rules = \is_array( $config ) && isset( $config['rules'] ) && \is_array( $config['rules'] ) ? $config['rules'] : array();
		return array( 'rules' => \array_slice( $rules, 0, 50 ) );
	}

	/**
	 * Normalizes active custom-event definitions for the public frontend policy.
	 *
	 * @param mixed $config Raw custom-event configuration.
	 * @return array{events: array<int,array{id:string,event_name:string,trigger_type:string,css_selector:string,is_active:bool}>}
	 */
	private function normalize_custom_events_config( $config ): array {
		$events     = \is_array( $config ) && isset( $config['events'] ) && \is_array( $config['events'] ) ? $config['events'] : array();
		$normalized = array();

		foreach ( \array_slice( $events, 0, self::MAX_ACTIVE_CUSTOM_EVENTS ) as $event ) {
			if ( ! \is_array( $event ) ) {
				continue;
			}

			$name     = CustomEventDefinition::normalize_name( $event['event_name'] ?? '' );
			$trigger  = isset( $event['trigger_type'] ) && \is_string( $event['trigger_type'] ) ? \sanitize_key( $event['trigger_type'] ) : '';
			$selector = isset( $event['css_selector'] ) ? \substr( \sanitize_text_field( (string) $event['css_selector'] ), 0, 255 ) : '';

			if ( '' === $name || ! \in_array( $trigger, array( 'click', 'submit', 'custom' ), true ) || ( 'custom' !== $trigger && '' === $selector ) ) {
				continue;
			}

			$normalized[] = array(
				'id'           => isset( $event['id'] ) ? \sanitize_text_field( (string) $event['id'] ) : '',
				'event_name'   => $name,
				'trigger_type' => $trigger,
				'css_selector' => $selector,
				'is_active'    => ! empty( $event['is_active'] ),
			);
		}

		return array( 'events' => $normalized );
	}

	/**
	 * Normalizes definitions supplied by Core and Pro policy extensions.
	 *
	 * @param mixed $definitions Raw extension definitions.
	 * @return array<string, array{type: string, attributes: array<int,string>, metrics: array<int,string>, provider_ids: array<int,string>, subject_kinds: array<int,string>, server_only?: true}>
	 */
	private function normalize_event_definitions( $definitions ): array {
		if ( ! \is_array( $definitions ) ) {
			$definitions = array();
		}

		$normalized = array();
		foreach ( $definitions as $key => $definition ) {
			if ( ! \is_array( $definition ) ) {
				continue;
			}

			$type = isset( $definition['type'] ) && \is_string( $definition['type'] ) ? \strtolower( \trim( $definition['type'] ) ) : ( \is_string( $key ) ? \strtolower( \trim( $key ) ) : '' );
			if ( 1 !== \preg_match( '/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/', $type ) || \strlen( $type ) > 100 ) {
				continue;
			}

			$normalized[ $type ] = array(
				'type'          => $type,
				'attributes'    => $this->normalize_contract_field_list( $definition['attributes'] ?? array() ),
				'metrics'       => $this->normalize_contract_field_list( $definition['metrics'] ?? array() ),
				'provider_ids'  => $this->normalize_contract_field_list( $definition['provider_ids'] ?? array() ),
				'subject_kinds' => $this->normalize_contract_field_list( $definition['subject_kinds'] ?? array() ),
			);

			$attribute_constraints = $this->normalize_attribute_constraints( $definition['attribute_constraints'] ?? null );
			if ( array() !== $attribute_constraints ) {
				$normalized[ $type ]['attribute_constraints'] = $attribute_constraints;
			}

			$privacy = $this->normalize_event_privacy( $definition['privacy'] ?? null );
			if ( array() !== $privacy ) {
				$normalized[ $type ]['privacy'] = $privacy;
			}
			if ( ! empty( $definition['server_only'] ) ) {
				$normalized[ $type ]['server_only'] = true;
			}
		}

		return $normalized;
	}

	/**
	 * Normalizes scalar constraints for named event attributes.
	 *
	 * @param mixed $constraints Raw extension-supplied constraints.
	 * @return array<string,array{type:string,minimum:int,maximum:int,multiple_of:int,required:bool}>
	 */
	private function normalize_attribute_constraints( $constraints ): array {
		if ( ! \is_array( $constraints ) ) {
			return array();
		}

		$normalized = array();
		foreach ( $constraints as $key => $constraint ) {
			$key = \is_string( $key ) ? \sanitize_key( $key ) : '';
			if ( '' === $key || ! \is_array( $constraint ) || 'integer' !== ( $constraint['type'] ?? '' ) ) {
				continue;
			}

			$minimum     = isset( $constraint['minimum'] ) && \is_int( $constraint['minimum'] ) ? $constraint['minimum'] : 0;
			$maximum     = isset( $constraint['maximum'] ) && \is_int( $constraint['maximum'] ) ? $constraint['maximum'] : $minimum;
			$multiple_of = isset( $constraint['multiple_of'] ) && \is_int( $constraint['multiple_of'] ) ? max( 1, $constraint['multiple_of'] ) : 1;
			if ( $maximum < $minimum ) {
				continue;
			}

			$normalized[ $key ] = array(
				'type'        => 'integer',
				'minimum'     => $minimum,
				'maximum'     => $maximum,
				'multiple_of' => $multiple_of,
				'required'    => ! empty( $constraint['required'] ),
			);
		}

		return $normalized;
	}

	/**
	 * Normalizes storage and projection privacy flags for an event definition.
	 *
	 * @param mixed $privacy Raw extension-supplied privacy policy.
	 * @return array{sessionless?:bool,allow_attribution?:bool}
	 */
	private function normalize_event_privacy( $privacy ): array {
		if ( ! \is_array( $privacy ) ) {
			return array();
		}

		$normalized = array();
		if ( isset( $privacy['sessionless'] ) ) {
			$normalized['sessionless'] = (bool) $privacy['sessionless'];
		}
		if ( isset( $privacy['allow_attribution'] ) ) {
			$normalized['allow_attribution'] = (bool) $privacy['allow_attribution'];
		}

		return $normalized;
	}

	/**
	 * Normalizes a bounded event-definition allowlist.
	 *
	 * @param mixed $values Raw allowlist.
	 * @return array<int, string>
	 */
	private function normalize_contract_field_list( $values ): array {
		if ( ! \is_array( $values ) ) {
			return array();
		}

		$normalized = array();
		foreach ( \array_slice( $values, 0, 20 ) as $value ) {
			if ( \is_string( $value ) ) {
				$value = \sanitize_key( $value );
				if ( '' !== $value ) {
					$normalized[] = $value;
				}
			}
		}

		return \array_values( \array_unique( $normalized ) );
	}

	/**
	 * Normalizes the public scroll-depth threshold list contract.
	 *
	 * @param mixed $thresholds Threshold maps provided by Core or Pro.
	 * @return array<int, array{unit: string, value: float, label: string}>
	 */
	private function normalize_scroll_depth_thresholds( $thresholds ): array {
		$thresholds = \is_array( $thresholds ) ? $thresholds : array();
		$normalized = array();

		foreach ( \array_slice( $thresholds, 0, 5 ) as $threshold ) {
			if ( ! \is_array( $threshold ) ) {
				continue;
			}

			$unit  = isset( $threshold['unit'] ) && \is_string( $threshold['unit'] ) && 'px' === $threshold['unit'] ? 'px' : '%';
			$value = isset( $threshold['value'] ) && \is_numeric( $threshold['value'] ) ? (float) $threshold['value'] : 25.0;
			$value = 'px' === $unit ? \max( 1.0, \min( 100000.0, $value ) ) : \max( 1.0, \min( 100.0, $value ) );

			$normalized[] = array(
				'unit'  => $unit,
				'value' => $value,
				'label' => $this->format_scroll_depth_threshold_label( $value, $unit ),
			);
		}

		if ( array() === $normalized ) {
			$normalized[] = array(
				'unit'  => '%',
				'value' => 25.0,
				'label' => '25%',
			);
		}

		return $normalized;
	}

	/**
	 * Formats a normalized scroll-depth threshold label.
	 *
	 * @param float  $value Threshold value.
	 * @param string $unit Threshold unit.
	 */
	private function format_scroll_depth_threshold_label( float $value, string $unit ): string {
		$formatted = \rtrim( \rtrim( \number_format( $value, 2, '.', '' ), '0' ), '.' );

		return $formatted . $unit;
	}

	/**
	 * Normalizes the public form tracking config.
	 *
	 * @param mixed $config Raw config.
	 * @return array{providers: array<int,string>, events: array<int,string>}
	 */
	private function normalize_form_tracking_config( $config ): array {
		if ( ! \is_array( $config ) ) {
			return array(
				'providers' => array( 'contact_form_7', 'wpforms' ),
				'events'    => array( 'success' ),
			);
		}

		$providers = isset( $config['providers'] ) && \is_array( $config['providers'] ) ? $config['providers'] : array();
		$events    = isset( $config['events'] ) && \is_array( $config['events'] ) ? $config['events'] : array();

		return array(
			'providers' => $this->normalize_string_list( $providers, array( 'contact_form_7', 'wpforms' ) ),
			'events'    => $this->normalize_string_list( $events, array( 'success' ) ),
		);
	}

	/**
	 * Normalizes the public goal tracking config.
	 *
	 * @param mixed $config Raw config.
	 * @return array{goals: array<int,array{id:string,name:string,trigger:string,selector:string,value:float}>}
	 */
	private function normalize_goal_tracking_config( $config ): array {
		if ( ! \is_array( $config ) ) {
			return array(
				'goals' => array(),
			);
		}

		$goals = isset( $config['goals'] ) && \is_array( $config['goals'] ) ? $config['goals'] : array();

		return array(
			'goals' => $this->normalize_goal_items( $goals ),
		);
	}

	/**
	 * Normalizes public goal definitions for frontend tracking.
	 *
	 * @param array<int,mixed> $items Raw goal rows.
	 * @return array<int,array{id:string,name:string,trigger:string,selector:string,value:float}>
	 */
	private function normalize_goal_items( array $items ): array {
		$normalized = array();

		foreach ( \array_slice( $items, 0, 50 ) as $index => $item ) {
			if ( ! \is_array( $item ) ) {
				continue;
			}

			$id = isset( $item['id'] ) && \is_string( $item['id'] ) ? \sanitize_key( $item['id'] ) : '';
			if ( '' === $id ) {
				$id = 'goal-' . ( $index + 1 );
			}

			$name = isset( $item['name'] ) && \is_string( $item['name'] )
				? \mb_substr( \sanitize_text_field( $item['name'] ), 0, 80 )
				: $id;

			$trigger  = isset( $item['trigger'] ) && \is_string( $item['trigger'] ) ? \sanitize_key( $item['trigger'] ) : 'click';
			$trigger  = 'submit' === $trigger ? 'submit' : 'click';
			$selector = isset( $item['selector'] ) && \is_string( $item['selector'] )
				? \mb_substr( \sanitize_text_field( $item['selector'] ), 0, 160 )
				: '';
			$value    = isset( $item['value'] ) && \is_numeric( $item['value'] ) ? (float) $item['value'] : 0.0;

			$normalized[] = array(
				'id'       => $id,
				'name'     => '' !== $name ? $name : $id,
				'trigger'  => $trigger,
				'selector' => $selector,
				'value'    => \round( $value, 2 ),
			);
		}

		return $normalized;
	}

	/**
	 * Normalizes public string lists.
	 *
	 * @param array<int,mixed>  $items Raw list.
	 * @param array<int,string> $fallback Fallback list.
	 * @return array<int,string>
	 */
	private function normalize_string_list( array $items, array $fallback ): array {
		$normalized = array();
		foreach ( $items as $item ) {
			if ( \is_string( $item ) && '' !== $item ) {
				$normalized[] = \sanitize_key( $item );
			}
		}

		$normalized = \array_values( \array_unique( $normalized ) );

		return array() !== $normalized ? $normalized : $fallback;
	}
}
