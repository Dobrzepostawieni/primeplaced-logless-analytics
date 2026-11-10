<?php
/**
 * Dependency Injection Container.
 *
 * Automatically resolves class dependencies using Reflection and manages
 * shared instances throughout the plugin lifecycle.
 *
 * @package   Primeplaced_Logless_Analytics
 * @author    Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright 2026 Dobrzepostawieni.pl
 * @license   GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Engine;

use ReflectionClass;
use ReflectionNamedType;
use ReflectionParameter;
use ReflectionMethod;
use ReflectionException;
use Exception;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Container
 */
class Container {

	/**
	 * Registry for shared singletons.
	 *
	 * @var array<string, object>
	 */
	private array $instances = array();

	/**
	 * Local cache for autowired metadata to minimize Reflection calls overhead.
	 *
	 * @var array<string, array<int, string|null>>
	 */
	private array $parameter_cache = array();

	/**
	 * Retrieves a shared instance of a requested class.
	 *
	 * @param string $class_name Full namespace of the class.
	 * @throws Exception If resolution fails.
	 * @return object Shared class instance.
	 */
	public function get( string $class_name ): object {
		if ( isset( $this->instances[ $class_name ] ) ) {
			return $this->instances[ $class_name ];
		}

		$instance                       = $this->resolve_dependency( $class_name );
		$this->instances[ $class_name ] = $instance;

		return $instance;
	}

	/**
	 * Resolves dependencies via manual maps or auto-wiring.
	 *
	 * @param string $class_name Target class.
	 * @throws Exception If auto-wiring fails.
	 * @return object Resolved dependency.
	 */
	private function resolve_dependency( string $class_name ): object {
		$manual_maps = $this->get_manual_maps();

		if ( isset( $manual_maps[ $class_name ] ) ) {
			return $manual_maps[ $class_name ]( $this );
		}

		return $this->auto_wire( $class_name );
	}

	/**
	 * Provides a map for classes requiring custom instantiation logic.
	 *
	 * @return array<string, callable>
	 */
	private function get_manual_maps(): array {
		return array();
	}

	/**
	 * Uses Reflection to automatically satisfy constructor requirements.
	 *
	 * @param string $class_name Class to instantiate.
	 * @throws Exception If class does not exist or is not instantiable.
	 * @return object Instantiated class object.
	 */
	private function auto_wire( string $class_name ): object {
		if ( ! \class_exists( $class_name ) ) {
			throw new Exception( \esc_html( "Class {$class_name} does not exist and cannot be instantiated." ) );
		}

		try {
			$reflection_class = new ReflectionClass( $class_name );

			if ( ! $reflection_class->isInstantiable() ) {
				throw new Exception( \esc_html( "Class {$class_name} is not instantiable (it might be an interface or abstract class)." ) );
			}

			$constructor = $reflection_class->getConstructor();

			if ( null === $constructor ) {
				return $reflection_class->newInstance();
			}

			$dependencies = $this->resolve_constructor_args( $class_name, $constructor );

			return $reflection_class->newInstanceArgs( $dependencies );
		} catch ( ReflectionException $exception ) {
			throw new Exception( \esc_html( "Reflection failed to auto-wire class {$class_name}." ) );
		}
	}

	/**
	 * Iterates through parameters to build an argument list using internal metadata cache.
	 *
	 * @param string           $class_name        Target class name.
	 * @param ReflectionMethod $reflection_method Reflection of the constructor.
	 * @throws Exception If a sub-dependency resolution breaks.
	 * @return array<int, mixed> Resolved arguments list.
	 */
	private function resolve_constructor_args( string $class_name, ReflectionMethod $reflection_method ): array {
		if ( isset( $this->parameter_cache[ $class_name ] ) ) {
			$resolved = array();
			foreach ( $this->parameter_cache[ $class_name ] as $dependency_class ) {
				$resolved[] = ( null !== $dependency_class ) ? $this->get( $dependency_class ) : null;
			}
			return $resolved;
		}

		$parameters = $reflection_method->getParameters();
		$resolved   = array();
		$cache_map  = array();

		foreach ( $parameters as $parameter ) {
			$type = $parameter->getType();
			if ( $type instanceof ReflectionNamedType && ! $type->isBuiltin() ) {
				$dep_name    = $type->getName();
				$resolved[]  = $this->get( $dep_name );
				$cache_map[] = $dep_name;
			} else {
				$resolved[]  = $this->resolve_primitive_parameter( $parameter );
				$cache_map[] = null;
			}
		}

		$this->parameter_cache[ $class_name ] = $cache_map;

		return $resolved;
	}

	/**
	 * Resolves non-class parameter primitives.
	 *
	 * @param ReflectionParameter $reflection_parameter Parameter reflection.
	 * @return mixed Default parameter value or null.
	 */
	private function resolve_primitive_parameter( ReflectionParameter $reflection_parameter ) {
		if ( $reflection_parameter->isDefaultValueAvailable() ) {
			try {
				return $reflection_parameter->getDefaultValue();
			} catch ( ReflectionException $exception ) {
				\do_action( 'ppla_container_param_resolve_failed', $exception );
			}
		}

		return null;
	}
}
