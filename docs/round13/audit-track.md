# Round 13 · Friction audit: track (Progress, Calendar, charts, Fuel, Supplements, Reminders, Quick log, You, Watch & health, Tracker, Recovery)

Walked by clicking (Playwright, 390 px, light and dark) with a new-user seed and a regular-user seed (6 weeks of
sessions, Fitbit + WHOOP rows, meals, water, supplements with reminders). Seeds: `/tmp/claude-0/shots/audit-track/reg.json`,
`new.json`, `nosleeptimes.json` (every sleep row without start/end). Helper: `shot.cjs` there (adds `--clickx` exact
text, `--type`, `--aria`, `--scroll`); `run.sh name path seed …` shoots light + dark.

## Naming decision: Fitbit vs Google Health

The Fitbit phone app is now called Google Health, but people know their watch as a Fitbit. Rule (in `src/health/guides.ts`):
- Where a number's source is named (Tracker, Watch & health, Calendar, brand status lines, "Data is arriving from…"): **Fitbit**.
- Where you must find the app (Get / Open buttons, "Turn on Health Connect in …", the diagram's app node): **Google Health**,
  and the brand page says once: "Your watch only pairs with the Google Health app (the Fitbit app's new name)".
- Watch & health intro: "Fitbit's Google Health app, WHOOP, Samsung Health…".
- You: the group is now "Watch & health" (same as the screen); its first row is "Connect a watch" / "Connected watch · Fitbit".

## Issues and fixes

| Issue | Screen | Fix |
|---|---|---|
| Live card could read "Live from Live" (device advertises a generic name) | Tracker | `app/tracker.tsx`: device names that are empty, "Live", "HR", "Heart rate (sensor)" fall back to "your strap" / "your ring" |
| Readiness turned NaN when a sleep row had no start/end | Recovery, Progress door, Today ring | `src/health/readiness.ts`: nights without valid times skipped for "Sleep times"; sleep minutes must be finite; non-finite z returns "no score" instead of NaN; selfcheck case added. `app/recovery.tsx`: clock line hidden when times are missing |
| Low-water insight said "You're at 2.4 of 10 glasses" | Today insights | `src/engine.ts`: "You're at 600 ml of 2,500 ml" (rounded to 50 ml; inline 250 ml unit to keep the store out of the engine) |
| Fitbit called "Google Health" on connect pages and Tracker, "Fitbit" in Calendar | Tracker, Watch, Connect, Calendar | Rule above (`guides.ts` ORIGINS, `ConnectWatch.tsx` `src` name, `watch.tsx` intro) |
| Health Connect skin-temperature tile always "—  We can't read it from Health Connect yet" (looked like an error) | Tracker | Tile shows only when a value exists; Connect › What Gym Buddy gets still lists it as "We can't read it yet" |
| "Your watch" heading over a "Watch & health" row | You | Group renamed "Watch & health"; row "Connect a watch" / "Connected watch" with the app name |
| "Connect a …" truncated by "Fitbit, WHOOP and more" | You (new user) | Value "Fitbit, WHOOP…" |
| "water on" lower-case value | You | "Water on", "2 meals and water on" |
| "Your WHOOP only pairs with WHOOP. WHOOP shares…"; "Get Watch app", "Turn on Health Connect in Watch app" | Connect › WHOOP / Other | "…only pairs with the WHOOP app. It shares your data…"; Other: "its own app", "Get your watch's app", "…in your watch's app" |
| "0h 10m short", "Awake 0h 25m", possible "7h 60m" | Recovery, Tracker, Body & watch, Calendar, Progress | One `hm()` everywhere: "10 min", "7h 05m" |
| Effort "Running 44" (number with no meaning, barbell icon for a run) | Recovery | "Effort 44 / 100", walk icon for runs/rides |
| New user: seven "0" effort bars | Recovery | Bars hidden until there is effort; line explains the 0–100 scale |
| New user: "0 workouts · 0 kg · 0 min" | Progress | One tappable line "Your first workout fills this in" → Today |
| "8.6 t volume" (jargon) | Progress | "8.6 tonnes lifted" / "450 kg lifted" |
| "From your watch: Fitbit, Your phone, WHOOP" | Calendar | Phone origins left out of the watch list; line may wrap to 2 lines |
| "Planned, not done", "From:", "131 bpm avg" wrapping "avg" alone | Calendar day sheet | "Planned, no workout logged", "Made up of", "avg 131 bpm" |
| A day marked "Rest day" looked grey like Sick/Travel, not like the legend's Rest day | Calendar | Marked rest days use the rest colour (bed badge kept) |
| Day sheet water used the person's glass size on 250 ml units (wrong when glass ≠ 250) | Calendar day sheet | `ml(toMl(units))`: "1,750 ml" |
| "est. 1RM" jargon | Strength chart | "about 70 kg for one rep", "Estimated one-rep max" |
| Last-value label sat on the line at the top of the chart | All line charts | `src/charts.tsx`: 22 px headroom |
| 14 bar values ran into each other ("10.610.4") | Body & watch, Fuel chart | `Bars`: on narrow bars only today's value shows, with a unit (`fmt`: "7.1k", "1 L") |
| "9.0 k steps", "7.3 h" averages | Body & watch | "8,993 steps", "7h 18m" |
| "1 weigh-ins"; stepper started at profile weight; "-" in the diff column | Body weight | Plural fixed; stepper starts at last weigh-in; blank instead of "-" |
| Strength empty state had no action | Strength chart | "See today's workout" button (`Panel` gained an optional action) |
| Water chart in glasses against the auto goal | Fuel and water chart | ml/L against the person's own goal: "Days at your goal · 2,500 ml a day" |
| "1060 kcal" vs "2,085" elsewhere; possible decimals after ½ servings | Fuel meals, Quick log | Whole numbers with separators |
| Hint "Tap a food to change the amount" but the sheet edits numbers | Fuel | "Tap a food to fix its numbers, move it or remove it." |
| Times mixed: "18:00" (Reminders), "9:00" (Supplements), "6:00 pm" (You), AM/PM wheels; hour steppers "21 :00" | Reminders, Supplements, Fuel water sheet | One 12-hour format ("6:00 pm") everywhere in my files; hour steppers show "9:00 pm" with 44 px −/+ |
| Quick log: "1 L of 2.5 L" vs Fuel "1,000 / 2,500 ml"; old supplement names ("Creatine monohydrate", "Whey or pea protein"); water line truncated next to Undo; 40 px chips | Quick log | "1,250 of 2,500 ml"; short names as on Supplements; 2-line subtitles; 44 px chips and pills |
| Tracker pane "resting 59" without unit | Today › Tracker pane | "resting bpm" |
| Filled "Theme" button in the header of Plan / Where you train / About you | Profile | Removed (Theme stays in You › Look and feel) |
| Bold action links (Undo, Log it, Turn on) | Fuel, food sheet, Supplements | SemiBold |

Coordinator asks, done:
- Safety: "Safety and disclaimer" row in You › More; `SafetyNote` at the bottom of every Profile section and of Supplements (replaces the old grey line).
- Rest timer: `restAlert(seconds, next?)` in `src/notify.ts` uses its own Android channel `rest` ("Rest timer", high importance,
  one short buzz), created once; the optional `next` ("Set 3 · Bench press 60 kg × 8") replaces "Next set. Let's go."
  Existing callers unchanged. Code-read only.

## Left, and why

- "Not shared by Fitbit" under SpO2 on Tracker: honest and specific, kept.
- Missed planned days as red dashed rings: calendar stream's research-backed design; kept.
- Web-only focus outline on the food search box: browser default, not on phones.
- Quick log Weight stepper's −/+ come from `Stepper` in `src/ui.tsx` (not mine); under 44 px there.
- "Try Seitan and soya chunks" capital mid-sentence: lowering every name would break "Greek yogurt"; minor.
- Seed-only mismatch (Journey "Now 72.0" vs weigh-in 72.4): `logWeight` keeps them in step for real users.

## Not verified (native only)

Live heart rate label (no live source on web; logic read), notifications (rest channel, supplement times), Health Connect sync.

## Screenshots (`/tmp/claude-0/shots/audit-track/`, each `-light.png` and `-dark.png`)

you, you2, you-new · watch, watch-new, pick, fitbit, fitbit-new, whoop, colmi, other · tracker, tracker2, tracker3,
tracker-new · recovery, recovery2, recovery-new, recovery-notimes · progress, progress2, progress-new · history, oct,
day-ours, day-ours2, day-watch, day-missed, day-today, mark-rest · chart-strength, chart-strength-new, chart-weight,
chart-weight-new, chart-body, chart-body2, chart-body-new, chart-fuel · fuel, fuel2, fuel3, fuel-new, log-sheet,
log-search, serving, edit, water-sheet · supps, supps-new, supps-edit, supps-bottom · reminders, reminders2, reminders3 ·
ql, ql-new · food · profile-about, profile-plan · you-tracker-pane (Today pane).

Checks: `npx tsc --noEmit`, `node scripts/check.mjs`, `selfcheck.mjs` pass.
