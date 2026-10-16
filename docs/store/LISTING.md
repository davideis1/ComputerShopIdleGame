# Store listing draft: Mega Byte Computers

Copy-paste material and questionnaire answers for App Store Connect and Google Play Console. Everything here is a draft
for the owner to review; nothing has been submitted.

## Identity
| | |
|---|---|
| Name (both stores, max 30 chars) | **Mega Byte Computers** (App Store names must be unique; fall back to "Mega Byte Computers: Idle Shop" if taken) |
| Bundle ID / package | `com.davideis.computershopidle` (permanent once created) |
| Subtitle (App Store, max 30) | Idle computer shop, 1993 to now |
| Category | Games > Simulation (secondary: Games > Strategy) |
| Price | Free, no in-app purchases, no ads |
| Privacy policy URL | https://computershopidlegame.davideis.com/privacy.php |
| Support URL | https://computershopidlegame.davideis.com/support.php |
| Marketing URL (optional) | https://computershopidlegame.davideis.com/ |

## Short text
**Google Play short description (max 80):** Run a computer shop from 1993 to today. Idle, retro, and surprisingly deep.

**App Store promotional text (max 170):** Start with a corner shop and a beige box in 1993. Ride the dial-up, dot-com, and RGB eras, hire buyers, design your own PCs, and franchise your way to the top.

**Keywords (App Store, max 100, comma separated):** idle,tycoon,shop,computer,retro,management,incremental,clicker,simulation,business,90s,pc

## Description (max 4000)
Open your first computer shop in 1993 and grow it into an empire that reaches all the way to today.

You start small: a handful of name-brand beige boxes, a till, and a street full of customers who care about price and power in different measures. As the years roll by the world changes around you. Dial-up gives way to broadband, the dot-com bubble inflates and bursts, chip shortages bite, and the RGB era arrives. Your shop has to keep up.

- **Run the shop.** Stock prebuilt PCs, games, accessories and consoles. Set prices, hustle a customer yourself, and expand the floor.
- **Build your own PCs.** Open the workshop, pick parts from a catalogue of about 130 components, and sell computers of your own design.
- **Hire a team.** Purchasing managers read the market, set stock levels and place orders for you. A PC Designer studies demand and designs new models on its own.
- **Idle-friendly.** Your shop keeps trading while you are away, with a "welcome back" report when you return.
- **Franchise.** Sell up, earn Franchise Tokens, and spend them on permanent upgrades for the next run.
- **Play your way.** No account needed. Create a free one only if you want your shop saved in the cloud and shared between devices.

No ads. No in-app purchases. No tracking.

All brand and product names in the game are parodies and are not affiliated with any real company.

## What's new (first release)
First release.

## Age rating (answers for the questionnaires)
Expect **4+ (Apple) / Everyone (Google)**. No violence, no mature or suggestive content, no profanity, no gambling or simulated gambling,
no horror, no medical content, no user-generated content visible to other players, no in-app purchases, no unrestricted web access
(the app only opens its own privacy and support pages). The game contains satirical parodies of real company names (see the risk note in RELEASE.md).

## App Privacy ("nutrition label") for App Store Connect
Tracking: **No.** Data not collected when playing without an account.

| Data type | Collected? | Linked to user | Used for | Notes |
|---|---|---|---|---|
| User ID (the username) | Yes (account only) | Yes | App functionality | Sign-in |
| Gameplay Content (the saved shop) | Yes (account only) | Yes | App functionality | Cloud save and sync |
| Credentials (password) | Stored only as a one-way hash | - | App functionality | Apple has no separate password category; the hash is never readable |
| IP address | Short-lived security records (about a day) for throttling sign-in/sign-up | Not used for profiling | App functionality / security | **Check the current wording in App Connect:** declare it if the questionnaire says IP addresses used for security count |
| Device identifier | A random install id made by the app and sent with saves | Not an advertising id | App functionality | Declare as "Device ID" if you want to be conservative |

The app's own `PrivacyInfo.xcprivacy` (generated from `app.json`) already declares User ID and Gameplay Content as linked, not tracking,
for app functionality, plus the required-reason API codes used by its libraries.

Account deletion: available **in the app** (Menu > Account > Delete account) and on the website. Required by guideline 5.1.1(v).
Export compliance: only standard HTTPS, so `ITSAppUsesNonExemptEncryption = false` is already set.

## Google Play "Data safety" answers
- Collects data: **Yes (only if the user creates an account).** Shares data with third parties: **No.**
- Personal info > User IDs (username): collected, required, for app functionality and account management.
- App activity / User content > the saved shop: collected, optional (account only), for app functionality.
- Data encrypted in transit: **Yes (HTTPS).**
- Users can request deletion: **Yes.** In-app: Menu > Account > Delete account. Web link to give Play:
  https://computershopidlegame.davideis.com/support.php (describes deleting at /account.php).
- No ads, no analytics, no data used for tracking.

## App Review notes (paste into App Store Connect)
> No sign-in is needed: the game is fully playable as a guest. To test the account features, tap Menu > Account > Create account
> (registration is open, any username and an 8+ character password). Account deletion is in the same place (Menu > Account > Delete account).
> All brand and product names in the game are fictional parodies; the About panel and the privacy page say they are not affiliated with any real company.

## Assets still to make
- iPhone screenshots at **1320 x 2868** (6.9") are required; 2-10 images. The app is iPhone-only (`supportsTablet: false`), so no iPad screenshots.
- Play Store: icon 512 x 512 (resize `app/assets/icon.png`), feature graphic 1024 x 500, at least 2 phone screenshots.
