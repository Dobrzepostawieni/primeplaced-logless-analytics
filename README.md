# PrimePlaced – Logless Analytics

Privacy-first, cookieless analytics for WordPress. Traffic data stays in the
site's own database; no visitor cookies and no raw IP addresses or User-Agent
strings are stored.

This repository holds the human-readable source of the free plugin published
on WordPress.org:
https://wordpress.org/plugins/primeplaced-logless-analytics/

Each release matches the code in the plugin directory's SVN tag of the same
version. Install the plugin from WordPress.org; this repository is for reading
and rebuilding the code.

## Building the admin and tracking scripts

The compiled files in `assets/build/` are generated from `assets/src/`.

Requirements: Node.js 18.12 or newer, npm 8 or newer.

```sh
npm ci
npm run build
```

PHP dependencies (Freemius SDK and the Composer autoloader) are installed with
Composer:

```sh
composer install --no-dev
```

## License

GPL-3.0-or-later. See `LICENSE.txt`.
