<?php

/**
 * The main plugin file.
 *
 * @package           Primeplaced_Logless_Analytics
 * @author            Dobrzepostawieni
 * @copyright         2026 Dobrzepostawieni.pl/primeplaced-logless-analytics
 * @license           GPL-3.0-or-later
 *
 * @wordpress-plugin
 * Plugin Name:       PrimePlaced - Logless Analytics
 * Description:       Privacy-first, cookieless WordPress analytics with local storage, data minimization, and explicit retention controls.
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Version:           1.0.0
 * Author:            Dobrzepostawieni
 * Author URI:        https://dobrzepostawieni.pl
 * License:           GPL-3.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain:       primeplaced-logless-analytics
 * Domain Path:       /languages
 *
 */
// Prevent direct file access.
if ( !defined( 'ABSPATH' ) ) {
    exit;
}
define( 'PPLA_VERSION', '1.0.0' );
define( 'PPLA_TEXTDOMAIN', 'primeplaced-logless-analytics' );
define( 'PPLA_NAME', 'PrimePlaced - Logless Analytics' );
define( 'PPLA_PLUGIN_ROOT', plugin_dir_path( __FILE__ ) );
define( 'PPLA_PLUGIN_ABSOLUTE', __FILE__ );
define( 'PPLA_MIN_PHP_VERSION', '7.4' );
define( 'PPLA_WP_VERSION', '6.2' );
define( 'PPLA_API_NAMESPACE', 'ppla/v1' );
// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
$primeplaced_logless_analytics_libraries = (require PPLA_PLUGIN_ROOT . 'vendor/autoload.php');
if ( function_exists( 'ppla_fs' ) ) {
    ppla_fs()->set_basename( false, __FILE__ );
} else {
    /**
     * Create a helper function for easy SDK access.
     */
    function ppla_fs() : \Freemius {
        global $ppla_fs;
        if ( !isset( $ppla_fs ) ) {
            $ppla_fs = fs_dynamic_init( array(
                'id'               => '32512',
                'slug'             => 'primeplaced-logless-analytics',
                'premium_slug'     => 'primeplaced-logless-analytics-pro',
                'type'             => 'plugin',
                'public_key'       => 'pk_49b06fa05d9e19eca768588ff0208',
                'is_premium'       => false,
                'has_addons'       => false,
                'has_paid_plans'   => true,
                'is_org_compliant' => true,
                'menu'             => array(
                    'slug'    => 'primeplaced-logless-analytics',
                    'contact' => false,
                    'support' => false,
                    'account' => true,
                    'pricing' => true,
                ),
                'is_live'          => true,
            ) );
        }
        return $ppla_fs;
    }

    ppla_fs();
}
if ( !wp_installing() ) {
    register_activation_hook( __FILE__, array(\Primeplaced_Logless_Analytics\Backend\Lifecycle::class, 'activate') );
    register_deactivation_hook( __FILE__, array(\Primeplaced_Logless_Analytics\Backend\Lifecycle::class, 'deactivate') );
    add_action( 
        'plugins_loaded',
        /**
         * Initialize Engine.
         *
         * @return void
         */
        static function () use($primeplaced_logless_analytics_libraries) : void {
            new \Primeplaced_Logless_Analytics\Engine\Initializer($primeplaced_logless_analytics_libraries);
        }
     );
}
if ( function_exists( 'ppla_fs' ) ) {
    ppla_fs()->add_action( 'after_uninstall', array(\Primeplaced_Logless_Analytics\Backend\Lifecycle::class, 'uninstall') );
}