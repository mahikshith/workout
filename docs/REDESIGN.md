# Round 10: redesign from scratch + watch data

Status: **draft for review**. Nothing is built until the owner approves this plan and the prototype.

Sources: our own screen audit, a study of Google Fitbit (2025-26 redesign), Whoop (2025 home), openGym
(AGPL, structure only, no code copied), Hevy, Strong, Apple Fitness and Strava, and a survey of every
route for getting watch data into an offline Android app. Links are at the end.

## 1. What is wrong today (audit)

- 5 tabs plus a hidden 6th ("You"), and inactive tabs show no label.
- The exercise library has two homes (Exercises tab and Plans → Library).
- Two broken back paths: exercise info opened from a workout pushes a *second* workout screen; the
  workout summary is a dead end (Log a meal leaves it for good).
- Plan detail shows every day but cannot start one.
- Leaving a running workout hides it completely: no bar, no resume button.
- The same number lives on up to 5 screens (streak: Today pill, Today slim bar, Progress, History,
  Summary; water: 4 places; weight logger: 3 places; place switch: 4 places).
- Progress has 11 sections. Today has 9 blocks and about 12 different actions. Fuel has 5 folds.
- "Start workout" appears twice in a row (Today, then again inside the session).
- Four copies of a segmented control, three of `Meta`, seven hand-made back buttons.

## 2. The new shape

### Tabs: 4 labelled tabs + a centre Start button

```
 Today    Train    ( ▶ Start )    Progress    Fuel
```

| Slot | Owns | Was |
|---|---|---|
| **Today** | What to do now. One hero card, three rings, week strip. | Today |
| **Train** | Your plan on top, then one search field and the whole exercise library, then other plans. | Exercises + Plans + Library |
| **Start** (centre, not a tab) | 1 tap starts today's workout. While a workout runs it turns into **Resume 12:34**. On a rest day it opens a small sheet: Train anyway / Quick 20 min / Pick exercises. | Start buttons scattered on Today |
| **Progress** | This week, then 4 cards that each open one chart: Strength, Body weight, Consistency (calendar + history), Body & watch (steps, sleep, heart). | Progress (11 sections) + History |
| **Fuel** | Today's food and water, one Add button. Recipes and foods open from it. | Fuel |

Profile, settings, reminders, etiquette and **Watch & health** live behind the avatar at the top right
of every tab (one pushed screen, grouped list).

Labels are always visible. Tapping the tab you're on scrolls to the top, then pops to its root.

### Navigation rules (every screen follows these)

1. **Max depth 2 below a tab**: tab → detail → sub-detail. Anything deeper is a sheet.
2. **Pushed screens are places** (exercise, plan, a chart, settings). Every one has the same header
   (back arrow, title, optional one action) and allows the edge swipe back.
3. **Sheets are actions** (add food, swap exercise, finish workout, rest time, exercise info during a
   workout). Swipe down, tap outside or Back closes them. Never two sheets at once.
4. **Switching tabs never builds history.** Android Back on a tab root goes to Today, then exits.
5. **Every item has one home.** Each number appears in full on one screen only; other screens may
   show at most a small glance that links to it.
6. **The workout is never lost.** The workout screen minimises with a ⌄ button or a swipe down. A
   56 px **mini bar** then sits above the tab bar: exercise name, set 3/12, rest countdown or clock,
   and a ✓ that logs the next set. Tapping it reopens the workout. An ongoing Android notification
   shows the same.
7. **Exercise info during a workout opens as a sheet**, so you never leave the workout.
8. **Summary is the end of a workout.** It has Done (to Today) and inline Log a meal / Add water
   sheets, so nothing kicks you out of it.

### Core journeys (taps from opening the app)

| Journey | Taps | How |
|---|---|---|
| First launch | 4 | Goal → Where you train → Days a week → "Start this plan". Name, body, diet are asked later, when they matter (diet when you first open Fuel). |
| Start today's workout | **1** | Centre Start, or Start on the Today hero. No second "Start" inside: the clock starts at once. |
| Log a set | **1** | Weight and reps are pre-filled from last time. Tap ✓. Rest timer starts with a light haptic. |
| Finish | 2 | Finish → "Save workout" in a sheet → Summary. Workouts under 2 minutes ask to discard. |
| Look up an exercise | 2 + typing | Train → search → result. |
| Check progress | 1 (+1) | Progress tab; tap a card for its chart. |
| Log food | 2 | Fuel → Add, or the food ring on Today → sheet → pick. Water is 1 tap. |
| Connect a watch | 3 | Avatar → Watch & health → Connect. Also from the empty third ring on Today. |

### Screen specs

**Today** (top to bottom; nothing else)
1. Header: "Today" + date, streak pill, avatar.
2. Hero card: today's workout name, one meta line ("6 exercises · 45 min · Push"), muscle chips,
   one **Start** button. Rest day: "Rest day · next: Legs Thu" and "Train anyway".
3. Three rings (Whoop-style dials), each opens its own detail: **Training** (sessions this week /
   target), **Fuel** (protein or kcal), **Body** (sleep score / readiness from the watch; steps if
   only steps; "Connect" if no watch).
4. Week strip (7 dots, done days filled).
5. One coach line (single sentence, rotates daily).
Banners (setup, notifications) collapse into one dismissible line at the very bottom.

**Train**
1. Header + avatar. Search field pinned at the top (searches exercises and plans).
2. "Your plan" card: name, week progress pips, next day, **Start** (fixes "plan cannot start a day").
3. Muscle grid (the existing muscle blocks) → muscle page with level and equipment chips at the top.
4. "Other plans" list → plan page (each day card has its own Start).
Place (gym / home / office) is set once in profile and shown as one chip in the Train header.

**Workout** (full-screen, minimisable)
- Header: ⌄ minimise, clock, Finish. Segmented progress for exercises.
- Current exercise: animation/photo (existing Demo), name, "Last time 60 kg × 8".
- Set rows: kg, reps, ✓. Swap and Add set are two small text buttons under the table.
- Bottom: rest ring when resting (−15 / +15 / Skip), otherwise Prev / Next.
- Live heart rate chip in the header when a strap or watch is streaming (phase 2).

**Summary**: count-up of time, volume, sets; PR badges; streak; Log a meal and Add water as sheets;
Done.

**Progress**
1. "This week" strip: workouts, volume, minutes (count up on open).
2. Four cards, each one opens one chart screen: Strength (top lifts, per-lift line chart),
   Body weight (trend + log button, the only weight logger in the app), Consistency (calendar,
   streak, history list with delete), Body & watch (steps, sleep, resting HR, HRV, imported workouts).
3. Achievements shelf (one row, opens the full list).

**Fuel**
1. Rings: kcal, protein, water.
2. Four meal slots as rows; one **Add** button opens the food sheet (recipes / foods / custom).
3. Water: one row with − / glasses / +.
4. One fold "Tips for you" holding today's plan, protein picks, supplements, bloating.

**You** (avatar): grouped list: Profile, Plan and goal, Watch & health, Reminders, Appearance,
Gym etiquette, Data (export, erase).

**Watch & health**: connection cards (Health Connect, Heart-rate strap, Import a file), last sync,
which data types are on, Disconnect.

## 3. Motion (Reanimated, respects reduce-motion)

| Element | Animation | Timing |
|---|---|---|
| Push / pop | Slide from right, parent shifts back and dims | 350 / 320 ms, cubic-bezier(.32,.72,0,1) |
| Tab switch | Cross-fade + 4 px rise | 200 ms ease-out |
| Sheet | Spring up (damping 20, stiffness 220), backdrop to 40% | ~300 ms, drag to dismiss |
| Workout ⇄ mini bar | Bar grows into the workout header and back | 380 ms, same curve |
| Rings, progress bars | Fill from 0 first view of the day, then from old value | 700 ms cubic-bezier(.23,1,.32,1), 80 ms stagger |
| Numbers | Count up; a changed value pops 1.15 → 1 | 600 ms ease-out |
| Set ✓ | 0.9 → 1.05 → 1, row tints green, light haptic | 180 ms spring |
| PR / finish | Badge overshoot + confetti, success haptic | 550 ms cubic-bezier(.34,1.56,.64,1) |
| Rest ends | Ring pulse, warning haptic at 0 s | |
| Press | Scale 0.97 | 120 ms |
| Watch sync | Skeleton shimmer on rings and tiles, never a spinner | 1.2 s loop |

Animations only move `transform` and `opacity` (UI thread, no layout), so long pages stay smooth.

## 4. Watch and tracker data

Key fact: Fitbit's own Web API was switched off on 2 Nov 2026; its replacement (Google Health API)
needs a Google security review. Google Fit stops at the end of 2026. So the only route that works
on-device, for free, for almost every watch, is **Android Health Connect**.

| Phase | Route | Watches covered | Data |
|---|---|---|---|
| **A (this round)** | Health Connect read + write our workouts back | Fitbit & Pixel (via the Fitbit/Google Health app), Samsung, Garmin (Connect 5.14+, Android 14+), Whoop, Amazfit/Zepp, Oura, plus open-source bridges: **Gadgetbridge** (300+ devices: Mi Band/Amazfit, Huawei, Garmin, PineTime, Bangle.js, Colmi, Fossil), **openScale-sync** (BLE scales) | steps, distance, heart rate, resting HR, HRV, SpO2, respiratory rate, skin temperature, VO2max, sleep, exercise sessions, calories, weight |
| **B (this round)** | Bluetooth heart rate (standard 0x180D), behind a device-adapter interface | Polar, Wahoo, Coospo, Garmin "Broadcast HR", **WHOOP "Broadcast Heart Rate"**, PineTime/InfiniTime, Bangle.js (`bootgatthrm`), Wear OS broadcaster apps, many Amazfit/Huawei | live heart rate, zones, rest cue, **RR intervals → our own HRV (RMSSD)** after workouts and in the morning |
| C (next round) | File import: Garmin .FIT and export zip, Fitbit Google Takeout, GPX/TCX (also Gadgetbridge and OpenTracks exports) | anything that exports | history |
| C (next round) | **Colmi smart-ring adapter** (R02/R06/R10, ~$20, no pairing keys), clean-room from MIT `colmi_r02_client` + `colmi-docs` | Colmi rings | live HR, SpO2, steps, HR history |
| Later | Apple HealthKit (iOS build), Garmin personal API when public, cycling/running BLE sensors (Apache-2.0 OpenTracks as reference) | | |
| Later, opt-in only | Direct WHOOP protocol (MIT `OpenStrap/research`) behind an "experimental" switch | WHOOP 4.0 | HR/RR history. WHOOP's terms forbid reverse engineering and it sent takedowns in June 2026; preferred path is asking OpenStrap Edge to add Health Connect export |
| Skipped | Google Health API, Strava, Whoop cloud API, Polar SDK (proprietary licence), direct Mi Band/Amazfit/Huawei (per-device keys, AGPL references) | | need a server/secret, restricted scopes, forbid offline caching, or licence conflicts; covered by Health Connect or 0x180D instead |

Open-source projects surveyed (licences checked, 25+): usable as dependencies (react-native-ble-plx Apache-2.0,
react-native-ble-manager Apache-2.0, react-native-health-connect MIT, @garmin/fitsdk); protocol references we may
re-implement clean-room (OpenStrap/research MIT, unstrapped MIT, whoop-reader MIT, Atria MIT, colmi_r02_client MIT,
colmi_r06_fbp BSD-3, hrkit MIT, OpenTracks Apache-2.0, InfiniTime docs); user-side bridges that write to Health
Connect (Gadgetbridge AGPL, openScale GPL, OpenStrap Edge AGPL); reference only, no code copied (RunnerUp,
FitoTrack, GoldenCheetah, GarminDB GPL; OpenHRV LGPL; Polar SDK proprietary; NOOP unlicensed; galileo LGPL;
open-wearables MIT but needs a server). The Health Connect screen gets a help card: "Using Gadgetbridge,
OpenStrap or openScale? Turn on its Health Connect sync" (Gadgetbridge's is off by default).

Libraries (all MIT unless noted; licences checked):
- `react-native-health-connect@3.5.3` + `expo-health-connect@0.1.1` (3.5.x is the line tested on RN 0.81;
  4.x needs a newer RN). Needs `expo-build-properties` with minSdk 26 / compile & target 36.
- `react-native-ble-plx@3.5.1` with its own config plugin (`neverForLocation`).
- Phase C: `fflate` (MIT), `@garmin/fitsdk` (Garmin FIT licence: royalty-free, keep notices, never under
  a copyleft licence), `@tmcw/togeojson` (BSD-2).
- Gadgetbridge is AGPL: no code reused. Users who run it already feed Health Connect, which we read.

Both new libraries add native code, so the Expo Go preview stops covering watch features; the CI APK
covers them. The app keeps working with no watch: every watch block has an empty state.

Store: a new persisted `tracker` slice (`daily` metrics by date, imported `workouts` with dedupe ids,
Health Connect grant list + change token, paired strap). Raw HR samples are down-sampled to 5 s and
kept only for the last 14 days so the saved state stays small.

## 5. How it gets built (no repeats of past mistakes)

1. **Foundation first, by me**: theme tokens, one `Header`, one `Segmented`, `Sheet` with drag, motion
   helpers (`useCountUp`, `RingFill`, press scale), tab bar with centre button, mini bar, store slice.
   Typecheck before any screen work starts.
2. **One sub-agent per screen group**, each owning only its files: Today; Train + muscle/plan pages;
   Workout + Summary; Progress + charts; Fuel + food; You + settings + Watch & health; Health
   Connect + BLE services. Existing exercise data, animations (figure/poses), engine and notify logic
   are kept, not rewritten.
3. **Review agent** checks every screen against these rules (depth, one home per number, one primary
   button, back paths) and the motion table.
4. **Verification, before any APK is posted**: run the web build in a headless browser, click through
   every journey in section 2, screenshot every screen and each animation's start/middle/end, and
   publish a review page. Typecheck + self-checks on the `verify` branch, then the full build.
5. Old screens are deleted only after their replacement passes, so nothing disappears silently.

## Sources
Fitbit: engadget.com/ai/a-closer-look-at-googles-ai-health-coach-and-the-redesigned-fitbit-app-160041881.html ·
9to5google.com/2025/08/20/fitbit-app-coach-redesign · Whoop: whoop.com/us/en/thelocker/the-all-new-whoop-home-screen ·
the5krunner.com/2025/10/15/whoop-homescreen-gets-a-revamp · openGym: github.com/DuarteSantos8/openGym ·
Hevy: hevyapp.com/features/track-workouts · Apple: developer.apple.com/design/human-interface-guidelines/workouts ·
Health Connect lib: github.com/matinzd/react-native-health-connect · Fitbit API shutdown:
developers.google.com/health/about · Garmin program pause: tryterra.co/blog/garmin-connect-developer-program-pause ·
Strava terms: developers.strava.com/docs/rate-limits · Whoop OAuth: developer.whoop.com/docs/developing/oauth ·
BLE: github.com/dotintent/react-native-ble-plx
