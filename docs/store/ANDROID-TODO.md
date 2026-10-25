# To do once the Google Play Console account exists

Everything here waits on a Play Console developer account (one-off 25 USD). The Android app itself builds and runs: checked on an
Android 17 emulator (2026-10-25), debug and release (`bundleRelease`) builds, version 1.1.x, target API 36.
Details: `RELEASE.md` (section 4), `LISTING.md`, `play-games.md`.

## Account & app record
- [ ] Create the Play Console developer account and verify your identity.
- [ ] Create the app: name "Mega Byte Computers", package `com.davideis.computershopidle`, free, game.
- [ ] Fill the store listing, content rating and **Data safety** form from `LISTING.md` (it now lists the optional Play Games player ID).
- [ ] Privacy policy URL: https://computershopidlegame.davideis.com/privacy.php

## First build & internal test
- [ ] `cd app && npx eas-cli@latest login && npx eas-cli@latest init` (skip if already done for iOS).
- [ ] `npx eas-cli@latest build --platform android --profile production` → an `.aab`.
- [ ] Upload it by hand to Testing → Internal testing → Create release (the first upload can't be scripted); add yourself as a tester.
- [ ] Install from the internal-test link on a real phone: new game, offline catch-up, reminders (Menu → Look → on; the Android 13+ permission prompt), sign up / sign in / cloud sync, password reset email, all five themes, the 8 tabs fit.
- [ ] A personal developer account must run a **closed test with 12+ testers for 14+ days** before production (check the current rule).

## Google Play Games (see `play-games.md` for every step)
- [ ] Play Games Services → Configuration: create the Game Services project; note the **Project ID**.
- [ ] Add credentials: **Android** (package + the SHA-1 of the signing key: use the one from *App signing* once the app is uploaded) and **Game server** (web OAuth client).
- [ ] Put the Project ID in `app/app.json` (`["./plugins/withPlayGames", { "projectId": "…" }]`), the web client id in `extra.playGamesWebClientId`, and the client id + secret in the server's `inc/config.php` (`pg_client_id`, `pg_client_secret`). The secret never goes in the repo.
- [ ] Achievements → Import `docs/store/play-games/play-games-achievements.zip`; then Get resources → `node tools/pg-achievements.js --ids resources.xml`; commit `app/src/playgames-ids.json`.
- [ ] Add yourself as a Play Games tester; build again; check: trophies appear in Play Games with progress rings, Menu → Account → *Continue with Google Play Games* creates an account and syncs, linking works from a password account, a second phone signs back in.
- [ ] Publish Play Games Services with the app.
- [ ] Server: deploy runs `tools/install.php` (adds `users.pg_player_id`, `sql/upgrade_006_play_games.sql`).

## Listing assets
- [ ] Feature graphic (1024×500) and the app icon (512×512, from `app/assets`); phone screenshots (Android ones: capture on the emulator, see `LISTING.md`).
- [ ] Short and full description from `LISTING.md`.

## Before every release
- [ ] `node tools/sync-release.js` (or the commit hook) so the app version matches the website; EAS bumps `versionCode` itself.
