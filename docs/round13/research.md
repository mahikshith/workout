# Round 13 research: simpler journeys, modelled on Google Health (Fitbit), WHOOP and gym loggers

Date: 2026-11-11. Builds on `docs/REDESIGN.md` (round 10 plan: 4 tabs + centre Start, mini bar, sheets for actions),
`docs/guide/journeys.md` and `round11/rea-findings.md` (Gadgetbridge and openGym). Those findings are not repeated here.

Legend: **[doc]** = vendor documentation, **[press]** = review or news, **[REA]** = seen in an APK with REA this round,
**[obs]** = widely observed app behaviour that no public doc confirms (treat as likely, verify on a device).

---

## 0. REA this round: what was studied and how

**REA worked.** Tool: `rea-agents` 6.8.0 CLI, with the JADX engine (`jadx-headless-mcp-0.7.1-all.jar`, downloaded
from its GitHub release because REA does not download it) and apktool 2.12.1 (wired in via `REA_APKTOOL_COMMAND`).
All three APKs came from f-droid.org. Only names, manifests, string resources and class/member inventories were read:
structure, not code. Nothing was copied.

| App (F-Droid) | Licence | Why it is relevant | REA commands used |
|---|---|---|---|
| **LibreFit 0.5.0** (`org.librefit.app`), Kotlin/Compose gym logger | GPL-3.0 | Closest to GymBuddy: routines, live workout, rest timer, tutorial | `inspect-android-package`, `search-android-classes`, `inspect-android-class`, `decode-android-resources` |
| **Hidroly 2.3.0** (`com.om1cael.hidroly`), Flutter water tracker | GPL-3.0 | Water reminders, Health Connect hydration write, setup flow | `inspect-android-package`, `decode-android-resources`, plus `strings` on the Dart snapshot (Flutter keeps UI text there, not in Android resources) |
| **OpenTracks 4.29.0** (`de.dennisguse.opentracks`) | Apache-2.0 | Introduction screens, Health Connect rationale, recording service | `inspect-android-package`, `decode-android-resources` |

### What the APKs show

**LibreFit** (single Activity, Compose navigation):
- Bottom pages (`MainScreenPages`): **HOME, LIBRARY, PROFILE**: three tabs only. Calendar, statistics, measurements and
  settings hang off Profile; the workout is a pushed route.
- Routes (`nav.Route`): `WorkoutScreen`, `BeforeSavingScreen` (the summary/edit-before-save step), `SuccessScreen`,
  `EditWorkoutScreen`, `ExercisesScreen` (picker), `InfoExerciseScreen`, `InfoWorkoutScreen`, `RequestPermissionScreen`.
- Workout states (`WorkoutState`): ROUTINE, RUNNING, COMPLETED, ARCHIVED, LIBRARY. Only one RUNNING workout is allowed:
  starting a routine while one runs asks "the current unsaved, ongoing workout has to be dismissed" first.
- The workout runs in a **foreground service** (`WorkoutService`, type `dataSync`) whose notification actions are
  `START_REST_TIMER`, `ADD_TEN_SECONDS_TO_REST_TIMER`, `SUBTRACT_TEN_SECONDS_TO_REST_TIMER`, `PAUSE_STOPWATCH`,
  `START_STOPWATCH`, `WORKOUT_FOCUS` (tap to reopen), `STOP_SERVICE`.
- **Two notification channels**: "Real-time workout information" (ongoing) and "Rest time alerts" (fires when rest ends,
  "Rest time is over!"); sound on/off is a setting.
- **Sheets** used: `InputModalBottomSheet` (number entry with step buttons), `InfoModalBottomSheet`,
  `BarbellCalculatorModalBottomSheet` (plate maths). Confirms are dialogs.
- **Permission screen** (`RequestPermissionScreen`), shown in context: "For the best experience in LibreFit, the
  following permission has to be granted: Notifications. It allows to send notifications about the ongoing workouts and
  rest intervals." with **Skip for now** and "The app will work even without this permission." A blocked state says
  to enable it in system settings.
- **Teaching**: a `WelcomeScreen` and a **Tutorial** (`TutorialContent`: CREATE_ROUTINE, COMPLETE_WORKOUT) made of
  numbered steps tied to real UI ("When you mark a set as complete, the rest timer at the bottom of the screen will
  automatically start", "tap the pause button to take a break", "tap 'Done'... On the summary screen you can edit the
  title, add notes, change the date"). Empty states teach too: "Start by creating a new routine", "Start by completing a
  workout", "Start by adding an exercise to your workout".
- Progress cues: "Week streak", previous-performance per set (`PreviousPerformanceSet`), 1RM and plate calculators.

**Hidroly** (water):
- Setup is a state machine: **profile → notifications → healthConnect → processing → done(daily goal)**; each
  permission is its own step with a reason, and the goal is computed (and clamped) at the end.
- Routes: `/setup`, `/summary`, `/settings`, `/settings/notifications`, `/settings/health-connect`.
- Reminder settings are just **frequency (minutes)** and **sleep time** (quiet window); scheduled with
  `awesome_notifications`, re-armed on boot (`BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`).
- Logging is **cup buttons** (`CupButton`, `CupCreationForm`: user-defined cup sizes, ml or oz); goal edit is a
  bottom sheet (`PersonalGoalSheet`).
- Health Connect: **WRITE_HYDRATION only**, plus the required rationale activity
  (`androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`).

**OpenTracks**:
- First-run `IntroductionActivity` (skippable, flag `showIntroduction`).
- Health Connect is **write-only and off by default** ("Export activity to Health Connect after recording is
  finished"), with its own rationale screen ("How OpenTracks uses Health Connect... does not read data") and a
  "Configure permissions" screen. Permissions (location, Bluetooth) are asked when you first record, with a clear
  failure message if refused.

### Reproduce
```sh
mkdir -p /tmp/claude-0/rea && cd /tmp/claude-0/rea && npm i rea-agents@6.8.0
curl -LO https://github.com/1013503897/jadx-headless-mcp/releases/download/v0.7.1/jadx-headless-mcp-0.7.1-all.jar
curl -L -o apktool.jar https://github.com/iBotPeaches/Apktool/releases/download/v2.12.1/apktool_2.12.1.jar
printf '#!/bin/sh\nexec java -jar %s/apktool.jar "$@"\n' "$PWD" > apktool && chmod +x apktool
export REA_JADX_MCP_JAR=$PWD/jadx-headless-mcp-0.7.1-all.jar REA_APKTOOL_COMMAND=$PWD/apktool
curl -O https://f-droid.org/repo/org.librefit.app_50001.apk
npx rea inspect-android-package org.librefit.app_50001.apk --format json
npx rea search-android-classes org.librefit.app_50001.apk org.librefit --format json
npx rea inspect-android-class org.librefit.app_50001.apk org.librefit.enums.pages.MainScreenPages --format json
npx rea decode-android-resources org.librefit.app_50001.apk --format json
```
(`npx rea doctor` reports "unhealthy" because Hopper/Ghidra/IDA are missing; that does not matter for APKs.)

---

## 1. Navigation patterns

**Google Health (the renamed Fitbit app, rolled out from 19 May 2026)** [doc][press]
- **Four bottom tabs: Today, Fitness, Sleep, Health.** Without a Fitbit/Pixel Watch you get only **Today and Health**
  (the app hides what you can't use). ([Google Health help](https://support.google.com/googlehealth/answer/17068213))
- **Today**: a block of stat tiles at the top (one big ring tile + three small, or 4/6 tiles, a second page by swiping),
  then a **Start** activity button with a pencil (edit tiles) next to it, then coach text.
  ([Droid Life](https://www.droid-life.com/2026/06/01/heres-the-best-way-to-setup-the-new-google-health-app/))
- **Fitness**: weekly plan, workout library, recent activities, cardio load. **Sleep**: score and stages.
  **Health**: vitals widgets (HR, HRV, SpO2, breathing rate, skin temp, weight), nutrition, cycle health.
- **Connections** (devices, partner apps, Health Connect) is reached from the **top-left** of the app, not a tab
  ([Google Health help 14506680](https://support.google.com/googlehealth/answer/14506680)).
- **Lesson from the criticism**: reviewers say the redesign is pretty but hard to use: long AI-coach text pushes numbers
  below the fold, tiles cannot be reordered by drag, some metrics can't be on Today, steps were hard to find.
  ([Android Authority](https://www.androidauthority.com/i-used-new-google-health-app-for-week-and-hate-it-3670318/))
  Google then shipped fixes and "expanded dashboards".
  ([Android Authority follow-up](https://androidauthority.com/google-health-app-fixes-new-features-3671399/))

**WHOOP (2025 home redesign, 2026)** [doc][press]
- Bottom bar with **labels** (added in the redesign so people "navigate more quickly"); a **centred, more prominent
  "+" action button**; **Coach** in the bottom-right corner; **More** (Account & Settings, Integrations) at the far
  right. A **Health** tab (Healthspan, Health Monitor, Stress) was added in 2025.
  ([WHOOP home screen](https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/),
  [5K Runner](https://the5krunner.com/2025/10/15/whoop-homescreen-gets-a-revamp/),
  [WHOOP 2025 recap](https://www.whoop.com/us/en/thelocker/everything-whoop-launched-in-2025/))
- Home went from swipeable tabs to **one dense scroll**: three dials (Sleep, Recovery, Strain) on top, then today's
  activities and key metrics. Starting a strength session: **+ → Strength Trainer → pick workout → Start**; logging
  after the fact: **+ → Add Activity**.
  ([WHOOP Strength Trainer](https://whoop.com/thelocker/introducing-strength-trainer-a-new-way-to-quantify-the-impact-of-your-strength-training))

**Gym loggers**
- **Hevy**: tabs Home (feed), Workout, Profile. A running workout can be swiped down; a "workout in progress" bar with
  Resume sits above the tabs [obs]. The rest timer and "complete set" also work from the **Live Activity /
  ongoing notification** without opening the app [doc]
  ([Hevy live activity](https://help.hevyapp.com/hc/en-us/articles/35649846517399)).
- **LibreFit** [REA]: 3 tabs (Home, Library, Profile); the running workout is a foreground service with a notification
  you can tap back into; only one running workout.
- **Apple's HIG for workouts**: keep the active workout one tap away, show live metrics large, make pause/end obvious.
  ([Apple HIG Workouts](https://developer.apple.com/design/human-interface-guidelines/workouts))

### What GymBuddy should do
1. **Keep the round 10 shape** (Today, Train, centre Start, Progress, Fuel; labels always on): it already matches the
   WHOOP pattern (labelled tabs + centred action). Don't add tabs. Google Health's lesson is the opposite risk:
   **numbers first, text second**. Coach line stays one sentence, under the rings.
2. **Hide what doesn't apply** (Google's "focused experience"): no watch → Today's third ring is a "Connect" card, and
   Progress shows no Body & watch card at all until data exists.
3. Centre **Start** = WHOOP's "+": tap starts today's workout; **long-press or a second tap on a rest day opens a sheet**
   (Train anyway / Quick 20 / Pick exercises / **Log past workout** / **Log water / food**). One action door.
4. **Avatar top-right** (or top-left like Google's Connections) is the only door to profile, settings, Watch & health.
   Don't scatter settings into tabs.
5. **Running workout**: mini bar above the tabs (already built) plus an **ongoing notification with actions**
   (✓ next set, −15 / +15, Skip rest, Pause), like LibreFit's service actions and Hevy's Live Activity. Starting a
   second workout while one runs must ask first (LibreFit's rule).
6. **Sheets for actions, pushes for places** (round 10 rule 2–3) is confirmed by LibreFit: number entry, info, plate
   calculator are all bottom sheets. A **top sheet** fits only one thing: the **date/day picker** dropping from the
   Today header (week strip expands into a month). Everything else from the bottom.

---

## 2. Onboarding

- **Google Health**: sign in with Google → profile (age, height, weight) → goal (e.g. daily steps) → pair device
  under Connections; Health Connect partner-app sync is a separate, later flow (Connections → Partner apps → Set up →
  pick data → allow history/background). ([setup requirements](https://support.google.com/product-documentation/answer/14226283),
  [partner apps](https://support.google.com/googlehealth/answer/14506680))
- **WHOOP**: account + strap pairing first; the "+" only appears after the first night of sleep is recorded
  ([community](https://www.community.whoop.com/t/strength-trainer-not-available-in-the-app-sign-also-not/10530)): the
  app defers features until there is data.
- **Hevy**: a few value screens, sign-up, then Home with **Start empty workout**, routine cards and a **tutorial card**
  (optional, not a forced walkthrough). Hevy Trainer (Pro) asks a few questions and builds a plan.
  ([screensdesign](https://screensdesign.com/apps/hevy-workout-tracker-gym-log/?vs=212387),
  [Hevy Trainer](https://help.hevyapp.com/hc/en-us/articles/38385724273047-Hevy-Trainer-Explained-How-It-Builds-Your-Workout-Program))
- **Hidroly** [REA]: profile → notifications → Health Connect → result (goal). Each permission is one step with one
  reason. **OpenTracks** [REA]: skippable intro; permissions on first recording. **LibreFit** [REA]: welcome, then a
  permission screen with **Skip for now** and "works without it".
- **Android guidance**: ask for notifications **in context**, tied to a user action with a clear reason, not at first
  launch. ([Android notification permission](https://developer.android.com/develop/ui/views/notifications/notification-permission))
  Health Connect: the app **must** provide a rationale screen (`ACTION_SHOW_PERMISSIONS_RATIONALE`), and reading data
  older than 30 days or in the background needs `READ_HEALTH_DATA_HISTORY` / `READ_HEALTH_DATA_IN_BACKGROUND`.
  ([HC data types](https://developer.android.com/guide/health-and-fitness/health-connect/plan/data-types))

### What GymBuddy should do
1. Keep the **4-tap setup** (Goal → Where → Days → Start this plan). **No permission prompts during setup.**
2. Ask at the moment it matters, each with a one-line reason and **Not now**:
   - **Notifications**: when the first set is ticked and the rest timer starts ("Get a buzz when rest is over, even with
     the screen off"), or when a reminder is first switched on. Never at launch.
   - **Health Connect**: when the person taps "Connect" on the third ring / Watch & health; ask only the record types for
     the switches they turn on; ask history (30+ days) as a separate "Import my past data" step.
   - **Bluetooth**: when "Find my watch / strap" is tapped.
   - **Exact alarms** (Android 14+): only if they turn on supplement/water reminders at fixed times.
3. Defer: name, body, diet (first Fuel visit), watch (Today ring), reminders (after the 2nd workout, one card:
   "Want a nudge on training days?"). Add a short "Start by…" empty state on each tab instead of a tour.
4. Ship the Health Connect **rationale screen** (required) and a "Permissions" row in You that lists every grant with
   its on/off state.

---

## 3. In-workout rest / next flow and first-time teaching

| App | After a set is ticked | Controls | Next exercise | Teaching |
|---|---|---|---|---|
| **Hevy** [doc] | Rest countdown starts for that exercise (per-exercise rest, 5 s–5 min or off; default in Settings) | −15 / +15, Skip; same on Live Activity / lock screen; can complete next set from the notification | Exercise list scrolls; next set row is pre-filled with last time's numbers | Tutorial card on Home ([rest timer](https://www.hevyapp.com/features/workout-rest-timer/), [live activity](https://help.hevyapp.com/hc/en-us/articles/35649846517399)) |
| **Strong** [obs] | Rest timer bar slides up at the bottom with countdown | −/+ (10–15 s), Skip; tap timer to change default | Scroll list; "previous" column shows last session | Minimal: a sample routine and empty states |
| **Fitbod** [doc] | Countdown starts on log; tone/vibration at end, works locked if notifications on | Tap timer changes **only this rest**; per-exercise toggle in exercise details | Moves to the next set; workout auto-saves | Getting-started help articles ([Fitbod rest timer](https://help.fitbod.me/hc/en-us/articles/360006340194)) |
| **LibreFit** [REA] | "the rest timer at the bottom of the screen will automatically start"; alert "Rest time is over!" | +10 / −10 s, pause stopwatch; also from the notification | Shows previous performance per set | 2 numbered tutorials (create routine, complete workout) + empty states |
| **WHOOP Strength Trainer** [doc] | Warm-up timer, then "Start first set"; members ask for a proper rest timer ([community](https://www.community.whoop.com/t/feature-request-rest-time-between-sets-in-strength-trainer/14908)) | | | |

Pause: Hevy pauses the **workout clock** by tapping the duration at the top ([Hevy pause](https://www.hevyapp.com/help/how-to-pause-your-workout/)); LibreFit has a pause button on the clock [REA].

### What GymBuddy should do
1. Our flow (tick → rest ring with −15 / +15 / Skip → "Up next" on the last set → auto-advance) already matches the
   leaders. Add: **tap the clock to pause** (Hevy), **tap the rest time to change it for this exercise / just this
   rest** (Fitbod's distinction, in a small sheet), and **the same controls in the ongoing notification**.
2. Split notifications into channels like LibreFit: **"Workout in progress"** (low, ongoing, silent) and **"Rest
   timer"** (high, sound/vibrate, user can mute in our settings). Today the rest timer shares `nudges`.
3. Rest end: haptic + sound; if the app is in the background, a heads-up "Rest over: Set 3 of Bench press, 60 kg × 8"
   with a **✓ Done** action.
4. **Teach with one-time hints, not a tour**: 3 coach marks, each shown once and dismissed by doing the thing:
   (a) first open of a workout: "Tick ✓ when a set is done; rest starts by itself", pointing at the first ✓;
   (b) first rest: "−15 / +15 or Skip", pointing at the ring; (c) first time leaving the workout: "It keeps running
   down here", pointing at the mini bar. Store `seenHints` in the store; a "Show tips again" row in You.
5. Keep a short "How a workout works" page (LibreFit-style numbered steps with our screenshots) under You › Help.

---

## 4. Wearable connection UX and live data

**How the leaders explain partner-app paths**
- Google Health shows the path as **Connections → Partner apps → Manage Health Connect** with a status line
  "Synced just now / Synced at 10:42 / Syncing", and lets you pick data types and history/background access.
  ([Google Health help 14506680](https://support.google.com/googlehealth/answer/14506680))
- WHOOP: **More → Account & Settings → Integrations → Health Connect → Set up**, pick categories; data you can delete
  from Health Connect any time. ([WHOOP support](https://support.whoop.com/s/article/Google-Health-Integration-For-Android?language=en_US))
- openGym (round 11) and Hidroly/OpenTracks (this round) each explain in one sentence which way data flows
  ("writes… does not read") on their rationale screen.

**Health Connect record types a third-party app can read** (each has `READ_*`; current SDK list,
[developer.android.com](https://developer.android.com/guide/health-and-fitness/health-connect/plan/data-types)):

Activity: ActiveCaloriesBurned, ActivityIntensity*, CyclingPedalingCadence, Distance, ElevationGained,
ExerciseSession (+ ExerciseRoute), FloorsClimbed, PlannedExerciseSession*, Power, Speed, Steps, StepsCadence,
TotalCaloriesBurned, Vo2Max, WheelchairPushes. Body: BasalMetabolicRate, BodyFat, BodyWaterMass, BoneMass, Height,
LeanBodyMass, Weight. Cycle: BasalBodyTemperature, CervicalMucus, IntermenstrualBleeding, MenstruationFlow,
MenstruationPeriod, OvulationTest, SexualActivity. Nutrition: Hydration, Nutrition (incl. caffeine, protein…).
Sleep: SleepSession (with stages). Vitals: BloodGlucose, BloodPressure, BodyTemperature, HeartRate,
HeartRateVariabilityRmssd, OxygenSaturation, RespiratoryRate, RestingHeartRate, SkinTemperature*.
Wellness: MindfulnessSession*. (*feature-flagged: check `getFeatureStatus` before asking.) Plus
`READ_HEALTH_DATA_HISTORY` (older than 30 days) and `READ_HEALTH_DATA_IN_BACKGROUND`. Medical records (FHIR) exist but
need separate Play approval; not for us.

**Who writes what (Nov 2026)**

| Metric | Google Health / Fitbit writes? | WHOOP writes? |
|---|---|---|
| Steps | Yes | Yes per our earlier source; WHOOP has no step sensor, so it is estimated, and older reports say none (verify) |
| Distance, floors, elevation | Yes | No |
| Exercise sessions | Yes (+ route) | Yes (workouts) |
| Total calories | Yes | Yes |
| Active calories | No (reads only) | Unclear |
| Heart rate (samples) | Yes | **No** |
| Resting HR | Yes | Yes, only with Health Monitor (Peak tier) |
| HRV (RMSSD) | Yes | **No** |
| SpO2 | **No** (reads only) | Yes per secondary sources (verify) |
| Respiratory rate | Yes | Yes (Peak tier) |
| Skin temperature | Yes | No |
| Sleep + stages | Yes | Yes |
| VO2 max | Yes | **No** (explicitly excluded) |
| Weight / body fat | Yes | Body metrics: yes |
| Hydration / nutrition | Yes | No |
| Recovery, strain, Healthspan, WHOOP Age | n/a | **Never** |

Sources: Google Health read/write table ([14506680](https://support.google.com/googlehealth/answer/14506680));
WHOOP support (tiers: One = sleep, strain-derived workouts/calories, body metrics; Peak adds resting HR and
respiratory rate; not synced: Heart Screener, BP insights, WHOOP Age, Pace of Aging, VO2 max)
([WHOOP support](https://support.whoop.com/s/article/Google-Health-Integration-For-Android?language=en_US), page
loads only in a browser; summary via search), community reports
([WHOOP community](https://community.whoop.com/t/transfer-steps-from-whoop-to-health-connect/3156)) and our existing
guide `docs/guide/connect-devices.md`. WHOOP rows marked "verify" disagree between sources: test on a real account.

### What GymBuddy should do
1. **Draw the data path** on each brand card as three chips with arrows:
   `[Fitbit watch] → [Google Health app] → [Health Connect] → [GymBuddy]`, each chip ✓ / ! with its own fix button
   ("Open Google Health", "Open Health Connect", "Allow in GymBuddy"). Same for WHOOP and Gadgetbridge (3 switches,
   from round 11). Live HR over Bluetooth is a second, separate row: `[Watch: Broadcast HR on] → [GymBuddy]`.
2. **Status line like Google's**: "Last data 10:42 from Google Health · steps, sleep, heart rate", "Waiting for data".
3. **Tracker pane** (Progress › Body & watch, and a "Live" header during workouts). One tile per metric, each tile
   shows value, time, source app, and greys out with "Not shared by WHOOP" instead of a blank:
   - Live (workout only, BLE): HR now, zone, avg/max this set, RR-based HRV after.
   - Today: steps, active/total calories, distance.
   - Last night: sleep duration + stages, sleep times, respiratory rate, SpO2, skin temp delta.
   - Trends: resting HR, HRV (RMSSD), VO2 max, weight.
   Use the table above to pre-label what each brand can never send.
4. Read only the types the person switched on; check feature flags for skin temperature; ask history separately.

---

## 5. Challenges

**How others structure them**
- **Fitbit** (removed March 2023): friend competitions *Daily Showdown* (24 h steps), *Workweek Hustle* (Mon–Fri),
  *Weekend Warrior* (Sat–Sun), *Goal Day* (hit goal each day); solo *Adventures* (virtual walks with milestones).
  Badges for lifetime and daily records survive.
  ([Engadget](https://engadget.com/fitbit-removing-open-groups-adventures-challenges-app-140024841.html),
  [Wareable](https://www.wareable.com/fitbit/fitbit-google-removes-community-adventures-challenges-open-groups))
- **Samsung Health Together**: one monthly global step challenge, milestones earn stars, top 10%/30% get points;
  group challenges up to 10 people, "most steps over a period" or "first to target".
  ([Samsung](https://www.samsungmobilepress.com/articles/achieve-your-new-years-resolution-with-new-group-challenge-feature-in-samsung-health))
- **Apple Fitness**: personalised **monthly challenge** (based on your history), streak awards, and since watchOS 11
  **pause rings** (rest day/week/month without breaking a streak).
  ([9to5Mac](https://9to5mac.com/2024/12/11/apple-watch-just-gained-a-helpful-new-feature-for-inspiring-you-to-stay-active/),
  [Wareable](https://www.wareable.com/apple/how-to-view-earn-apple-watch-awards-challenges-badges-achievements))
- **Nike Training Club programs**: 2–8 weeks, e.g. 3 workouts/week for 4 weeks, staged difficulty; rigid scheduling
  is the main complaint. ([Nike help](https://www.nike.com/help/a/ntc-info), [Garage Gym Reviews](https://www.garagegymreviews.com/nike-training-club-review))
- **"30 Day Fitness Challenge" (Leap Fitness)**: 30 days, 3 levels (beginner → pro), intensity rises step by step, a
  rest day after every 4–5 days, daily reminder; reviewers note a hard jump around day 10–15.
  ([App Store](https://apps.apple.com/gb/app/id1167377348), [AppGoblin](https://appgoblin.info/apps/com.popularapp.thirtydayfitnesschallenge))
- **Hevy** streak is **weekly** (≥1 workout per week), not daily, which forgives single missed days.

**Rules that work** (synthesis): fixed length (7/14/21/28/30 days); built-in rest days that count as done; daily task
fits on one card; a missed day **doesn't reset** the challenge: it becomes a "make-up" you can do the next day, and
after 2 missed days in a row the plan offers "Repeat this week" (no shame screens); weekly streaks over daily streaks;
a badge at the end and milestone stars at ¼, ½, ¾; one challenge at a time (our store already does this).

### Proposed catalogue (10)

Days auto-tick from a logged workout, steps or watch data where possible (store already supports this).
"R" = rest/recovery day (counts as done).

| # | Challenge | Level | Length | Daily structure | Done when |
|---|---|---|---|---|---|
| 1 | **21-day starter** | Beginner | 21 d (3×7) | Week 1: 3 × 20 min full-body (Mon/Wed/Fri) + 10 min walk other days; wk 2: 3 × 25 min; wk 3: 3 × 30 min + 1 mobility. Sundays R. | workout logged, or walk ≥10 min |
| 2 | **Step ladder** | Beginner → Int. | 28 d | Target = your 7-day average + 500/day each week (e.g. 5k → 5.5k → 6k → 6.5k). Step-goal adapts. | steps ≥ target (watch/phone) |
| 3 | **Core 30** | Beginner/Int. | 30 d | 8–15 min: plank, dead bug, bird dog, side plank; time/reps +10% every 5 days; R every 6th day | session ticked |
| 4 | **Mobility 14** | All | 14 d | 10 min daily: hips, thoracic, shoulders, ankles; one focus per day, repeat | session ticked |
| 5 | **Fat-loss 28** | Beginner/Int. | 28 d | 3 strength + 2 brisk-walk/cardio (30 min) + daily step floor (7k); daily protein target logged in Fuel | workout or cardio logged + steps floor |
| 6 | **Muscle-gain 8-week** | Intermediate | 56 d | 4 days/week upper/lower; progressive overload (beat last time's reps or weight on main lift); protein ≥1.6 g/kg logged | planned day logged; rest days R |
| 7 | **HIIT 21** | Intermediate | 21 d | 3–4 × per week 15–20 min intervals (30/30 → 40/20 → 45/15), other days walk or R; no HIIT on consecutive days | session logged |
| 8 | **Push-up / pull-up progression** | Beg./Int. | 30 d | Daily small sets (grease-the-groove): test day 1, then 50–70% of max × 3–5 sets; retest days 10, 20, 30 | sets logged |
| 9 | **Hydration 14** | All | 14 d | Hit water goal; reminders on | water ≥ goal |
| 10 | **Advanced strength block** | Advanced | 42 d (6 wk) | 4–5 days/week, wave loading on squat/bench/deadlift, deload week 6, test week end | planned day logged |
| 11 | **Consistency 12 weeks** | All | 12 wk | Weekly, not daily: hit your planned days each week (Hevy/WHOOP-style weekly streak) | ≥ planned workouts that week |

### What GymBuddy should do
1. One **Challenges** card on Today (the placeholder `src/challenges/Card.tsx`) showing day N of M, today's task and a
   ✓; tapping opens a sheet with the calendar strip and "Do today's task". Browse/join lives under Train.
2. Grace rules: missed day → make-up next day; 2 missed in a row → offer "Repeat this week"; sick/travel excuse (round
   11 idea) pauses the challenge like Apple's pause rings.
3. Badges: start, ¼, ½, ¾, finish; finishing unlocks the next level.

---

## 6. Food, protein, water and supplement reminders

- **MyFitnessPal**: Quick Add calories (macros for Premium) from the meal's Log button; copy a meal to another day;
  Saved Meals; water under "Healthy Habits" at the bottom of Today.
  ([MFP help](https://support.myfitnesspal.com/hc/en-us/articles/39985611667341))
- **Cronometer**: **Repeat Items** (Gold): pick a food/supplement, days, time, diary group, serving; each day a
  **prompt in the diary** to add them in one tap (not silent auto-logging); pause by disabling.
  ([Cronometer blog](https://cronometer.com/blog/repeating-food/))
- **WaterMinder**: custom cups (size, icon, colour, drink type, up to 12 on home), interval reminders with days off,
  widget logging. ([WaterMinder](https://waterminder.com/), [App Store](https://apps.apple.com/app/waterminder/id653031147))
- **Hidroly** [REA]: cup buttons, reminders = frequency + sleep time, writes Hydration to Health Connect.
- Medication/supplement reminder apps (Medisafe-style) share one pattern: a **notification with "Taken" / "Snooze"
  actions**, and a missed one rolls into a daily checklist.

**Safety numbers**
- **Caffeine**: up to **400 mg/day** for most healthy adults ([FDA](https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much));
  **<200 mg/day in pregnancy** (ACOG); none for children/teens (AAP). 400 mg taken **6 h before bed** still cut sleep
  by >1 h (Drake et al., 2013, *J Clin Sleep Med*, [PMC3805807](https://pmc.ncbi.nlm.nih.gov/articles/PMC3805807/));
  a 2023 meta-analysis suggests a cup of coffee **≥8.8 h** and a typical pre-workout dose (~217 mg) **≥13.2 h** before
  bed (Gardiner et al., *Sleep Med Rev*, [summary](https://www.ajmc.com/view/caffeine-and-sleep-review-suggests-consumption-guidelines)).
- **Creatine monohydrate**: **3–5 g/day** maintenance (optionally ~0.3 g/kg/day for 5–7 days to load), any time of day;
  daily consistency matters more than timing. (ISSN position stand, Kreider et al. 2017,
  [PMID 28615996](https://pubmed.ncbi.nlm.nih.gov/28615996/); 2007 stand [PMC2048496](https://pmc.ncbi.nlm.nih.gov/articles/PMC2048496))
- **Protein**: 1.4–2.0 g/kg/day for people who train (ISSN, Jäger et al. 2017,
  [PMC5477153](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/)).

### What GymBuddy should do
1. **One Add sheet** (Fuel's button, Today's food ring, Summary): tabs **Food · Water · Supplements**. Top row "Log
   again" chips. Water = cup buttons (user-sized, 3 by default: 250 / 500 / 750 ml). Supplements = today's checklist
   with one tap each (protein shake also logs its protein, which `src/supps.tsx` already does).
2. **Reminders the person schedules** (already in the store as `supplementReminders`): each is name, dose, time(s),
   days. Notification actions: **Taken** / **Snooze 30 min**; taken from the notification ticks the checklist.
   Water reminders = interval + quiet hours from "bed time" (Hidroly/WaterMinder), stop once the goal is hit.
3. **Caffeine guard**: caffeine items (coffee, pre-workout) carry mg. When scheduling or logging: warn if the day
   total would pass **400 mg** (200 mg if pregnancy is set; block strong pre-workout under 18, as `careful()` does),
   and if the time is **within 6 h of bed time** (soft note "8–9 h is better for sleep"; pre-workout gets the stronger
   note). Bed time comes from the watch's sleep or a profile setting.
4. **Creatine**: default 5 g once a day, any time; reminder text "Same time daily; timing doesn't matter much". No
   loading by default.
5. Write Hydration and Nutrition (incl. caffeine and protein) to Health Connect only if the person turns it on.
6. Separate notification channels: Rest timer, Workout in progress, Workout reminders, Water, Supplements, Weekly
   recap, so each can be muted in Android settings.

---

## 7. Calendar: rest vs workout vs tracker days

- **Hevy**: Profile › Calendar marks workout days with a filled circle (tap → that workout); every other day counts as
  rest; header says "N rest days since last workout"; streak is **weeks**; the calendar shows history only, not plans.
  ([Hevy help](https://help.hevyapp.com/hc/en-us/articles/35380117933207-Track-Your-Workout-Consistency-with-the-Calendar-and-Streak-Features))
- **Garmin Connect**: training calendar shows planned workouts (from plans/coaches) and completed activities by sport;
  rest days are blank or notes, which users find ambiguous.
  ([Garmin manual](https://www8.garmin.com/manuals/webhelp/GUID-EA668398-46E4-42E4-8163-12F6CB299F0E/EN-US/GUID-F5EB9C7C-A74E-4A26-BFB5-1E6DA4399067.html),
  [forum](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-andriod/259829/training-plans-swim-and-rest-day-notes-aren-t-visible-in-connect-app))
- **LibreFit** [REA]: Calendar screen off Profile, with "Week streak".
- **Apple Fitness**: rings per day in a month grid; paused days marked.

### What GymBuddy should do
One month grid (Progress › Consistency, and the Today week strip expanding as a top sheet). Per day, max one mark +
one dot:
- **Filled teal circle** = GymBuddy workout done (tap → summary).
- **Teal ring (outline)** = planned workout not yet done (future) / **faint red ring** = planned and missed (past).
- **Small grey "R"** or a moon icon = planned rest day (counts toward streak); unplanned non-training days stay blank.
- **Small dot under the date in the source colour** = activity imported from a watch (run, walk, WHOOP/Fitbit
  workout); merged into the circle if it overlaps our session (round 11 merge rule).
- **Gold border** = challenge day ticked. **Hatched/pause** = excused (sick/travel).
Legend in a one-line row under the grid. Streak counted in weeks.

---

## 8. Typography

- **WHOOP**: Proxima Nova for text; headlines all-caps with ~10% letter spacing; **numbers in DIN Pro Bold**.
  ([WHOOP design guidelines](https://developer.whoop.com/docs/developing/design-guidelines),
  [brand PDF](https://developer.whoop.com/assets/files/WHOOP%20-%20Brand%20&%20Design%20Guidelines-bdea3554e94b4ea09e68695b1e8dc8e7.pdf))
  So the heavy weight is reserved for **numbers**, not titles.
- **Google Health / Fitbit**: Google Sans family on Material 3 (Expressive). M3 baseline: Display 57/45/36,
  Headline 32/28/24, Title L 22 at **Regular 400**, Title M/S 16/14 **Medium 500**, Body 16/14/12 **400**, Label
  14/12/11 **500**; Expressive adds heavier "emphasized" variants for key numbers.
  ([M3 type scale](https://m3.material.io/styles/typography/type-scale-tokens))
- **Apple Fitness / iOS**: SF Pro; Large Title 34 Regular (Bold when emphasised), Title 1 28, Title 2 22, Title 3 20,
  Headline 17 **Semibold**, Body 17 Regular, Subhead 15, Footnote 13, Caption 12; ring numbers in **SF Pro Rounded /
  Compact** heavy weights. ([Apple HIG Typography](https://developer.apple.com/design/human-interface-guidelines/typography))
- **Hevy / Strong**: system fonts (SF / Roboto), titles semibold ~20–28, numbers semibold, body regular 15–17 [obs].
- **LibreFit** [REA]: has its own `HeadlineText` component and a `TypeKt` scale on Material 3.

Pattern: **titles are Medium–Semibold (500–600), not Black; only big numbers go Bold/Heavy; body is Regular 400**.
Condensed all-caps display faces (Anton-like) appear only in marketing, never as in-app headings.

### What GymBuddy should do
The code on `main` already dropped Anton for Outfit (`src/theme.ts` `f.display = Outfit_700Bold`, `src/ui.tsx` scale).
Tune further:
- `display` 30 → **28, Outfit 600** (SemiBold), letter-spacing −0.2. `h1` 24 → **22/28, 600**. `h2` 20 → **18/24, 600**.
  `h3` 17/23 **500**. `body` 16/24 **400**. `small` 14/20 **400** (not 500). `label` 12/16 **500**, sentence case,
  no uppercase/tracking (WHOOP-style caps only if a section really needs it).
- Keep **Bold 700 only for numbers** (`num`, timers, ring values) and use **tabular figures** (`fontVariant:
  ['tabular-nums']`) so timers don't jitter.
- Drop `Anton_400Regular` from `app/_layout.tsx` font loading and the `@expo-google-fonts/anton` dependency if
  nothing else uses it (saves ~100 KB and a load).
- Max two weights on one card (e.g. 600 title + 400 body; numbers 700).
