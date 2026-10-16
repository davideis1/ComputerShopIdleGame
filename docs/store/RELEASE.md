# Releasing the app

What is already done in the repo: icon and splash, bundle ID, versions, privacy manifest, privacy and support pages, in-app account
deletion, EAS config (`app/eas.json`). What follows needs your accounts and cannot be done from the code.

## 0. Risk to decide on first: parody names
The game uses made-up names that are obvious parodies of real brands (Compac, Dall, Intal, Envidia, Nintendough, PlayStatic, Xbux, Pokemun...).
Apple guideline 5.2 (Intellectual Property) can reject apps whose names or art read as another company's trademark, and review is
done by a person looking at the screenshots. There is precedent for parody names in simulation games on the store, and the app already says
"not affiliated with any real company" in About and in the privacy policy, but it is **not guaranteed to pass**. Cheapest mitigation:
keep the screenshots on screens that show few brand names, include the disclaimer in the review notes (done in LISTING.md), and be ready
to rename the most pointed ones if Apple asks. Google Play has similar rules (impersonation / IP).

### Names found in a scan of the game data
A scan of all ~1,450 player-visible strings (products, parts, upgrades, events, headlines, add-ons, platforms) found these that are **not** disguised,
which goes against the project rule of parody names only:
- `core/data.js`, upgrade **"Geocities Web Page"**: a real (defunct) brand name used as is.
- `core/addons.js`, game publishers **"Sega-ish"** and **"Nintendo-ish"** (and the game "Stardew-ish Valley"): real trademarks with a suffix.
- Close spoofs that read very clearly as the original: "Grand Theft Auto-mobile", "Call of Duty-Free", plus the hardware parodies (Microsaft, Dall, Intal, Envidia, Windoze, Nintendough, PlayStatic, Xbux, Pokemun...).
Renaming the undisguised ones is a one-line change each and is the cheapest way to cut the risk. Decide how far to go with the close spoofs.

## 1. Before you build
1. **Contact address.** The privacy and support pages show a "no contact address" notice until you add one. On the server edit `inc/config.php`
   (it is never deployed or committed) and add `'contact_email' => 'you@example.com',`. Reload https://computershopidlegame.davideis.com/privacy.php to check.
2. **Deploy this branch** so the privacy and support pages are live (the stores check the URLs).
3. Confirm the production API URL in `app/app.json` (`extra.apiBase`) is the live site.
4. Optional but recommended: a way to reset a forgotten password. There is none yet (it needs an email address), so support is manual.
   See "Known gaps".

## 2. Accounts you need
- Apple Developer Program, 99 USD/year (developer.apple.com/programs). Enrolment can take a day or two.
- Google Play Console, 25 USD one-off (play.google.com/console).
- A free Expo account (expo.dev) for EAS cloud builds. No Mac or Xcode is needed for store builds.

## 3. iOS
```
cd app
npx eas-cli@latest login
npx eas-cli@latest init                       # creates the EAS project and writes its id into app.json
npx eas-cli@latest build --platform ios --profile production
```
EAS asks for your Apple ID and creates the bundle ID, certificates and provisioning profile for you.
Then in App Store Connect: My Apps > + > New App (bundle ID `com.davideis.computershopidle`, any SKU), fill the listing from `LISTING.md`
(privacy policy URL, App Privacy answers, age rating, screenshots, review notes), then:
```
npx eas-cli@latest submit --platform ios --latest
```
The build appears in TestFlight after processing. Test it on a real iPhone, then "Add for review". Review usually takes 1 to 2 days.

## 4. Android
1. Play Console > Create app (package `com.davideis.computershopidle`), fill the store listing, Data safety form and content rating from `LISTING.md`.
2. `npx eas-cli@latest build --platform android --profile production` produces an `.aab`.
3. The first upload of a new app has to be done by hand in the Console (Testing > Internal testing > Create release). After that
   `eas submit --platform android` works if you add a Google service-account key (see Expo's docs).
4. New personal developer accounts must run a **closed test with a minimum number of testers for a minimum number of days
   (12 testers for 14 days at the time of writing; check the current rule)** before they can publish to production.
5. The app has **never been run on Android** (no emulator here). Test the internal-testing build on a real Android phone first.

## 5. Versioning
`version` in `app.json` is the user-visible number (1.0.0). Build numbers (iOS `buildNumber`, Android `versionCode`) are incremented
automatically by EAS (`appVersionSource: remote`, `autoIncrement: true`), so you only edit `version` for a new release.

## 6. Updating later
There is no over-the-air update service configured (`expo-updates` is not installed), so every change, including JavaScript-only ones, needs a new build
and store review. Adding `expo-updates` would allow JS-only hot fixes; it is a separate, optional step.

## Known gaps before or soon after launch
- **No password reset.** Accounts have no email, so a forgotten password means contacting you (support page says so).
- **Android untested** on a device (config and bundle verified only).
- **iPad turned off** (`supportsTablet: false`) because the layout is phone-first; the app runs on iPads in compatibility mode if you ever enable it.
- Export/import of saves, the news ticker, themes and the street animation from the website are not in the app.
- `npm audit` reports vulnerabilities in the React Native build toolchain (dev-time packages); none ship in the app.
