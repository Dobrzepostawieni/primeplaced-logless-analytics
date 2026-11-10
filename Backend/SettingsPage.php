<?php
/**
 * Settings Page Class.
 *
 * @package    Primeplaced_Logless_Analytics
 * @author     Dobrzepostawieni <contact@dobrzepostawieni.pl>
 * @copyright  2026 Dobrzepostawieni.pl
 * @license    GPL-3.0-or-later
 */

namespace Primeplaced_Logless_Analytics\Backend;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Primeplaced_Logless_Analytics\Engine\Base;
use Primeplaced_Logless_Analytics\Integrations\Capabilities;

/**
 * Create the settings page in the backend.
 */
class SettingsPage extends Base {

	/**
	 * Dashboard submenu link; it opens the Overview tab.
	 */
	private const DASHBOARD_MENU_SLUG = 'admin.php?page=' . \PPLA_TEXTDOMAIN . '&tab=general';

	/**
	 * Menu icon: the bars from assets/images/ppla-logo.svg, which WordPress
	 * recolors to match the admin color scheme.
	 */
	private const MENU_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect x="3" y="11" width="3.5" height="7" rx="1.75" fill="black"/><rect x="8.25" y="7" width="3.5" height="11" rx="1.75" fill="black"/><rect x="13.5" y="3" width="3.5" height="15" rx="1.75" fill="black"/></svg>';

	/**
	 * Initialize the class.
	 *
	 * @return bool True on success, false on failure.
	 */
	public function initialize(): bool {
		if ( ! parent::initialize() ) {
			return false;
		}

		\add_action( 'admin_menu', array( $this, 'add_plugin_admin_menu' ) );
		// Runs after Freemius (WP_FS__LOWEST_PRIORITY) has added its Account and
		// Upgrade items, so they follow the dashboard item.
		\add_action( 'admin_menu', array( $this, 'fix_submenu_order' ), \PHP_INT_MAX );
		\add_filter( 'submenu_file', array( $this, 'highlight_dashboard_submenu' ) );

		\add_filter( 'admin_title', array( $this, 'filter_global_admin_title' ), 10, 2 );

		return true;
	}

	/**
	 * Register the administration menu.
	 */
	public function add_plugin_admin_menu(): void {
		$brand_name = $this->get_admin_brand_name();

		$hook_suffix = \add_menu_page(
			$brand_name,
			$brand_name,
			Capabilities::CAP_MANAGE_ANALYTICS,
			\PPLA_TEXTDOMAIN,
			array( $this, 'display_plugin_admin_page' ),
			// WordPress recolors only base64 SVG menu icons (wp-admin/js/svg-painter.js).
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
			'data:image/svg+xml;base64,' . \base64_encode( self::MENU_ICON_SVG ),
			90
		);
		\add_action( 'load-' . $hook_suffix, array( $this, 'prime_admin_page_title' ) );
		\add_submenu_page(
			\PPLA_TEXTDOMAIN,
			\__( 'Analytics dashboard', 'primeplaced-logless-analytics' ),
			\__( 'Analytics dashboard', 'primeplaced-logless-analytics' ),
			Capabilities::CAP_MANAGE_SETTINGS,
			\PPLA_TEXTDOMAIN,
			array( $this, 'display_plugin_admin_page' )
		);
	}

	/**
	 * Supplies the WordPress page title before admin-header.php reads it.
	 *
	 * The fix_submenu_order() method rewrites the dashboard submenu slug to carry
	 * the default tab, so core cannot match the current page and would pass a null
	 * title to strip_tags(), which emits a deprecation notice before headers on
	 * PHP 8.1+.
	 */
	public function prime_admin_page_title(): void {
		global $title;

		if ( empty( $title ) ) {
			// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
			$title = \__( 'Analytics dashboard', 'primeplaced-logless-analytics' );
		}
	}

	/**
	 * Render the settings page view.
	 */
	public function display_plugin_admin_page(): void {
		include \PPLA_PLUGIN_ROOT . 'Backend/views/admin.php';
	}

	/**
	 * Puts the dashboard item first and points it at the Overview tab.
	 *
	 * Without a tab in the URL the app restores the last viewed tab, so the menu
	 * links to Overview explicitly. Core builds the top-level link from the first
	 * submenu item, so only that item changes; the top-level slug stays as
	 * registered so its submenu and the Freemius opt-in still find the menu.
	 */
	public function fix_submenu_order(): void {
		global $submenu;

		if ( ! isset( $submenu[ \PPLA_TEXTDOMAIN ] ) ) {
			return;
		}

		$items         = $submenu[ \PPLA_TEXTDOMAIN ];
		$settings_item = null;
		$other_items   = array();

		foreach ( $items as $item ) {
			if ( \PPLA_TEXTDOMAIN === $item[2] && null === $settings_item ) {
				$settings_item = $item;
			} elseif ( \PPLA_TEXTDOMAIN !== $item[2] ) {
				$other_items[] = $item;
			}
		}

		if ( null === $settings_item ) {
			return;
		}

		$settings_item[2] = self::DASHBOARD_MENU_SLUG;

		// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		$submenu[ \PPLA_TEXTDOMAIN ] = \array_merge( array( $settings_item ), $other_items );
	}

	/**
	 * Marks the dashboard submenu item as current on the dashboard page.
	 *
	 * @param string|null $submenu_file The submenu file WordPress compares against.
	 * @return string|null The dashboard submenu slug on the dashboard page.
	 */
	public function highlight_dashboard_submenu( ?string $submenu_file ): ?string {
		global $plugin_page;

		if ( \PPLA_TEXTDOMAIN === $plugin_page ) {
			return self::DASHBOARD_MENU_SLUG;
		}

		return $submenu_file;
	}

	/**
	 * Filter the admin title globally for all plugin pages to prepend plugin name and retain the default WP suffix.
	 *
	 * @param string $admin_title The page title, with extra context added by WP (e.g. site name).
	 * @param string $title       The original page title provided in add_menu_page.
	 */
	public function filter_global_admin_title( string $admin_title, string $title ): string {
		global $parent_file;
		$screen = \function_exists( 'get_current_screen' ) ? \get_current_screen() : null;

		if ( ! $this->is_ppla_admin_page( $screen, (string) $parent_file ) ) {
			return $admin_title;
		}

		// The dashboard page has no WordPress-level title, so WordPress passes an
		// empty one and the browser tab would show only " ‹ Site — WordPress".
		if ( '' === \trim( $title ) ) {
			return \esc_html( $this->get_admin_brand_name() ) . $admin_title;
		}

		$clean_title = $this->clean_page_title( $title );

		$new_title = \sprintf(
			/* translators: 1: Plugin name, 2: Current page title */
			\esc_html__( '%1$s &lsaquo; %2$s', 'primeplaced-logless-analytics' ),
			$this->get_admin_brand_name(),
			$clean_title
		);

		return \str_replace( $title, $new_title, $admin_title );
	}

	/** Returns the filterable brand name shown on plugin administration screens. */
	private function get_admin_brand_name(): string {
		$name = \apply_filters( 'ppla_admin_brand_name', \__( 'Logless Analytics', 'primeplaced-logless-analytics' ) );

		return \is_string( $name ) && '' !== \trim( $name ) ? \mb_substr( \sanitize_text_field( $name ), 0, 80 ) : \__( 'Logless Analytics', 'primeplaced-logless-analytics' );
	}

	/**
	 * Checks if the current admin screen belongs to the plugin.
	 *
	 * @param \WP_Screen|null $screen      The current WP_Screen object.
	 * @param string          $parent_file The current parent file of the menu.
	 */
	private function is_ppla_admin_page( ?\WP_Screen $screen, string $parent_file ): bool {
		if ( \PPLA_TEXTDOMAIN === $parent_file ) {
			return true;
		}

		if ( $screen && 0 === \strpos( (string) $screen->post_type, 'ppla_' ) ) {
			return true;
		}

		if ( $screen && false !== \strpos( (string) $screen->id, \PPLA_TEXTDOMAIN ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Cleans the page title from duplicated plugin names, HTML entities, and leading separators.
	 *
	 * @param string $title The original page title.
	 */
	private function clean_page_title( string $title ): string {
		$clean = \html_entity_decode( $title, ENT_QUOTES, 'UTF-8' );

		if ( 0 === \strpos( $clean, \PPLA_NAME ) ) {
			$clean = \substr( $clean, \strlen( \PPLA_NAME ) );
		}

		$clean = \preg_replace( '/^[\p{Z}\p{Pd}:]+/u', '', $clean );

		if ( \is_string( $clean ) && '' !== \trim( $clean ) ) {
			return $clean;
		}

		return $title;
	}
}
