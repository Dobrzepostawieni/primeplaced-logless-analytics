<?php

/**
 * Lifecycle Management Class.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */
namespace Primeplaced_Logless_Analytics\Backend;

// Prevent direct file access.
if ( !defined( 'ABSPATH' ) ) {
    exit;
}
use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Data\Schema;
use Primeplaced_Logless_Analytics\Integrations\CronDispatcher;
/**
 * Handle Activation, Deactivation and Uninstallation.
 */
class Lifecycle extends Base {
    /**
     * Initialize the class.
     *
     * @return bool True on success, false on failure.
     */
    public function initialize() : bool {
        if ( !parent::initialize() ) {
            return false;
        }
        // Priority 200 runs after WordPress has created the new site's tables.
        \add_action( 'wp_initialize_site', array($this, 'activate_new_site'), 200 );
        \add_action( 'plugins_loaded', array($this, 'maybe_update_schema'), 20 );
        return true;
    }

    /**
     * Keeps custom tables current after plugin updates.
     */
    public function maybe_update_schema() : void {
        $schema_version = \get_option( 'ppla_schema_version', '' );
        if ( Schema::VERSION === $schema_version ) {
            return;
        }
        $schema = new Schema();
        if ( $schema->create_tables() ) {
            \update_option( 'ppla_schema_version', Schema::VERSION, false );
        }
    }

    /**
     * Sets up a new multisite site when the plugin is network-activated.
     *
     * @param \WP_Site $site New site.
     */
    public function activate_new_site( \WP_Site $site ) : void {
        if ( !\function_exists( 'is_plugin_active_for_network' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if ( !\is_plugin_active_for_network( \plugin_basename( \PPLA_PLUGIN_ABSOLUTE ) ) ) {
            return;
        }
        \switch_to_blog( (int) $site->blog_id );
        self::single_activate();
        \restore_current_blog();
    }

    /**
     * Fired when the plugin is activated.
     *
     * @param bool $network_wide True if active in a multisite.
     */
    public static function activate( bool $network_wide ) : void {
        self::clear_initializer_cache();
        if ( \function_exists( 'is_multisite' ) && \is_multisite() && $network_wide ) {
            foreach ( self::get_site_ids() as $site_id ) {
                \switch_to_blog( $site_id );
                self::single_activate();
                \restore_current_blog();
            }
        } else {
            self::single_activate();
        }
    }

    /**
     * Fired when the plugin is deactivated.
     *
     * @param bool $network_wide True if network deactivated.
     */
    public static function deactivate( bool $network_wide ) : void {
        self::clear_initializer_cache();
        if ( \function_exists( 'is_multisite' ) && \is_multisite() && $network_wide ) {
            foreach ( self::get_site_ids() as $site_id ) {
                \switch_to_blog( $site_id );
                self::single_deactivate();
                \restore_current_blog();
            }
        } else {
            self::single_deactivate();
        }
    }

    /**
     * Fired when the plugin is uninstalled via Freemius.
     */
    public static function uninstall() : void {
        self::clear_initializer_cache();
        if ( \function_exists( 'is_multisite' ) && \is_multisite() ) {
            foreach ( self::get_site_ids() as $site_id ) {
                \switch_to_blog( $site_id );
                self::delete_plugin_data();
                \restore_current_blog();
            }
        } else {
            self::delete_plugin_data();
        }
    }

    /**
     * Logic for single site activation.
     */
    private static function single_activate() : void {
        $schema = new Schema();
        if ( $schema->create_tables() ) {
            \update_option( 'ppla_schema_version', Schema::VERSION, false );
        }
        // phpcs:ignore WordPress.WP.CronInterval.ChangeDetected -- The callback registers an explicit 15-minute interval.
        \add_filter( 'cron_schedules', array(CronDispatcher::class, 'register_cron_interval') );
        CronDispatcher::ensure_scheduled_events();
        \remove_filter( 'cron_schedules', array(CronDispatcher::class, 'register_cron_interval') );
    }

    /**
     * Logic for single site deactivation.
     */
    private static function single_deactivate() : void {
        CronDispatcher::clear_scheduled_events();
    }

    /**
     * Removes all settings registered by the FREE version and fires an uninstall hook.
     */
    private static function delete_plugin_data() : void {
        global $wpdb;
        CronDispatcher::clear_scheduled_events();
        $tables = array(
            $wpdb->prefix . 'ppla_event_contracts',
            $wpdb->prefix . 'ppla_custom_event_configurations',
            $wpdb->prefix . 'ppla_saved_views',
            $wpdb->prefix . 'ppla_pageviews',
            $wpdb->prefix . 'ppla_sessions',
            $wpdb->prefix . 'ppla_buffer'
        );
        foreach ( $tables as $table ) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->query( $wpdb->prepare( 'DROP TABLE IF EXISTS %i', $table ) );
        }
        \delete_option( 'ppla_settings' );
        \delete_option( 'ppla_stats_version' );
        \delete_option( 'ppla_schema_version' );
        \delete_option( 'ppla_event_contract_schema_version' );
        \delete_option( 'ppla_buffer_lock' );
        \delete_option( 'ppla_settings_write_lock' );
        \delete_option( 'ppla_privacy_history' );
        // Preferences belong to individual WordPress users, but are scoped by blog ID.
        $preference_meta_key = 'ppla_report_preferences_' . (int) \get_current_blog_id();
        \delete_metadata(
            'user',
            0,
            $preference_meta_key,
            '',
            true
        );
        \delete_transient( 'ppla_daily_salt' );
        \delete_transient( 'ppla_buffer_capacity_check' );
    }

    /**
     * Returns the IDs of every site in the network.
     *
     * @return array<int, int>
     */
    private static function get_site_ids() : array {
        return \array_map( 'intval', \get_sites( array(
            'fields' => 'ids',
            'number' => 0,
        ) ) );
    }

    /**
     * Removes the cached class lists of every request context.
     */
    private static function clear_initializer_cache() : void {
        $contexts = array(
            'rest',
            'admin',
            'front',
            'rest_pro',
            'admin_pro',
            'front_pro'
        );
        foreach ( $contexts as $context ) {
            \delete_transient( 'ppla_classes_' . $context );
        }
    }

}
