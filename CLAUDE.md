# CLAUDE.md — Computer Shop Idle Game

Working notes for this project. **Keep this file up to date**: add a line to the Change log whenever a feature merges, and update the relevant section when architecture, balance numbers or conventions change.

## What this is
An idle shop game (desktop + mobile): run a computer shop from 1993 to today. Parody brand/product names only (never real ones). Start with name-brand prebuilts, later design and build custom PCs, sell games/accessories, consoles, hire buyers, franchise for tokens. Saving and offline progress are hard requirements. Hosted on PHP + MariaDB (user's host).

## Repo & workflow
- GitHub: `davideis1/ComputerShopIdleGame`, default branch **`Main`** (not master). Always branch off latest `origin/Main`.
- **No long-lived integration branch.** The native app (React Native + Expo in `app/`, simulation in `core/`) lives on `Main` like everything else. Branch each feature off the latest `origin/Main` and keep PRs small.
- **Stacking:** avoid stacking more than two PRs deep. If you do stack, open every PR against `Main` (not the branch below), merge them bottom-up with **"Create a merge commit" — never squash** (a squash rewrites the commits, so the next branch re-shows the earlier changes and conflicts). Don't delete a branch another open PR is based on.
- Work on a feature branch, push, open a **draft** PR against `Main`. If a stacked PR's base merges and its branch is deleted, GitHub closes it — rebase onto `Main` and open a new PR.
- Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: <session url>`. PR bodies end with the "Generated with Claude Code" line + session URL.
- The user likes: a quick summary at the end, an offer to subscribe to the PR for review comments.

## Layout
- `core/` — DOM-free simulation, shared by web, Node tools and the React Native app (`require('./core')`). `js/` now holds only `ui.js`.
- `index.php` — game shell (script order matters: data, addons, engine, consoles, managers, advisor, ui). `login/register/logout/account.php`, `inc/` (shared PHP: db, session, CSRF).
- `api/` — `load.php`, `save.php` (rev-checked), `settings.php`, `reset.php`; native-app auth `auth_register.php`, `auth_login.php`, `auth_logout.php`, `auth_delete.php` (see README "Native app API"). `sql/` schema + `upgrade_*.sql`, `tools/install.php` applies them all (deploy runs it).
- `core/data.js` parts/products/upgrades/HQ token upgrades/achievements/events. `core/addons.js` games & accessories. `core/engine.js` core simulation. `core/consoles.js` console gaming. `core/managers.js` buyers + PC Designer. `core/advisor.js` Shop Advisor. `js/ui.js` all rendering.
- `sw.js` service worker caches static assets only (bump `CACHE` when assets change shape). `style.css`, `manifest.json`, `icon.svg`.
- `tools/` headless checks: `sim.js` (balance bot), `mgr-check.js`, `design-check.js`, `console-check.js`, `advisor-check.js`, `custom-check.js`, `api-smoke.js` (website/cookie API) and `api-token-smoke.js` (native token API) — both need a php server + DB. Playwright e2e scripts live in the session scratchpad (not committed); they drive the real UI against `php -S 127.0.0.1:8124`.

## Architecture notes
- **Client-side simulation**: vanilla JS, step-based; the same `step()` runs online and for offline catch-up (server time used for offline duration). State is a plain object (`E.newState/serialize/deserialize`); engine modules attach via `CS.*` hooks (`CS.M`, `CS.Con`, `CS.Advisor`).
- **Saves**: server is source of truth with a `rev` check; `last_tab` column exempts same-tab reloads from conflict prompts; localStorage keeps a backup. Game data (parts, products…) stays in JS files — moving it into the DB was considered and deliberately skipped.
- **Calendar**: 420 s per game year (slowed from the original).
- **Demand model**: 3 customer segments (budget .45 / main .40 / enthusiast .15) via `E.itemWeight(seg, rel, price, y, ref)`; purchase probability `min(.95, 1-exp(-tot/K))`, `K=0.8`; add-on attach scaled by `ADDON_SCALE=0.6`; games gated by PC capability (`pcRel`); console platform market shares + installed base; launch hype/allocation. Managers and the Designer reuse the same model (`modelRates`) to forecast.
- **Economy balance**: per-era payback derivation; add-ons and consoles each ~11–17% of revenue; token curve `floor(4*sqrt(R/2e8) - 3)`. Re-run `node tools/sim.js` after touching economy numbers.
- **Franchise/HQ**: reset to claim Franchise Tokens (late game), spend on persistent HQ upgrades (`t_*` ids, including buyer upgrades `t_mgr*`).
- **Managers** (`core/managers.js`): categories `pre, bp, game, acc, con` + `design`. Skills forecast/negotiate/logistics, traits, presets, per-category cfg, velocity EMAs, `decide()` every 15 s, own order budget, wages in upkeep, pins/skips from the Stock tab, notebook log.
- **PC Designer** (`design` category, `designTick`): picks among 8 concepts using modelled profit gain over the current lineup; auto-prices (Market sense ≥2), sets targets when no Custom Builds buyer, retires obsolete designs, design fee = 12× unit cost; Engineering adds `0.01*level` to `customBonus`. Blueprints it creates carry `bp.by='designer'` (Workshop shows tag + "Take over").

## Versioning & change log popup
- `version.json` (`major.minor.build`): the build number auto-increments on **every commit** via `.githooks/pre-commit` -> `tools/bump-version.js`. Enable once per clone: `git config core.hooksPath .githooks` (the hook does nothing if not enabled; run `node tools/bump-version.js` by hand before a deploy). Bump `major`/`minor` by hand for big releases. If two branches both bump, resolve the `version.json` conflict by taking the higher build and bumping again.
- `changelog.json`: player-facing release notes, newest first. **For every feature/fix, add an entry with `"build": "next"`**; the hook stamps it with the real build number and date on commit. Friendly wording, one short line per change.
- `index.php` injects both files into `window.CSIG` (`version`, `changelog`). `maybeShowWhatsNew` in `js/ui.js` pops up entries newer than `localStorage['csig-seen-build']` (max 5) after launch, waits for the welcome-back report to close, and shows only the latest entry to existing players on first run. Menu -> About shows the version and a "What's new" button.

## Gotchas
- Restock/build accumulators must be capped with `Math.max(6, rate*dt*2)`, not a fixed small number, or fast shops stall.
- UI lists use `syncList` keyed diffing; only disable `tgt` buttons on cards (pin/skip buttons are separate).
- Number formatting rollover (`num()` must not print "1000K").
- Closed `<details>` hide controls from Playwright — open them in tests; wait for init after reloads.
- Sandbox: MariaDB/php servers die between turns. Restart: `mysqld_safe --bind-address=127.0.0.1 &`, `php -S 127.0.0.1:8124 -t . &`, then `php tools/install.php`. Clean smoke users with `DELETE FROM users WHERE username LIKE "smoke%"`.
- **API auth:** `api_guard()` accepts either the website's cookie + CSRF, or `Authorization: Bearer <token>` (no CSRF). A bearer token present but invalid is rejected, never silently downgraded to the cookie. Tokens are stored as SHA-256 only (`api_tokens`), 180-day sliding expiry, max 10 per user. Sign-ups through the API are limited per IP (`register_max_per_ip_hour`, default 5) using `login_attempts` rows with username `@register`.
- **Testing the backend on a Mac without touching the dev DB:** `mariadb-install-db --datadir=<dir> --auth-root-authentication-method=normal`, then `mariadbd --datadir=<dir> --port=3399 --bind-address=127.0.0.1 --socket=/tmp/csig-test.sock` (macOS socket paths are limited to ~100 chars, so keep the socket in /tmp); copy the repo (minus `.git`, `app`, `node_modules`) to a scratch dir with its own `inc/config.php` (raise `register_max_per_ip_hour` and `login_max_per_ip` for repeated runs), run `php tools/install.php` and `php -S 127.0.0.1:8125`, then both smoke scripts.

## Native app plan
React Native (Expo) app reusing the simulation: `engine.js`, `data.js`, `addons.js`, `consoles.js`, `managers.js`, `advisor.js` move into a DOM-free shared `core/` module (imports instead of `CS.*` globals); only `ui.js` is rewritten as native components. Backend stays PHP + MariaDB; needs bearer-token auth + CORS, an in-app delete-account endpoint, and a capped device-clock fallback for offline catch-up. Keep `tools/sim.js` and the `*-check.js` scripts working against `core/`.

### `app/` (Expo, SDK 58, TypeScript)
- Run: `cd app && npm install && npx expo start --ios`. Checks: `npx tsc --noEmit`, `npx expo-doctor`, `npx expo export --platform ios` (proves Metro + Hermes can bundle `core/`).
- Expo Router (file routes in `src/app/`: tabs Shop/Stock/Upgrades/Workshop/Buyers/HQ/Menu; `@/` aliases `src/`). `src/GameProvider.tsx` owns the sim: loads the save, offline catch-up (`E.offline`, gaps >= 60 s, welcome-back sheet), 250 ms tick, autosave every 15 s + on background. `src/storage.ts` = AsyncStorage (`csig-save-v1`). `metro.config.js` watches `../core` and aliases it as `@core`; `src/game.ts` wraps `CS.E`; `src/core.d.ts` declares the untyped module. Add packages with `npx expo install <pkg>` (SDK-compatible versions). Expo APIs change per SDK, so check https://docs.expo.dev/versions/ before using one.
- Bundle ids: `com.davideis1.computershopidle` (iOS + Android) — placeholder, change before the first store build.
- Stock tab: `src/stock.ts` (filters/sorts/tags ported from `js/ui.js` renderCatalog; duplicated logic — move to `core/` if it drifts), `src/components/ItemCard.tsx`, `src/app/stock.tsx`. List rebuilds ~1×/s plus right after a tap (`frame`/`refresh()` from `useGame`). Not yet ported: group/platform filters, console market panel.
- Upgrades tab: `src/upgrades.ts` (ported `renderUpgrades`/`upNow`), `src/app/upgrades.tsx` (SectionList by group, All/Affordable/Not maxed filter, Buy + Max). `src/theme.ts` now has the web's `num()`/`money()` abbreviations (1.2M etc.). Not yet ported: Trophies tab.
- Shop tab: `src/shop.ts` (ported `renderShop`/`renderAdvisor`: alerts, stats, advisor recs), `src/app/index.tsx`. `GameProvider` now also collects the recent-sales log (`saleLines`), hustle (`hustle()` + result), and achievement toasts. Not ported yet: walkers/street animation, themed eras/ticker, advisor open/closed persistence, era-change toast, token-ready toast, offline report details (top sellers).
- Buyers tab: `src/buyers.ts` (ported `MC_SPEC`/`DESIGN_SPEC` control definitions + `renderBuyers` into a view model; hire/fire/train/setCfg wrappers over `CS.M`), `src/app/buyers.tsx` (generic control renderer: ranges are −/+ steppers, toggles are Switches, selects/chips are chip rows). Panels start collapsed. Not ported: collapsed-state persistence.
- Workshop tab: `src/workshop.ts` (ported `renderWorkshop`: locked state, blueprint list with filter/sort, design form with per-slot part pickers, markup/target steppers, delete, take over) + `src/app/workshop.tsx`. `src/components/MgrRow.tsx` (pin/skip when a buyer covers an item) is shared by Workshop and Stock cards. The Stock tab no longer lists blueprints (as on the web: they live in the Workshop).
- Franchise HQ tab: `src/franchise.ts` (ported `renderFranchise`/`tupNow`/`claimTokens`; also `hqVisible`/`buyersVisible` tab rules) + `src/app/franchise.tsx`. `GameProvider.prestige()` swaps in the state from `E.prestige` (replaces `game.current`, clears the sales log, saves). The HQ and Buyers tabs are hidden with `href: null` until they matter (live-updating); the toast banner now lives in `src/components/ToastBanner.tsx` (root layout) so it shows on every tab. Tab labels are 9pt with no item padding so seven tabs fit. Not ported: Trophies tab.
- **Seeding a simulator save:** AsyncStorage on iOS keeps big values in `<app data>/Library/Application Support/<bundle id>/RCTAsyncLocalStorage_V1/<md5 of key>` (manifest.json holds `{"csig-save-v1":null}`); stop the app, write `E.serialize(state)` there, relaunch. Handy for screenshotting late-game screens.
- **Metro gotcha:** do NOT start Metro with `CI=1` for manual testing — it disables file watching and serves stale code. `npx expo run:ios` needs `CI=1` only to skip prompts; then restart Metro with plain `npx expo start --port 8081`. Custom-scheme deep links (`xcrun simctl openurl booted computershopidle:///stock`) trigger an iOS confirmation prompt that can't be dismissed headlessly.
- **Rebuild rule:** a package with native code needs `npx expo run:ios` (or `pod install` in `app/ios` + Xcode Run); JS-only edits just reload. Debug builds need Metro running (`npx expo start`). `ios/` is generated and gitignored. Verified on the iPhone 17 Pro simulator (save survives kill + relaunch, welcome-back sheet).
- Not yet done: Trophies tab, server sync/auth, Android run-through.

## Change log (newest first)
Developer-facing log; the player-facing one is `changelog.json`.
- **server-token-auth (draft)** Native-app backend: bearer-token auth (`api_tokens`), `auth_register/login/logout/delete` endpoints, per-IP sign-up throttle, `.htaccess` Authorization passthrough, `tools/api-token-smoke.js`; deploy no longer uploads `app/`.
- **native-mobile-franchise (draft)** Native Franchise HQ tab (tokens, claim/prestige, permanent HQ and buyer upgrades); HQ/Buyers tabs hide until relevant; global toast banner; tab bar fits seven tabs.
- **native-mobile-workshop (draft)** Native Workshop tab (blueprints, design form, part pickers); shared pin/skip `MgrRow` on Workshop and Stock cards; blueprints removed from the Stock list.
- **native-mobile-buyers (draft, targets `native-mobile-shop`)** Native Buyers tab: Purchasing Office unlock, per-category hire/fire/train, on-duty, plans, all settings via generic controls, notebook.
- **native-mobile-shop (draft, targets `native-mobile-upgrades`)** Real Shop tab: header, storefront shelves, Hustle, alerts, Advisor (buy recs), report grid, recent sales, The Times; achievement toasts.
- **native-mobile-upgrades (draft, targets `native-mobile-stock`)** Native Upgrades tab (overview, filters, buy/max), shared `num`/`money` formatting.
- **native-mobile-stock (draft, targets `native-mobile-expo`)** Native Stock tab: category/age/shelf/sort filters, search, item cards (Buy 1/+pack/Max, auto-restock stepper), pricing policy, aisle unlock.
- **native-mobile-expo (draft, targets `native-mobile-core`/`native-mobile`)** `app/` Expo scaffold: Metro reads `core/`; Expo Router tabs, local AsyncStorage save, offline catch-up + welcome-back sheet.
- **native-mobile-core (draft, targets `native-mobile`)** Simulation moved from `js/` to DOM-free `core/` (+ `core/index.js` loader for Node/React Native); tools, index.php, SW cache bumped; `custom-check` fixed (it was missing addons).
- **#12 (open draft)** also: version number + auto-increment hook, What's new popup.
- **#12 (open draft)** PC Designer buyer; `tools/design-check.js`; Advisor hints; Buyers stat `n / 6`; this file.
- **#11** Collapsible buyer panels (state in localStorage).
- **#10** Console gaming: consoles, console games/accessories, generations with launch events, Console Corner upgrade, Stock filter, Consoles buyer.
- **#9** Shop Advisor box on the shop summary (upgrade suggestions + insights).
- **#8** HQ buyer upgrades (`t_mgr*`).
- **#7/#6** Purchasing managers (one per category, many settings).
- **#5** List filters (current vs old, popularity, etc.).
- **#3** (replaced stacked #4) Games & accessories; slower calendar; Franchise Tokens/HQ.
- **#2/#1** Balance pass; PHP + MariaDB accounts, saves, settings; game core.

## Ideas / not done
- Game data in the database (decided to skip for now).
- Balance pass on the economy with the Designer active (only checked for sanity, not tuned).
