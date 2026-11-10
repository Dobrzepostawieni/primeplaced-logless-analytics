<?php

/**
 * Primeplaced_Logless_Analytics Initializer
 *
 * @package   Primeplaced_Logless_Analytics
 * @author    Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright 2026 Dobrzepostawieni.pl
 * @license   GPL-3.0-or-later
 * @link      https://dobrzepostawieni.pl
 */
namespace Primeplaced_Logless_Analytics\Engine;

// Prevent direct file access.
if ( !defined( 'ABSPATH' ) ) {
    exit;
}
use Composer\Autoload\ClassLoader;
use ReflectionClass;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use FilesystemIterator;
use SplFileInfo;
use Throwable;
use Exception;
/**
 * Class Initializer
 */
class Initializer {
    /**
     * List of classes to execute.
     *
     * @var array<string>
     */
    public array $classes = array();

    /**
     * Instance of this Context.
     */
    protected Context $context;

    /**
     * Composer autoload file list.
     */
    private ClassLoader $class_loader;

    /**
     * Dependency Injection Container.
     */
    private Container $container;

    /**
     * Initializer constructor.
     *
     * @param ClassLoader $class_loader Composer autoload output.
     */
    public function __construct( ClassLoader $class_loader ) {
        $this->context = new Context();
        $this->class_loader = $class_loader;
        $this->container = new Container();
        $this->bootstrap_plugin_lifecycle();
    }

    /**
     * Determines the request context and loads the classes it needs.
     *
     * Each context keeps its class list in one transient, which Lifecycle clears
     * on activation and uninstall. The stored stamp invalidates the list when
     * the plugin version, or with WP_DEBUG enabled any source file, changes.
     */
    private function bootstrap_plugin_lifecycle() : void {
        $context_id = ( $this->context->request( 'rest' ) ? 'rest' : (( $this->context->request( 'backend' ) ? 'admin' : 'front' )) );
        $is_premium_package = $this->is_premium_package();
        $cache_stamp = $this->get_class_cache_stamp( $context_id );
        $ppla_cache_key = 'ppla_classes_' . $context_id . (( $is_premium_package ? '_pro' : '' ));
        $cached = \get_transient( $ppla_cache_key );
        if ( \is_array( $cached ) && isset( $cached['stamp'], $cached['classes'] ) && $cache_stamp === $cached['stamp'] && \is_array( $cached['classes'] ) ) {
            $this->classes = $cached['classes'];
        } else {
            $this->register_core_namespaces();
            $this->register_request_namespaces( $context_id );
            \set_transient( $ppla_cache_key, array(
                'stamp'   => $cache_stamp,
                'classes' => $this->classes,
            ), DAY_IN_SECONDS );
        }
        $this->load_classes();
    }

    /**
     * Determines whether the current package contains premium-only code.
     */
    private function is_premium_package() : bool {
        $is_premium_package = false;
        return $is_premium_package;
    }

    /**
     * Builds the stamp that invalidates the class discovery cache.
     *
     * Production sites only change code together with the plugin version, so
     * the source tree is scanned only while WP_DEBUG is enabled.
     *
     * @param string $context_id Request context.
     */
    private function get_class_cache_stamp( string $context_id ) : string {
        if ( !\defined( 'WP_DEBUG' ) || !\constant( 'WP_DEBUG' ) ) {
            return (string) \PPLA_VERSION;
        }
        $namespaces = array(
            'Engine',
            'Services',
            'Integrations',
            'Internals',
            'Data'
        );
        if ( 'rest' === $context_id ) {
            $namespaces[] = 'Rest';
        }
        if ( 'admin' === $context_id ) {
            $namespaces[] = 'Backend';
        }
        if ( 'front' === $context_id ) {
            $namespaces[] = 'Frontend';
        }
        $stamp_parts = $this->get_namespace_directory_stamps( $namespaces );
        return \PPLA_VERSION . '|' . \implode( '|', $stamp_parts );
    }

    /**
     * Reads directory mtimes for namespace roots.
     *
     * @param array<int,string> $namespaces Namespace directory names.
     * @return array<int,string>
     */
    private function get_namespace_directory_stamps( array $namespaces ) : array {
        $stamps = array();
        foreach ( $namespaces as $namespace ) {
            $path = \PPLA_PLUGIN_ROOT . \str_replace( '\\', DIRECTORY_SEPARATOR, $namespace );
            $stamps[] = $namespace . ':' . $this->get_directory_tree_stamp( $path );
        }
        return $stamps;
    }

    /**
     * Builds a source stamp from PHP files in a namespace directory.
     *
     * @param string $path Directory path.
     */
    private function get_directory_tree_stamp( string $path ) : string {
        if ( !\is_dir( $path ) ) {
            return '0';
        }
        $parts = array((string) \filemtime( $path ));
        $directory = new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS);
        $iterator = new RecursiveIteratorIterator($directory);
        foreach ( $iterator as $file ) {
            if ( !$file instanceof SplFileInfo || 'php' !== $file->getExtension() ) {
                continue;
            }
            $parts[] = $file->getFilename() . ':' . (string) $file->getMTime() . ':' . (string) $file->getSize();
        }
        \sort( $parts );
        return \md5( \implode( '|', $parts ) );
    }

    /**
     * Registers core namespaces.
     */
    private function register_core_namespaces() : void {
        $this->get_classes( 'Engine' );
        $this->get_classes( 'Services' );
        $this->get_classes( 'Integrations' );
        $this->get_classes( 'Internals' );
        $this->get_classes( 'Data' );
    }

    /**
     * Registers namespaces based on request type.
     *
     * @param string $context_id The determined execution context.
     */
    private function register_request_namespaces( string $context_id ) : void {
        if ( 'rest' === $context_id ) {
            $this->get_classes( 'Rest' );
        }
        if ( 'admin' === $context_id ) {
            $this->get_classes( 'Backend' );
        }
        if ( 'front' === $context_id ) {
            $this->get_classes( 'Frontend' );
        }
    }

    /**
     * Initialize all the classes.
     *
     * @throws Throwable When a class fails to initialize and WP_DEBUG is enabled.
     */
    private function load_classes() : void {
        foreach ( $this->classes as $class ) {
            try {
                $this->initialize_plugin_class( (string) $class );
            } catch ( Throwable $err ) {
                \do_action( 'primeplaced_logless_analytics_initialize_failed', $err );
                if ( \defined( 'WP_DEBUG' ) && \constant( 'WP_DEBUG' ) ) {
                    throw $err;
                }
            }
        }
    }

    /**
     * Validate the class and initialize it using DI Container.
     *
     * @param string $class_to_validate Class name to validate.
     */
    private function initialize_plugin_class( string $class_to_validate ) : void {
        $classmap = $this->class_loader->getClassMap();
        if ( isset( $classmap[$class_to_validate] ) && !\is_file( $classmap[$class_to_validate] ) ) {
            return;
        }
        if ( self::class === $class_to_validate || !\class_exists( $class_to_validate ) ) {
            return;
        }
        $reflection_class = new ReflectionClass($class_to_validate);
        if ( !$this->should_initialize_class( $reflection_class ) ) {
            return;
        }
        $this->initialize_instance( $class_to_validate );
    }

    /**
     * Checks if a class meets the requirements for initialization.
     *
     * @param ReflectionClass $reflection_class The reflection object.
     * @phpstan-param ReflectionClass<object> $reflection_class
     * @return bool True if eligible for instantiation.
     */
    private function should_initialize_class( ReflectionClass $reflection_class ) : bool {
        return $reflection_class->isInstantiable() && !$reflection_class->isAbstract() && !$reflection_class->isInterface() && !$reflection_class->isTrait();
    }

    /**
     * Instantiates and initializes a standard class using Container.
     *
     * @param string $class_name Class name.
     */
    private function initialize_instance( string $class_name ) : void {
        $instance = $this->container->get( $class_name );
        if ( !\method_exists( $instance, 'initialize' ) ) {
            return;
        }
        $instance->initialize();
    }

    /**
     * Based on the folder loads the classes automatically using the Composer autoload.
     *
     * @param string $namespace_to_find Class name to find.
     * @return array<string> Return the classes.
     */
    private function get_classes( string $namespace_to_find ) : array {
        $classmap = $this->class_loader->getClassMap();
        $search = 'Primeplaced_Logless_Analytics\\' . $namespace_to_find;
        if ( isset( $classmap[self::class] ) ) {
            $this->extract_from_classmap( $classmap, $search . '\\' );
            return $this->classes;
        }
        $prefixes = $this->class_loader->getPrefixesPsr4();
        $specific_ns = $search . '\\';
        $base_ns = 'Primeplaced_Logless_Analytics\\';
        if ( isset( $prefixes[$specific_ns] ) ) {
            $folder = (string) $prefixes[$specific_ns][0];
            $this->scan_psr4_directory( $folder, $specific_ns );
        } elseif ( isset( $prefixes[$base_ns] ) ) {
            $folder = (string) $prefixes[$base_ns][0] . \str_replace( '\\', '/', $namespace_to_find ) . '/';
            $this->scan_psr4_directory( $folder, $specific_ns );
        }
        return $this->classes;
    }

    /**
     * Extracts classes matching the namespace from the authoritative classmap.
     *
     * @param array<string, string> $classmap Composer class map.
     * @param string                $search   Base namespace to search.
     */
    private function extract_from_classmap( array $classmap, string $search ) : void {
        foreach ( $classmap as $class => $file ) {
            if ( 0 === \strncmp( (string) $class, $search, \strlen( $search ) ) && \is_file( $file ) ) {
                $this->classes[] = (string) $class;
            }
        }
    }

    /**
     * Scans the filesystem for classes as a fallback mechanism using SPL iterators.
     *
     * @param string $folder         The absolute path to scan.
     * @param string $base_namespace The namespace prefix.
     */
    private function scan_psr4_directory( string $folder, string $base_namespace ) : void {
        if ( !\is_dir( $folder ) ) {
            return;
        }
        $directory = new RecursiveDirectoryIterator($folder, FilesystemIterator::SKIP_DOTS);
        $iterator = new RecursiveIteratorIterator($directory);
        $normalized_folder = \str_replace( '\\', '/', $folder );
        foreach ( $iterator as $file ) {
            if ( !$file instanceof SplFileInfo || 'php' !== $file->getExtension() ) {
                continue;
            }
            $normalized_file = \str_replace( '\\', '/', $file->getPathname() );
            $relative_path = \str_replace( $normalized_folder . '/', '', $normalized_file );
            if ( $this->has_lowercase_only_parts( $relative_path ) ) {
                continue;
            }
            $class_path = \str_replace( '/', '\\', $relative_path );
            $class_name = \substr( (string) $class_path, 0, -4 );
            $this->classes[] = $base_namespace . $class_name;
        }
    }

    /**
     * Checks if any part of the path is strictly lowercase.
     * PSR-4 dictates that classes and their namespaces start with an uppercase letter.
     *
     * @param string $path The relative path.
     * @return bool True if it contains purely lowercase segments.
     */
    private function has_lowercase_only_parts( string $path ) : bool {
        $parts = \explode( '/', $path );
        foreach ( $parts as $part ) {
            $name = \str_replace( '.php', '', $part );
            if ( \strtolower( $name ) === $name ) {
                return true;
            }
        }
        return false;
    }

}
