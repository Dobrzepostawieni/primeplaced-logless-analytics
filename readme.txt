=== PrimePlaced - Logless Analytics: Cookieless Stats ===
Contributors: dobrzepostawieni
Tags: analytics, statistics, cookieless, gdpr, privacy-friendly
Requires at least: 6.6
Requires PHP: 7.4
Tested up to: 7.1
Stable tag: 1.0.2
License: GPL-3.0-or-later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Cookieless, privacy-friendly stats: pageviews, traffic sources, devices and real-time visits, stored in your own WordPress database.

== Description ==

PrimePlaced - Logless Analytics shows how people find and use your site without visitor cookies, without sending visitor data to a third-party analytics service, and without storing raw IP addresses.

Everything runs inside WordPress: tracking data goes to your own database, the dashboard lives in wp-admin, and you decide how long the data is kept.

= Why Logless Analytics =

* **No visitor cookies.** The tracker sets no cookies and stores nothing in the visitor's browser.
* **Your data stays on your server.** Visitor analytics data is stored only in your WordPress database and is never sent to an outside analytics service.
* **Private by default.** Strict anonymous mode, enabled by default, stores no visitor or session identifier. Optional session metrics use a pseudonymous hash that rotates daily, which prevents long-term visitor profiles.
* **Lightweight.** The tracking script is about 4 KB (about 2 KB gzipped) and sends one small request to your own site per pageview. Hits are aggregated in the background.
* **Works with page caching.** Tracking requests do not depend on a nonce, so pages served from a page cache or CDN are still counted.
* **No limits in the free version.** No pageview quotas, no time limits, and no locked reports.

= Core features =

* Cookieless frontend tracking.
* Overview dashboard with pageviews, daily traffic, and comparison with the previous period.
* Top pages, traffic sources (including Google Ads and Meta Ads campaigns), devices, 404 views, and events.
* Real-time view of active visits, pageviews per minute, and the pages visitors are on right now.
* Optional outbound link and file download tracking.
* Bot filtering, role exclusions (administrators are excluded by default), IP exclusions, and URL path exclusions.
* Configurable data retention (30 days to one year, or until you delete the data) and maintenance tools.
* CSV export for reports.
* Local WordPress database storage with REST, admin-ajax, and Beacon POST fallback transports.
* Configurable script position (head or footer) and tracking transport mode.

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

No. The tracker sets no cookies and does not use localStorage, sessionStorage, or any other browser storage.

= Do I need a cookie consent banner? =

Logless Analytics sets no cookies, so it does not add cookies to your banner. Consent rules such as the EU ePrivacy Directive can also cover other ways of reading information from a visitor's device, and your site may use other tools that need consent. Whether your site needs a banner therefore depends on your whole setup and the laws that apply to you, so check with your legal adviser.

= Is Logless Analytics GDPR compliant? =

No plugin can make a website GDPR compliant on its own, because compliance also depends on how you run your site. Logless Analytics is designed to make privacy-friendly analytics easier: strict anonymous mode is on by default, raw IP addresses and User-Agent strings are not stored, data stays in your own database, and you choose how long it is kept. The Privacy & GDPR settings bring these options together.

= Does it store raw IP addresses? =

No. Raw IP addresses are processed in memory for exclusions, pseudonymous session hashing, and optional Pro geolocation logic, but raw IP addresses are not stored in the core analytics tables.

= Does it store raw User-Agent strings? =

No. User-Agent strings are processed in memory for device classification and pseudonymous session hashing, but raw User-Agent strings are not stored in the core analytics tables.

= Where is analytics data stored? =

Core analytics data is stored locally in custom WordPress database tables prefixed with `ppla_`.

= Will it slow down my site? =

The tracking script is about 4 KB (about 2 KB gzipped) and sends one small request to your own site per pageview, plus one per tracked click if you enable outbound link or file download tracking. It loads no third-party scripts. Incoming hits are queued and aggregated in the background, and you can move the script to the footer in the settings.

= Does it work with caching plugins and CDNs? =

Yes. Tracking happens in the visitor's browser and does not depend on a nonce, so pages served from a page cache or CDN are still counted.

= Does it count bots? =

Known bots and crawlers are filtered out by default, based on the User-Agent header. You can turn the filter off in the settings.

= Can I use it alongside Google Analytics? =

Yes. Logless Analytics works independently of other analytics tools. Expect the numbers to differ, because each tool counts visits and filters bots in its own way.

= Is there a limit on traffic or reports? =

No. The free version has no pageview quotas, no time limits, and no locked reports.

= How does the buffer work? =

Incoming hits are written to a local `ppla_buffer` database queue and are aggregated into analytics tables by WP-Cron. A manual flush tool is available in the admin screen.

= Can I exclude administrators or editors? =

Yes. Administrators are excluded by default, and you can also exclude editors and authors so your own visits do not inflate the numbers.

= Can I exclude IP addresses or URLs? =

Yes. You can exclude individual IP addresses and URL paths. A path such as `/checkout/` excludes that page, and `/blog/*` excludes every page below `/blog/`.

= How long is analytics data kept? =

30 days by default. You can choose 90 days, 180 days, one year, or keep the data until you delete it. Older data is removed automatically once a day, and the maintenance tools can delete data at any time.

= Does the plugin send analytics data to a remote service? =

No. Analytics data is stored only in your WordPress database. The plugin uses the Freemius SDK for optional opt-in usage data, licensing, and upgrades; see the External services section for exactly when it contacts Freemius and what it sends. Visitor analytics data is never sent to Freemius.

= What happens on uninstall? =

Deleting the plugin from the Plugins screen removes all of its database tables, options, scheduled events, and per-user report preferences. Deactivating the plugin keeps your data.

== Screenshots ==

1. Overview: pageviews compared with the previous period, the daily traffic trend, and the split between desktop, mobile, and tablet visitors.
2. Top Pages: the pages and posts that get the most views in the last 7, 30, or 90 days, with CSV export.
3. Traffic sources: direct visits, search engines, referring sites, and Google Ads and Meta Ads campaigns, recognized without storing campaign parameters.
4. Real-Time: visits active right now, pageviews per minute over the last 20 minutes, and a live list of pages, sources, and devices.
5. Privacy & GDPR settings: strict anonymous mode by default or daily rotating session hashes, and a data retention period you choose.

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

= 1.0.2 =

* Added: Polish translation included with the plugin, so the dashboard and settings appear in Polish on Polish sites.
* Changed: the plugin is now named "PrimePlaced - Logless Analytics: Cookieless Stats" on the Plugins screen.
* Changed: the dashboard now uses the React JSX runtime that ships with WordPress, so it keeps working when WordPress moves to React 19. WordPress 6.6 or later is now required.
* Fixed: the dashboard could fail to load with a blank screen when no other plugin loaded the WordPress notices script.

= 1.0.1 =

* Added: Help tab with answers to common questions and links to support.
* Added: Upgrade tab that shows what each paid plan includes.
* Improved: the Pricing screen now matches the look of the rest of the plugin.

= 1.0.0 =

* Initial release.
