# Round 13 · Feature gaps against other apps

Question from the owner: which useful features do others have that we don't? Keep things simple; if the current app
is good enough, drop the idea.

Compared with Hevy, Strong, Fitbod, JEFIT, Nike Training Club, Google Fitbit / Google Health, WHOOP, MyFitnessPal,
Samsung Health and Apple Fitness (web search, Nov 2026, plus `research.md` in this folder). Every candidate was checked
in the code (`src/`, `app/`) before it was called missing. Complexity is for this app as it stands: offline Expo SDK 54,
zustand store, no backend, no camera or file-system packages installed.

Verdicts: **Add now** = small (S) and high value. **Later** = worth doing, not now. **Skip** = with a reason.

## Ranked list of missing features

| # | Feature | Who has it | Value (general gym-goer) | Size | Verdict |
|---|---|---|---|---|---|
| 1 | **"Go heavier" nudge** (progressive overload) | Fitbod (auto), JEFIT, Hevy/Strong show last time | High | S | **Add now** |
| 2 | **Plate calculator** | Strong, Hevy | Medium-high | S | **Add now** |
| 3 | **Better rest-over notification** (says the next set, own channel) | Hevy, Fitbod, Strong | Medium-high | S | **Add now** (action buttons: Later) |
| 4 | **Restore from backup** | Hevy, Strong, JEFIT (cloud accounts) | High (rare, but losing it all hurts) | M | Later, first in line |
| 5 | **Workout notes** | Hevy, Strong, JEFIT | Medium | S | Later |
| 6 | **Warm-up hint** for heavy lifts | Strong, Hevy (Pro), Fitbod | Medium | S | Later |
| 7 | **Waist and other measurements** | JEFIT, Hevy, Strong, MyFitnessPal, Samsung Health | Medium (fat-loss goals) | M | Later |
| 8 | **kg / lb setting** | Strong, Hevy, JEFIT, Fitbod, MyFitnessPal | High in US/UK, nil elsewhere | M | Later (if the audience needs it) |
| 9 | **Progress photos** | Hevy, JEFIT, Strong | Medium for some, sensitive | M | Later, low |
| 10 | **Share-a-workout image** | Hevy, Strong, Nike Training Club, Apple Fitness | Low-medium | M | Skip for now |

### 1. "Go heavier" nudge · Add now · S
- **What**: when last time every set of an exercise hit its target reps, the next workout pre-fills one step heavier
  (+2.5 kg barbell/machine, +2 kg dumbbell) and the "Last time" line says why: "Last time 40 kg × 10 on every set ·
  try 42.5 kg". Missed reps → same weight as now.
- **We have**: `seedSets()` in `src/store.ts` copies last time's weight and reps; `lastText()` in `app/session.tsx`
  shows "Last time 40 kg × 10". Plan phases (`src/data/program.ts`) change sets and reps by week. Nothing ever suggests
  more weight, so a beginner can repeat the same load for months.
- **Why add**: progressive overload is the one thing that makes a beginner's plan work; Fitbod's whole pitch is
  doing this for you. It reuses data and the line we already show, no new screen.
- **Care**: no bump in a Deload week, when the week's target reps went up, for bodyweight/timed moves, or for people
  under 18 / pregnant (same `careful()`-style guards). The steppers still let them change it.

### 2. Plate calculator · Add now · S
- **What**: on a barbell exercise (175 in the library), a small "Plates" link under the kg stepper opens a sheet:
  "20 kg bar + each side: 20 · 5 · 2.5". Pure function, no settings at first (20 kg bar, standard plates).
- **We have**: nothing (`plate` only appears in etiquette and food text).
- **Why add**: beginners stand at the bar doing sums; it is one tap, offline, no new data.

### 3. Rest-over notification that says what's next · Add now · S
- **What**: `restAlert()` in `src/notify.ts` sends "Rest over · Next set. Let's go." on the shared `nudges` channel.
  Change it to the real next step ("Set 3 · Bench press 60 kg × 8", or the next exercise) and give it its own Android
  channel "Rest timer" so people can mute nudges without losing the rest alert (already proposed in `research.md` §3).
- **Later**: a **✓ Done** / **+30 s** action on the notification and an ongoing "Workout running" notification (Hevy's
  Live Activity). Needs notification categories and background handling of the store: M.

### 4. Restore from backup · Later (first) · M
- **What**: You › Your data › **Restore**: pick the JSON that Export already writes and load it back (profile,
  sessions, weights, meals, challenges, supplements, tracker).
- **We have**: Export JSON and Export sets CSV (`app/you.tsx`); the sets CSV can be re-imported through Watch & health
  › Import (`src/importApps.ts` detects our own CSV), so **workouts** survive a new phone, but food, weigh-ins,
  challenges, supplements and settings don't. `expo-document-picker` is already installed.
- **Why later, not now**: it must run the store's version migration on the file, validate it, and ask
  "Replace / Merge"; that is M and needs careful testing. Also note the phone export goes through `Share.share` as a
  text message, which some share targets cut short; a real file share needs `expo-file-system` + `expo-sharing`.
  With no account and no cloud, this is the only safety net, so it should be the first "Later".

### 5. Workout notes · Later · S
- **What**: an optional "Add a note" on the Summary ("left shoulder tight"), shown in the calendar day sheet and next
  to "Last time" on that workout.
- **We have**: no note field on `Session` (only `source`).
- **Why later**: useful but not asked for by testers; adds a text field to a screen we just made calm (one Done).

### 6. Warm-up hint · Later · S
- **What**: on the first heavy compound lift (barbell, working weight over ~40 kg), one line: "Warm up first: bar × 10,
  30 kg × 5". Not logged as sets.
- **We have**: nothing in our own flow; warm-ups are only skipped when importing Strong/Hevy CSVs.
- **Why later**: real warm-up **sets** (Strong/Hevy) would add rows to the Done/Next count we just simplified. A text
  hint is cheap but most beginners' weights are light enough not to need it yet.

### 7. Measurements (waist first) · Later · M
- **What**: log waist (optionally hips, chest, arm) in the Quick log next to Weight, with a trend line.
- **We have**: body weight only (`weights` in the store, Quick log, `/chart/weight`), plus weight from Health Connect.
  No body fat, no tape measurements.
- **Why later**: helps fat-loss users when the scale stalls, but it is a new store list, a chart and a Quick log row.
  Gentle mode must hide it.

### 8. kg / lb · Later (only if we target US/UK) · M
- **What**: a units setting; every stepper, chart, record and export follows it.
- **We have**: kg everywhere (steppers step 2.5 kg; no `lb` anywhere in the code).
- **Why later**: every strength app has it, and US users bounce without it, but it touches many screens. Decide by
  audience.

### 9. Progress photos · Later, low · M
- **What**: private, on-device front/side photos by date with a side-by-side compare.
- **Needs**: `expo-image-picker` / camera and `expo-file-system`; photos must stay out of the JSON export or it
  balloons. Body-image sensitive: hidden in gentle mode and under 18.
- **Why later**: measurements (#7) give most of the value with less risk.

### 10. Share-a-workout image · Skip for now · M
- **What**: a styled card of the workout (time, volume, records) to post to Stories.
- **Needs**: `react-native-view-shot` + `expo-sharing`. Hevy reports more shares after adding Stories, but our users
  are mostly beginners training for themselves; the Summary already celebrates. Revisit if growth matters.

## Already covered or dropped

| Idea | Verdict | Why |
|---|---|---|
| 1RM estimate and PR celebrations | **Have it** | `e1rm()` (Epley) in `src/calc.ts`; Summary shows **New records** (`prs()`); badges "Personal best" and "Record breaker"; exercise page "Your best · N kg 1RM"; Progress/Strength chart plots est. 1RM. Hevy's mid-workout PR flash would add little over the Summary. |
| Weekly recap | **Good enough** | Sunday 19:00 "Your week" notification (`src/notify.ts`, toggle in Reminders) opens Progress, whose **This week** card is the recap. A separate recap screen (Apple, Fitbit, WHOOP) would duplicate it. |
| Superset grouping | **Skip** | Hevy, Strong, Fitbod, JEFIT have it, but it changes the Done / Next / rest flow we just made simple; circuit plans already exist as plan days. Mainly for intermediate lifters. |
| Home-screen widget | **Skip** | L for Expo: a native Android widget module and config plugin, kept in sync with the store. The centre Start button and reminders cover "what do I do today". |
| Barcode food scan | **Skip** | MyFitnessPal has had it paywalled since 2022 and people still use it, so value is real, but it needs the camera and an online food database (Open Food Facts, ODbL share-alike), which breaks the offline promise. Typed estimate, Log again and Your own already make logging quick. |
| Voice / audio cues | **Skip** | Nike Training Club and Apple Fitness+ use voice for guided classes; for set-by-set lifting, haptics and the rest-over alert are enough. Reconsider only for timed HIIT challenge sessions (`expo-speech`, M). |
| Rest-timer notification actions | **Later** | See #3: text and channel now, actions later. |

## Sources
- Hevy: [features guide](https://help.hevyapp.com/hc/en-us/articles/33106320824727), [warm-up calculator](https://www.hevyapp.com/features/warm-up-set-calculator/), [supersets](https://www.hevyapp.com/features/what-are-supersets/), [Live Activity](https://help.hevyapp.com/hc/en-us/articles/35649846517399), [widgets](https://www.hevyapp.com/features/home-screen-widgets/), [shareables](https://www.hevyapp.com/features/shareable/), [Stories case study](https://developers.facebook.com/success-stories/hevy/)
- Strong: [App Store listing](https://apps.apple.com/jo/app/id464254577) (warm-up and plate calculators, 1RM graphs)
- Fitbod: [progressive overload](https://fitbod.me/blog/what-is-progressive-overload-and-how-fitbod-builds-it-into-every-workout-automatically/), [warm-up sets](https://help.fitbod.me/hc/en-us/articles/360006337634-Warm-Up-Sets), [supersets](https://fitbod.me/blog/2018-11-21-supersets/)
- JEFIT: [measure your progress](https://www.jefit.com/blog/gym-workout-app-measure-your-progress)
- MyFitnessPal barcode paywall: [Digital Trends](https://digitaltrends.com/phones/myfitnesspal-barcode-scanning-not-free-premium-subscription)
- Open Food Facts licence: [API & data reuse](https://support.openfoodfacts.org/help/en-gb/12)
- Samsung Health body composition: [Samsung support](https://www.samsung.com/uk/support/mobile-devices/measure-your-body-composition-with-the-galaxy-watch-series/)
- Apple Fitness weekly summary: [iGeeksBlog](https://www.igeeksblog.com/view-weekly-activity-summary-on-apple-watch-iphone)
- Earlier findings: `docs/round13/research.md` §3 (rest timer, channels) and §6 (food, supplements)
