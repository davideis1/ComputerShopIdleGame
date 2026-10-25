# Game design & engineering review — October 2026

A review of the whole game (web build, `core/` simulation, the Expo app and the PHP backend) from a game-design and engineering point of view. Findings are grounded in the code and in runs of `tools/sim.js` and the `*-check.js` scripts on `Main` @ `49539ee` (all checks currently pass).

Sections: **1. Top priorities** · 2. What already works · 3. Bugs & rough edges · 4. Progression & balance · 5. New feature ideas · 6. Mobile app · 7. Engineering & ops · 8. Suggested roadmap

---

## 1. Top priorities (if you only do ten things)

| # | Item | Type | Effort |
|---|------|------|--------|
| 1 | Hidden browser tab turns into a stream of 1-minute "offline" sessions; the welcome-back sheet shows only the last minute (§3.1) | Bug | S |
| 2 | Prestige runs are gated by the fixed 4-hour calendar, so later runs barely get faster (§4.1) | Design | M |
| 3 | Nothing to do after reaching "today" except prestige (§4.2) | Design | M |
| 4 | Hustle stops mattering after the first ~20 minutes (§4.4) | Design | S |
| 5 | Repairs & services: the biggest thing a real computer shop does that this one doesn't (§5.1) | Feature | M |
| 6 | Player-facing choices in events (§5.2) | Feature | M |
| 7 | CI on pull requests (checks + app typecheck), not only on deploy (§7.1) | Eng | S |
| 8 | `tools/sim.js` doesn't load consoles, managers or names, so balance runs don't reflect the shipped game (§7.2) | Eng | S |
| 9 | Long offline catch-up runs synchronously on the phone's JS thread (§6.1) | Perf | M |
| 10 | Seasonal retail calendar (Christmas, back-to-school, Black Friday) (§5.3) | Feature | S |

---

## 2. What already works well

- **A simulation you can test.** `core/` has no DOM and the same `step()` drives online play, offline catch-up, the web, the app and Node tools. Keep it that way.
- **A demand model with real decisions.** Three customer segments with different price/quality sensitivity mean "cheapest" and "best" are both wrong answers, and the Designer and buyers forecast with the same model (`modelRates`), so automation and the player agree.
- **The theme is strong.** Era palettes, the news ticker, parody names and console generations with launch hype give a 33-year arc that feels like a story.
- **Automation that grows with you.** Clerk → buyers with skills/traits → PC Designer is a good idle-game automation ladder, and the Advisor fills the "what should I do next?" gap.
- **Careful saves.** Rev-checked server saves, rolling backups, server-clock offline time, conflict sheets and a local backup. That's more than most idle games ship.

---

## 3. Bugs & rough edges

### 3.1 Hidden browser tab = many small offline sessions (web) — *fix first*
`js/ui.js:1484-1490`: any tick gap over 10 s calls `goOffline(dt)`. Browsers throttle timers in hidden tabs (Chrome: about once a minute after 5 minutes hidden), so a backgrounded tab becomes a series of ~60 s offline sessions:
- each one with `sec >= 60` opens the welcome-back modal, and `modal()` replaces its contents, so a player who comes back after 3 hours sees **"away for 1 min"**;
- the offline cap (`offlineCap`) is applied per gap, so the Night Lock-Up / Night Shift upgrades do nothing for a player who leaves the tab open in the background;
- `save()` runs every minute while hidden (harmless, but extra server load).

**Fix:** while `document.hidden`, don't step. On `visibilitychange` → visible, run a single `goOffline(now - hiddenAt)`. Keep the `dt > 10` path for real stalls only.

### 3.2 Advisor memory is global, not per shop
`core/advisor.js:29` keeps `mem` (stock-out/walk-out rates) at module level. After a prestige, an import, "Erase all" or a cloud adopt, the first readings compare against the previous state's counters. `sample()` resets when `now < mem.t`, but not when the counters go backwards. **Fix:** reset `mem` when `s.stats.stockouts < mem.stockouts`, or store it on the state object (not serialized).

### 3.3 Stale achievement text
`core/data.js:364` "Employ a manager in **all four** categories". There are now six buyer slots (`pre, bp, game, acc, con, design`). Either rename it ("Buying Team: 4 buyers") or add a "Full House" for all six.

### 3.4 Lifetime stats undercount
`core/engine.js:674` `m.lifeSold += s.stats.sold` counts PCs only. Games, accessories and consoles sold are lost on prestige. Add lifetime totals per category, or a single `lifeUnits`.

### 3.5 Bail-out can be gamed
`core/engine.js:512` gives `cheapest * 2` cash at most every 10 minutes when shelves are empty and cash is short. Spending everything on upgrades and emptying the PC shelves gets a free restock each time. Low impact, but consider a small loan (repaid from the next sales) instead of a gift, which also teaches the player something.

### 3.6 Clock trust on local imports (web)
`js/ui.js:1531/1540` uses `Date.now() - local.saved` (device clock) for the "use newer local copy" and legacy-import paths. A changed device clock gives free offline time there. The app already uses `min(server elapsed, device elapsed)`; do the same on the web, or cap these paths at the offline cap.

### 3.7 Docs housekeeping
`CLAUDE.md` has two `## Change log (newest first)` sections (lines 74 and 82), and several entries still say "(draft)" for PRs that have merged. Merge the two and mark what has shipped.

---

## 4. Progression & balance

Data from `node tools/sim.js` (250 min bot run, engine + add-ons only):

```
first Franchise Token: ~2017, 168 min into the run
end of run (2026):     5 tokens, run revenue 867M, revenue ~300K/s
PC prebuilts:          ~89% of revenue in the bot run
```

### 4.1 The calendar caps prestige pacing — *biggest design issue*
A run's tech level is tied to the calendar (420 s/year, ~4 h to "today"), and revenue depends on what tech exists. HQ upgrades boost demand, margins and cash, but they can't bring 2017 any sooner, so the first token of every run still arrives after ~2–3 hours, and a full run still gives single-digit tokens. Classic idle prestige loops work because each run is **noticeably faster** than the last; here it's only slightly faster.

Options (pick one or two):
- **HQ "Time Warp" upgrade:** +15% calendar speed per level (cap ~3×). Simple and readable.
- **"Head Start":** later runs may open in a later era (1996 → 2000 → 2005), with starting cash scaled to match.
- **Fast-forward the quiet stretches:** a calendar boost while the shop is saturated (all targets met, cash piling up) so the player isn't waiting on the clock.
- Reconsider `TOKEN_R0 = 2e8` relative to how revenue grows with HQ upgrades. Run `sim.js` with a second-run bot that buys HQ upgrades, and check tokens per hour across runs 1–5. That metric should go up each run.

### 4.2 Endgame after "today"
*Addressed in `near-future`: the calendar now carries on to Oct 2035 with two speculative eras (option 1 below); idling past the end barely raises tokens per hour any more.*

At `END_CAL` the calendar stops: no new products, events or eras. A player who doesn't want to prestige has nothing to do. Ideas:
- **"Near Future" content:** a speculative era after 2026 (parody AR glasses, quantum-ish PCs, holo-consoles) with lower-confidence names, so the calendar can keep going.
- **Endgame goals:** per-run challenges (see §5.6) and long achievements ("$1 Qa revenue").
- **Make prestige the obvious next step:** when the calendar ends, the HQ tab should show a projection ("next run: ~X tokens/hour faster").

### 4.3 Revenue mix is lopsided towards prebuilts
In the bot run prebuilts are ~89% of revenue, custom builds ~7% and add-ons ~3.6%. The design target in `CLAUDE.md` is add-ons and consoles at 11–17% each. `console-check` (with buyers) gets closer (games+acc 16–25%, the console line ~17%), so part of this is the bot (see §7.2). But it also suggests the Workshop pays off less than it should for a headline feature. Things to tune:
- Custom builds: CUSTOM_BONUS 1.4 gives a quality edge, but the build pipeline (technicians at 1 PC / 40 s) is slow next to restock rates. Consider cheaper early `cnc`, or a "build to order" mode where custom PCs sell from a queue without taking shelf space.
- Shelf competition: with high targets, PCs fill the shelves and add-ons starve (the sim shows many add-ons at target 1,000+ with stock 0). A **separate add-on shelf capacity** (the Accessories Wall / Software Aisle each give their own space) would make add-ons less fiddly and easier to read.

### 4.4 Active play stops mattering
Hustle sells one customer every 3 s. At 300K/s passive revenue it's worth nothing after the early game. Idle games usually scale the click with income. Ideas:
- Hustle scales: "pitch to a business client", a bulk order sized to ~5–15 s of current revenue.
- **Combo/streak:** consecutive hustles within a window raise the buy chance.
- Late game: replace Hustle with an active ability on a cooldown ("Flash Sale: 2× customers for 30 s", "Press Release: hype a blueprint").

### 4.5 Price is one global slider
`priceAdj` applies to every prebuilt and add-on at once, and blueprints have their own markup. Per-category pricing (PCs / games / accessories / consoles), or per-item overrides from the Stock card, would make the segment model more visible: a player could price premium machines up and keep budget machines cheap. Buyers with Market sense could manage it.

### 4.6 No pressure, no failure
Upkeep never drives cash negative and bail-outs cover empty shelves. That's right for an idle game, but there's also no tension. Softer pressure would add interest without punishing anyone: competitor stores opening nearby (temporary demand drop you can counter with ads), stock that loses value if unsold (it already does through `pdepr`; show "dead stock" more clearly), reputation (§5.4).

---

## 5. New feature ideas

Roughly ordered by value for effort.

### 5.1 Repair & services counter (M) — *strongest thematic gap*
A real computer shop lives on services. Add a **Service Desk** upgrade (1994):
- walk-in repair jobs (virus removal, RAM upgrades, "my modem won't screech"), handled by technicians at a fixed rate;
- **extended warranties** as an attach item on PC sales (a high-margin, very '90s/2000s upsell), with a small claims cost later;
- era-specific services: dial-up setup (1993–2002), Wi-Fi setup (2003+), data recovery, phone screen repair (2010+), "AI PC setup" (2024+).
It gives the Workshop technicians a second use and a revenue line that doesn't take shelf space.

### 5.2 Decision events (M)
Events today are calendar-driven modifiers (`CS.EVENTS`). Add small **choice cards** a few times per era, e.g.:
- "A school district wants 200 PCs at 8% margin, delivered in 2 minutes. Accept?"
- "A distributor offers a container of last-gen GPUs at −40%. Buy?"
- "A tech reviewer wants a free machine for a review" (reputation gamble).
For offline play, either auto-resolve with a "manager's choice" setting or let the offer wait.

### 5.3 Seasonal retail calendar (S)
The calendar is already there. Add a yearly cycle: back-to-school (Aug–Sep, budget segment up), Black Friday (late Nov, demand ×2 at lower prices), Christmas (Dec, consoles/games up), January lull. It's cheap to build (the same shape as `eventsAt`), gives the year a rhythm and a reason to plan stock, and buyers can forecast it.

### 5.4 Reputation / reviews (M)
A shop rating (1–5 ★) driven by stock-outs, walk-outs (`stats.lost`), PC quality sold (`pcRel`) and repairs. It multiplies `lambda`. It turns existing hidden stats into one goal the player can read, and the Advisor can explain it ("walk-outs cost you 0.3★").

### 5.5 Corporate / B2B contracts (M)
From the 2000s: business customers ask for N machines of a spec by a deadline. It uses the Workshop (blueprints that match the spec) and gives custom builds a reason to exist beyond shelf sales. It fits naturally with a scaled-up Hustle (§4.4).

### 5.6 Franchise challenges (M)
Prestige variants that give bonus tokens: "Console Specialist" (no prebuilts), "Boutique" (custom builds only), "Bootstrapped" (no HQ upgrades), "Speedrun to 2005". They add replay value cheaply because all the systems already exist.

### 5.7 Used & trade-in market (M)
Customers trade in old PCs/consoles. Sell them refurbished to the budget segment, or for parts in the Workshop. Thematic, and it gives aged stock a use.

### 5.8 Multiple locations (L)
Today "Franchise" means reset. A later-game layer could open real branches (mall kiosk, superstore, online store) that run on buyers with location-level settings. It's a big system, so only after the prestige pacing work.

### 5.9 Smaller ideas
- **Daily/weekly login goals** with small token-fragment rewards (keep them optional; no FOMO punishments).
- **Era transition moment:** a full-screen card when a new era starts (the web has an era toast; the app doesn't yet) with a recap of what's new.
- **Museum / collection:** trophies for having sold one of every console or a PC from every year. It's a natural collection hook and uses existing data.
- **Statistics graphs:** revenue per year chart in Menu → Statistics (the data is there as EMAs; a small rolling history would be enough).
- **Leaderboards** (opt-in; the `saves` table already stores `total_sold`, `tokens_earned`). Note that the client-side simulation can be edited, so keep them friendly ("friends", "weekly") rather than competitive with prizes.

---

## 6. Mobile app

### 6.1 Offline catch-up blocks the JS thread
`GameProvider.catchUp` → `E.offline` runs synchronously. Measured in Node with the full core: **8 h offline ≈ 1.4 s** (mid-game, 119 items, buyers active); Hermes on a mid-range Android phone is likely several times slower, and it runs again whenever the app returns from background (`dt > 10`). Options:
- chunk it (`E.advance` in 30-minute slices with `await` between them) behind the welcome-back sheet, with a progress bar;
- coarser steps for long gaps (`h` is 5 s above 2 h; 15–30 s past 4 h is enough, since accumulators are already rate-based);
- profile `getItems`/`derive`, which are rebuilt every step and are most of the cost. Caching the item list per in-game month would cut it a lot.

### 6.2 Porting gaps (from `CLAUDE.md`)
Still missing in the app: group/platform filters and the console market panel on Stock, era-change and token-ready toasts, offline report top sellers, advisor/buyer panel collapsed-state persistence, per-theme fonts. The era-change moment and the token-ready toast matter most for the game; the rest is polish.

### 6.3 Duplicated UI logic
`src/stock.ts`, `src/upgrades.ts`, `src/shop.ts` and others port logic from `js/ui.js` (filters, sorts, view models). Over time move these view models into `core/` (e.g. `core/views.js`) so the web and app share them and can't drift. Then `ui.js` and the app components only render.

### 6.4 Notifications
Idle mobile games depend on local notifications: "Your shop's shelves are empty", "Night shift finished (offline cap reached)", "A new console generation launches". `expo-notifications` with scheduled local notifications, no server needed: schedule at `offlineCap` on background. Opt-in on first prestige or after day 1.

### 6.5 Store readiness
Not done yet: TestFlight / Play internal test, Android device run. Before submitting, also: accessibility labels on icon-only buttons (Buy/+pack/Max, steppers), Dynamic Type sanity check on the 9pt tab labels, and a crash reporter (Sentry or the EAS equivalent), because client-only simulations fail silently otherwise.

---

## 7. Engineering & ops

### 7.1 CI for pull requests
`.github/workflows/deploy.yml` only runs on push to `Main` and only runs `sim.js 5`. Add a `checks.yml` on `pull_request`:
`node tools/{mgr,design,console,advisor,custom,names}-check.js`, `node tools/sim.js 30`, and in `app/`: `npm ci && npx tsc --noEmit`. Optionally run the API smoke tests against a MariaDB service container. This is the cheapest protection against balance regressions.

### 7.2 Make `sim.js` match the shipped game
`tools/sim.js` loads only `data.js`, `addons.js` and `engine.js`, so balance numbers leave out consoles, buyers and the Designer, which are part of every real run. Switch it to `require('../core')`, add a bot mode that hires buyers / uses the Designer, and print a **per-run tokens/hour** metric across 3 simulated prestiges (§4.1). Put the headline numbers in a table in `CLAUDE.md` so changes can be compared.

### 7.3 Simulation performance
`step()` calls `derive()` and `getItems()` every tick and builds new arrays/objects for every item (filters, `map`s), and buyers call into the demand model again. That's fine at 4 ticks/s, but it's the main cost of offline catch-up (§6.1). Cheap wins: cache `getItems` structure per calendar month and update only `stock`/`target`; avoid `items.filter(...)` per group per step.

### 7.4 Save size & validation
Saves are JSON strings capped by `MAX_STATE_BYTES`; buyer notebooks, velocity EMAs (`vel`), `acc` and `seen` grow with play. Worth checking a 2026 late-game save size and pruning keys for items that can't be sold any more (`acc`, `vel`, `target` for expired products). The server stores derived columns (`cash`, `tokens`) from client data, which is fine as long as nothing competitive (leaderboards with rewards) is built on them.

### 7.5 Tests for the UI layers
Playwright e2e scripts live only in session scratchpads. Commit a small smoke suite (`tests/e2e/`: load, buy, hustle, save/reload, offline report) so it can run in CI against `php -S`.

---

## 8. Suggested roadmap

1. **Fix pass (1 PR):** hidden-tab offline handling (§3.1), advisor `mem` reset (§3.2), achievement text (§3.3), lifetime stats (§3.4), local-clock cap (§3.6), CLAUDE.md cleanup (§3.7).
2. **Tooling (1 PR):** PR CI (§7.1) + full-core `sim.js` with a prestige metric (§7.2). Do this before balance work so the numbers can be trusted. *Done in `tooling-ci-sim`; baseline numbers are in `CLAUDE.md`.*
3. **Prestige pacing (1–2 PRs):** Time Warp / Head Start HQ upgrades, retune tokens using the new metric (§4.1); token-ready + era toasts in the app. *Done in `prestige-pacing` (Time Warp limited to before 2015; see `CLAUDE.md` Franchise/HQ). The post-today plateau (§4.2) is still open.*
4. **Seasonal calendar + scaled Hustle (1 PR):** small, visible and makes both active and idle play better (§5.3, §4.4).
5. **Service Desk & warranties (1–2 PRs):** the headline new feature (§5.1).
6. **Decision events and reputation (2 PRs)** (§5.2, §5.4).
7. **App:** chunked catch-up + local notifications (§6.1, §6.4), then TestFlight.
8. Later: B2B contracts, challenges, near-future era, multiple locations.
