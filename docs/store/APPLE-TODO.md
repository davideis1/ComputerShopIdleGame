# To do once the Apple Developer account is active

Everything here is waiting on the Apple Developer Program membership (99 USD/year). Tick items off as they're done.
Details for each step are in `RELEASE.md`, `LISTING.md` and `game-center.md`.

## Before (no Apple account needed)
- [ ] Server `inc/config.php`: set `contact_email` (privacy/support pages) and `public_url` (password-reset links shouldn't trust the request Host).
- [ ] Deploy `Main` so the privacy, support and reset pages are live.
- [ ] Stamp the changelog: `node tools/bump-version.js` (or enable the hook: `git config core.hooksPath .githooks`).
- [ ] Retake the store screenshots on the new look (#36) once the open app PRs are merged.

## Account & app record
- [ ] Enrol in the Apple Developer Program and wait for approval (can take a day or two).
- [ ] Xcode → Settings → Accounts: add the Apple ID; in the project, Signing & Capabilities → pick the team (for running on your own iPhone).
- [ ] App Store Connect → My Apps → + New App: name "Mega Byte Computers", bundle ID `com.davideis.computershopidle`, any SKU.
- [ ] Check the App ID has **Game Center** ticked (Certificates, Identifiers & Profiles → Identifiers).

## Game Center (PR #37)
- [ ] App Store Connect → the app → Services → Game Center: turn it on.
- [ ] Add the 28 achievements from `game-center.md` (ids must match exactly; upload the badge PNGs from `docs/store/game-center/`).
- [ ] Create a Sandbox tester (Users and Access → Sandbox) and sign in with it on the test iPhone (Settings → Game Center).
- [ ] Run a development build on the phone: trophies already earned should appear in Game Center, and progress rings should move.

## First build & TestFlight
- [ ] `cd app && npx eas-cli@latest login && npx eas-cli@latest init` (writes the EAS project id into app.json; commit it).
- [ ] `npx eas-cli@latest build --platform ios --profile production` (EAS creates certificates and the provisioning profile).
- [ ] `npx eas-cli@latest submit --platform ios --latest`, then install from TestFlight.
- [ ] Test on a real iPhone: new game, offline catch-up, sign up / sign in / cloud sync, password reset email, Game Center, haptics, all four themes.

## Store listing & review
- [ ] Fill the listing from `LISTING.md`: description, keywords, privacy policy and support URLs, App Privacy answers, age rating, review notes (demo account).
- [ ] Upload the screenshots (6.9" iPhone set).
- [ ] Tick Game Center on the version page so the achievements ship with it.
- [ ] Add for review.
