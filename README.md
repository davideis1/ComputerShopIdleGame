# Mega Byte Computers — an idle computer-shop game

Run a computer shop from **1993 to today**. Start by reselling parody-branded prebuilts (Compac, Dall, Gatewhey, Ample…), then open a workshop and sell PCs you design yourself from parody parts (Intal, AMB, Envidia, Radian…).

Browser game (vanilla JS) with a PHP + MariaDB backend for accounts, saves and settings. Works on desktop and mobile, installable as a PWA.

## Hosting (PHP + MariaDB)
Requirements: PHP 7.4+ with PDO MySQL, MariaDB 10.3+ (or MySQL 5.7+), HTTPS recommended. No Composer or build step.

1. Upload the repo contents to your web root (or a sub-folder).
2. Create a database and user in your host's control panel.
3. Copy `inc/config.sample.php` to `inc/config.php` and fill in the database details.
4. Create the tables with either `php tools/install.php` (SSH; also upgrades an existing database) or by importing `sql/schema.sql` in phpMyAdmin.
5. Open the site, register an account, play. Set `allow_registration` to `false` in the config once your players have signed up.

Apache: the bundled `.htaccess` files block `inc/`, `sql/` and `tools/`. On nginx add `location ~ ^/(inc|sql|tools)/ { deny all; }`.
Lost password (there is no email): `php tools/reset_password.php <username> <new-password>`.

### How it fits together
- The game simulation (`core/engine.js`) runs in the browser, so it stays smooth. PHP handles accounts and storage.
- `index.php` requires login and boots the game with the player's save, settings and CSRF token.
- `api/save.php` stores the state (revision-checked so two tabs/devices cannot silently overwrite each other); `api/settings.php` stores theme and display options; `api/reset.php` deletes a shop.
- **Offline progress is measured on the server clock** (time since the last save), so changing the device clock does not cheat it. The browser also keeps a per-user local backup and offers to restore it if a save never reached the server.
- Progress is client-authoritative (the server validates shape and ranges only). Fine for a single-player game; a leaderboard would need server-side verification.

### Database
`users`, `saves` (one row per player: state JSON plus summary columns such as `game_years`, `cash`, `total_sold`), `save_backups` (newest 5, at most one per 10 min), `user_settings`, `login_attempts` (failed-login throttling, plus a per-IP sign-up count for the app API), `api_tokens` (native-app logins; only a SHA-256 of each token is stored). Restore a backup by hand:
```sql
UPDATE saves s JOIN save_backups b ON b.id = 123 AND b.user_id = s.user_id SET s.state = b.state, s.rev = s.rev + 1;
```

### Native app API
The mobile app talks to the same `save.php` / `load.php` / `settings.php` / `reset.php` endpoints as the website, but signs in with a token instead of a cookie. All endpoints take and return JSON over POST.

| Endpoint | Body | Result |
|---|---|---|
| `api/auth_register.php` | `{username, password, label?}` | `201 {ok, token, user}` (errors: `bad_username`, `bad_password`, `username_taken`, `registration_closed`, `too_many_attempts`) |
| `api/auth_login.php` | `{username, password, label?}` | `{ok, token, user}` (`bad_credentials` 401, `too_many_attempts` 429) |
| `api/auth_logout.php` | `{all?}` | revokes this token (or all of the account's tokens) |
| `api/auth_delete.php` | `{password, confirm: "DELETE"}` | permanently deletes the account (required by the App Store) |

Send `Authorization: Bearer <token>` on every other call (`X-Api-Token: <token>` also works, for hosts that strip `Authorization`; `.htaccess` already forwards it on Apache). No CSRF token is needed with a bearer token. Tokens last 180 days from last use, at most 10 per account (the oldest is dropped), and are revoked on logout or account deletion. Apps are not browsers, so no CORS headers are needed.

## Local development
```
cp inc/config.sample.php inc/config.php   # point it at a local MariaDB
php tools/install.php
php -S localhost:8000
node tools/api-smoke.js http://localhost:8000         # website (cookie) backend checks
node tools/api-token-smoke.js http://localhost:8000    # native-app token API checks (add --throttle for the sign-up limit)
```

## Features
- Calendar advances 1 year per 7 minutes (about 4 hours from 1993 to today); the UI theme changes by era (Win95 → XP → Flat → RGB).
- Prebuilt catalog (~50 models) that age, get cheaper and fall out of fashion; custom PC blueprints from ~130 parts.
- Three customer segments (budget / mainstream / enthusiast) weigh performance against price.
- **Games & accessories**: open the Software Aisle and Accessories Wall, then stock ~70 parody PC games and ~85 accessories (keyboards, monitors, modems, VR…). Shoppers add items on, PC buyers twice as likely; games only sell well if the PCs you sell are powerful enough to run them. Cases are reordered automatically by your clerks.
- **Console gaming**: open the Console Corner (any year) to sell ~28 parody platforms across nine generations (Seegah Genesys, Super Nintendough, PlayStatic 1-5, Xbux, Nintendough Swatch…), their ~210 games and ~70 accessories. Each platform has a market share that rises, peaks and fades; launches bring hype and limited supply. Console games and accessories sell to people who own that platform, and every console you sell builds your own installed base, which lifts that platform's game sales. There is a Console market panel in the Stock tab and a fifth purchasing manager category.
- **Purchasing managers**: open the Purchasing Office (1995+) and hire a buyer for each category (computers, custom builds, games, accessories). Each has three skills (forecasting, negotiation, logistics), a trait and a wage. They read sales trends, set stock levels and place the orders. Per-buyer settings: preset (balanced, lean, stock-up, trend chaser, clearance, margin hunter), priority, stock cover and safety buffer, product limit, cash reserve and order limits, shelf-space allowance, age/margin/price/brand/group filters, trend sensitivity, event and price-spike planning, test orders for new releases and markdowns. Pin or skip single products from the Stock tab. Nine permanent HQ upgrades improve buyers (skills, wages, hiring and training costs, order speed, products stocked, free hires and a starting Purchasing Office).
- **PC Designer**: a sixth hire in the Buyers tab (needs the Build Workshop). It studies demand with the shop's own sales model, designs custom-PC blueprints (Office, Budget, Value, Standard, Gamer, Creator, Power, Flagship concepts built from the newest parts), pays a design fee, prices them to the market (needs Market sense 2), sets auto-build targets and retires obsolete designs. Skills: Market sense (auto pricing, waits out imminent part generations), Engineering (+1% custom-build quality per level), Throughput (faster rounds, more concepts). Settings include presets, designs kept, part tiers, markup range, margin and cost limits, free blueprint slots, name prefix. Auto-designed blueprints are tagged in the Workshop and can be taken over. `node tools/design-check.js` runs a headless check.
- **Advisor**: a box on the Shop tab that suggests the best next upgrades (with estimated payback and one-tap buy, including how long to save up) and highlights things worth knowing: checkout vs marketing bottlenecks, full or empty shelves, top earners and fading lines, old stock, wages vs sales, upcoming events, buyers, blueprints, unattended trading and Franchise Token progress. Collapsible; estimates only.
- **List filters**: Stock tab (age, shelf, sort by newest/popularity/profit/margin/price/stock/name, accessory group, search), blueprints, upgrades, HQ upgrades and trophies. Choices are remembered per browser.
- **Franchise Tokens**: once total sales pass $200M you earn tokens (more as sales grow). Sell up and restart in 1993 to claim them, then spend them in the HQ tab on permanent upgrades. Tokens, HQ upgrades and trophies survive the reset; "Erase all" in the Menu removes them too.
- Marketing, checkout, stock and workshop upgrades per era; timeline events (Y2K, dot-com bust, crypto craze, chip shortage…).
- **Accounts & saving**: login, server-side saves (autosave every 15s, on leaving, with local backup), per-user settings, export/import codes, reset.
- **Offline progress**: the same simulation is run in bulk on return (capped at 4h, upgradeable; the calendar moves at 1/20 speed while away), timed by the server, with a "welcome back" report.

## Dev
`node tools/sim.js [minutes] [franchises]` runs the engine headless with a simple bot for balance checks; `node tools/console-check.js` checks the console catalogue, market and installed-base effect; `node tools/advisor-check.js` prints the advisor's output for typical situations; `node tools/mgr-check.js [year]` exercises the purchasing managers; `node tools/custom-check.js` compares custom rigs against the best prebuilts per year.
All brand/product names are parodies and not affiliated with any real company.
