=== PrimePlaced - Logless Analytics ===
Contributors: dobrzepostawieni
Tags: analytics, cookieless, privacy, gdpr, statistics
Requires at least: 6.2
Requires PHP: 7.4
Tested up to: 7.1
Stable tag: 1.0.1
License: GPL-3.0-or-later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Privacy-first, cookieless analytics for WordPress. Local traffic insights without visitor cookies or raw IP storage.

== Description ==

PrimePlaced - Logless Analytics gives WordPress site owners a practical analytics dashboard that runs inside WordPress and is designed around data minimization.

The plugin records pageviews and selected interaction events locally and keeps retention explicit. Strict mode stores no visitor or session identifier; optional session metrics use a daily rotating pseudonymous hash instead of a raw visitor identifier.

= Core features =

* Cookieless frontend tracking.
* REST, admin-ajax, and Beacon POST fallback transports.
* Local WordPress database storage.
* Optional pseudonymous session hashes with daily salt rotation.
* Top pages, traffic sources (including Google Ads and Meta Ads), devices, realtime activity, events, and 404 views.
* Bot filtering, role exclusions, IP exclusions, and URL path exclusions.
* Configurable script injection position and tracking transport mode.
* Configurable data retention (30 days to one year, or until you delete the data) and maintenance tools.
* CSV export for core analytics snapshots.

= Privacy model =

PrimePlaced - Logless Analytics is designed to avoid storing raw IP addresses and raw User-Agent strings in analytics tables. The plugin uses request data in memory to derive a pseudonymous session hash and device type, then stores only the derived analytics data needed for reports.

The identity model never uses visitor cookies. Strict anonymous mode is enabled by default. If pseudonymous session metrics are enabled, their hashes rotate daily to prevent long-term visitor profiles.

= Pro features =

An optional paid Pro version is available separately. The free plugin is fully functional on its own and does not contain locked features.

Pro areas include geolocation analytics, site search reports, goals and conversions, Event Studio (no-code click, visibility, and scroll tracking), scroll depth tracking, referrer attribution, delegated analytics access for selected roles, form tracking, ecommerce analytics, user journeys, scheduled email and PDF reports, report archive, page heatmaps, white-label admin, branded PDF reports, full event log export, and WP-CLI/MainWP workflows.

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/primeplaced-logless-analytics/`, or install the plugin through the WordPress plugins screen.
2. Activate the plugin.
3. Open **Logless Analytics** in the WordPress admin menu.
4. Review privacy, exclusion, transport, and retention settings.

== Frequently Asked Questions ==

= Does the plugin use visitor cookies? =

No. The core tracking flow is cookieless.

= Does it store raw IP addresses? =

No. Raw IP addresses are processed in memory for exclusions, pseudonymous session hashing, and optional Pro geolocation logic, but raw IP addresses are not stored in the core analytics tables.

= Does it store raw User-Agent strings? =

No. User-Agent strings are processed in memory for device classification and pseudonymous session hashing, but raw User-Agent strings are not stored in the core analytics tables.

= Where is analytics data stored? =

Core analytics data is stored locally in custom WordPress database tables prefixed with `ppla_`.

= How does the buffer work? =

Incoming hits are written to a local `ppla_buffer` database queue and are aggregated into analytics tables by WP-Cron. A manual flush tool is available in the admin screen.

= Can I exclude administrators or editors? =

Yes. The settings include role exclusions so logged-in user groups can be excluded from tracking.

= Can I exclude IP addresses or URLs? =

Yes. You can exclude individual IP addresses and URL paths. A path such as `/checkout/` excludes that page, and `/blog/*` excludes every page below `/blog/`.

= How long is analytics data kept? =

30 days by default. You can choose 90 days, 180 days, one year, or keep the data until you delete it. Older data is removed automatically once a day, and the maintenance tools can delete data at any time.

= Does the plugin send analytics data to a remote service? =

No. Analytics data is stored only in your WordPress database. The plugin uses the Freemius SDK for optional opt-in usage data, licensing, and upgrades; see the External services section for exactly when it contacts Freemius and what it sends. Visitor analytics data is never sent to Freemius.

= What happens on uninstall? =

Deleting the plugin from the Plugins screen removes all of its database tables, options, scheduled events, and per-user report preferences. Deactivating the plugin keeps your data.

== Screenshots ==

1. Overview: hits and pageviews compared with the previous period, daily traffic, and device split.
2. Top Pages: pageviews by page for the selected period.
3. Top Traffic Sources: direct visits, referring sites, and Google Ads or Meta Ads campaigns.
4. Real-Time: pageviews per minute and the pages visitors are on right now.
5. Privacy settings: choose strict anonymous mode or daily rotating session hashes, and set data retention.

== Development ==

The complete, human-readable source for the generated JavaScript and CSS in `assets/build/` is available on GitHub: https://github.com/Dobrzepostawieni/primeplaced-logless-analytics

To rebuild `assets/build/`, clone the repository and run `npm ci` and then `npm run build` with Node.js 18.12 or newer.

== External services ==

This plugin uses the [Freemius](https://freemius.com/) SDK, a service provided by Freemius, Inc., for opt-in usage diagnostics, account and license management, and the optional upgrade flow. Visitor analytics data recorded by the plugin is never sent to Freemius.

The plugin contacts Freemius (`api.freemius.com`, `wp.freemius.com`, `checkout.freemius.com`) only in these cases:

* **After an administrator opts in** on the plugin's welcome screen: the administrator's name and email address; the site's homepage URL and title, WordPress and PHP versions, and site language; the plugin and SDK versions and whether the plugin is active, deactivated, or uninstalled. If the administrator also allows it, the names, slugs, versions, and active status of installed plugins and themes are sent. Opting in is optional, and the administrator can skip it or change permissions later from the plugin's Account page.
* **When an administrator submits deactivation feedback**: the selected reason and any text entered.
* **When an administrator opens the Pricing page or starts checkout**: plan and pricing data are loaded from Freemius, and the information entered during checkout is sent to Freemius to process the purchase.

If the administrator does not opt in and does not use these screens, no data is sent to Freemius.

Freemius terms of service: https://freemius.com/terms/
Freemius privacy policy: https://freemius.com/privacy/

== Privacy ==

PrimePlaced - Logless Analytics is built around local storage, data minimization, and short-lived pseudonymous identity.

Core data stored by the plugin may include:

* Pseudonymous session hash.
* Device category.
* Visited URL path and allowlisted site-search parameters.
* Referrer origin without path, query, or fragment.
* A finite acquisition channel (`google_ads` or `meta_ads`) when an allowlisted paid-campaign marker is present; campaign parameters are evaluated in memory and discarded.
* Versioned event type, bounded subject, metrics, and event-specific attributes.
* Timestamps.

Core data intentionally excludes:

* Raw IP addresses in analytics tables.
* Raw User-Agent strings in analytics tables.
* Visitor cookies.

If Pro geolocation is enabled, country-level data may be derived from privacy-friendly edge headers or a local MaxMind database. This is designed to store country codes, not raw visitor IP addresses.

== Changelog ==

= 1.0.1 =

* Added: Help tab with answers to common questions and links to support.
* Added: Upgrade tab that shows what each paid plan includes.
* Improved: the Pricing screen now matches the look of the rest of the plugin.

= 1.0.0 =

* Initial release.
