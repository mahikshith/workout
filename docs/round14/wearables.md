# Round 14 · Wearables stream

Owner: "Fitness trackers track everything except the workouts the user did, so they depend on this app for that.
Fetch the relevant information, like calories burned, from the connected fitness app into Gym Buddy. Per exercise, or
combine the total calories burned per day and log it to the calendar."

## What was there before

Round 13 already read day totals (steps, active and total kcal, sleep…), watch workouts with kcal/HR, and heart rate
per set for our own workouts. But a workout logged here carried **no calories** unless the watch had recorded its own
strength session that we could merge. The calendar showed calories only from the watch's day total (a thin bar under
the day); the Summary showed a rough "about N kcal" in the subtitle from a different formula; nothing was per exercise.

## Data flow

```
watch ──▶ brand app (Fitbit / Samsung Health / Garmin Connect / WHOOP…) ──▶ Health Connect ──▶ Gym Buddy
                                                                                               │
strap / ring / watch broadcast ───────── Bluetooth, live heart rate ──────────────────────────┤
                                                                                               ▼
                         workout logged here  ◀── calories + heart rate for its time window attached
                                   │                 (tracker store: sessionKcal, sessionHr, setTimes)
                                   ├──▶ Summary: "Burned 230 kcal", avg / max bpm, By exercise
                                   ├──▶ Calendar: number under each day, day sheet, month total, weekly average
                                   └──▶ Home: TodayBurn row
```

1. A workout ends → `useHealthSync` (src/health/index.ts) calls `readSessionHr` (as before) and the new
   `readSessionKcal` (src/health/healthConnect.ts): Health Connect's own **aggregate** of `ActiveCaloriesBurned` over
   `[startedAt, endedAt]`, and `TotalCaloriesBurned` when there is no active number. Both are re-read whenever the app
   comes to the front for 24 hours (watches sync late), at most every 5 minutes.
2. Every sync also back-fills workouts of the last 30 days that have no calories yet (12 a sync, newest first).
3. A strap, ring or watch broadcast streaming during a workout is now **recorded** (one reading per 5 s, in memory) and
   saved as that workout's heart rate, per set too, when it finishes (`origin: 'strap'`). Before, live heart rate was
   shown and then thrown away. Health Connect's reading replaces it later if the watch shares one.
4. Results live in the tracker store (`sessionKcal`, `sessionHr`), keyed by session id. The main store and its
   migrations are untouched; Disconnect wipes Health Connect's numbers and keeps strap heart rate.

Permissions: `ActiveCaloriesBurned`, `TotalCaloriesBurned` and `HeartRate` read were already in `app.json` and in the
one permission request (`READ_TYPES`); nothing new to ask. When calories are not granted, the reads return quietly,
workouts show an estimate, and the "What comes into Gym Buddy" card says where to switch them on.

## Sources and priority (src/health/energy.ts, pure)

`sessionEnergy(session, person, byId, input)` → `{ kcal, source, avgHr?, maxHr?, minutes, perExercise[] }`.
All numbers are **active** energy (on top of resting), so they can sit next to a watch's "active calories".

| # | `source` | Used when | How |
|---|---|---|---|
| 1 | `watch` | the watch counted calories in the workout's window, or its own copy of the workout was merged into ours | Health Connect active kcal as is; or total kcal minus resting burn for those minutes |
| 2 | `heart rate` | no usable calories, but heart rate (Health Connect samples, merged watch workout, or strap) | Keytel 2005, minus resting burn |
| 3 | `estimate` | nothing from a device | MET × body weight × time, minus 1 MET |

A watch number is ignored when it is under 30 % of the estimate (watch in the locker, or a daily record spread thinly
over the window) or over 25 kcal a minute. Calories whose only origin is the phone itself are never used.

### Formulas

- **Keytel et al. 2005** (*J Sports Sci* 23(3):289-297, "Prediction of energy expenditure from heart rate monitoring
  during submaximal exercise"), kJ per minute, divided by 4.184 for kcal:
  - men: `-55.0969 + 0.6309·HR + 0.1988·kg + 0.2017·age`
  - women: `-20.4022 + 0.4472·HR - 0.1263·kg + 0.0740·age`
  - sex "other": the mean of the two.
  - Limits: fitted on steady aerobic exercise at roughly 90-150+ bpm, without a VO2max term here. Lifting raises heart
    rate more than oxygen use, so it reads high for strength work. We therefore hold the strength part of a workout
    between 0.5× and 1.5× the MET estimate; cardio is used as is (never under half its estimate).
- **Resting burn**: Mifflin-St Jeor 1990 (*Am J Clin Nutr* 51:241-247): `10·kg + 6.25·cm - 5·age + 5` (men) / `-161`
  (women) kcal a day; without a height, 1 kcal per kg per hour.
- **MET** values from the 2011 Compendium of Physical Activities (Ainsworth et al., *Med Sci Sports Exerc*
  43(8):1575-81): resistance training 3.5 (02054), squats / explosive 5.0 (02052), vigorous lifting 6.0 (02050),
  vigorous calisthenics 8.0 (02030), stretching 2.3 (02101), holds 3.0, cardio by kind (walk 4, elliptical 5, bike 7,
  jog 7, row 7, run 9, stairs 9, rope / sprints 11). Compound strength lifts use 5, isolation 3.5, Olympic /
  powerlifting / strongman 6. More than three sets every four minutes counts as a circuit (×1.25, at most 8).
  kcal = (MET − 1) × kg × hours. Sanity: 70 kg, 45 min of mixed strength ≈ 190 kcal.
- **Time**: the workout's clock, unless it is far from what the sets could take (logged afterwards in two minutes, or
  left open all evening); then the sets give the time (about 3 s a rep or the hold's seconds, plus the rest).

### Per exercise

Minutes per exercise come from **when each set was ticked** (tracker `setTimes`: a set owns the time since the set
before it), else from sets × (work + rest); both scaled to the workout's length. The workout's calories are then split
by minutes × (MET − 1), nudged by the exercise's own average heart rate against the workout's when the watch saved
often enough for per-set heart rate. Parts are whole numbers that add up to the total exactly. So per-exercise
calories are always a **split of the session number, not a measurement**; per-exercise heart rate is measured.

### The day (calendar)

`dayBurn(activeKcal, watchWorkouts, sessions)`:
- the watch's **day active kcal** when present and at least the workouts' sum (it already contains them);
- otherwise **the day's workouts added up**: our sessions (their energy, whatever the source) plus watch workouts that
  are not one of ours. A watch workout merged into one of our sessions (`linkedSessionId`) only counts through that
  session. The two are never added together, and an id counts once.
- A day total smaller than the workouts means the watch missed one; the day sheet says so.

## What the person sees

- **Summary**: one card, "Burned 230 kcal" (or "Burned about 181 kcal"), "avg 118 bpm · max 154 · From your watch" /
  "Worked out from your heart rate" / "Estimated from your sets and weight". "By exercise" opens kcal, average bpm and
  minutes per exercise, with each set's peak as chips (kept from round 11). No device at all: one quiet row "Connect a
  watch for measured calories and heart rate" → /watch. The old "about N kcal" in the subtitle is gone (one number).
- **Calendar**: the calories burned sit as a number under each day (grey when it is an estimate), replacing the bar.
  Month card: "About 3,196 kcal a week" (+ "part estimated"), next to the month total that was already there. Day
  sheet: the day's number and where it is from, every workout with kcal, avg / max bpm and a source badge (Watch /
  Heart rate / Estimate); Exercises shows kcal and avg bpm per exercise. New "Recent workouts" list (last 5) with the
  same line; a tap opens that day.
- **Home**: `TodayBurn` (for the lead to place): "395 kcal burned today · Fitbit · workout included", heart rate on
  the right (live, or the last reading today), opens /tracker.
- **Tracker and Watch & health**: "What comes into Gym Buddy": Calories → workouts, calendar; Heart rate → workouts
  and sets; Steps → your day; Sleep → recovery (ticks once they arrive), the line "Your watch cannot see sets and
  reps. Every workout you log here gets its calories and heart rate attached by itself", and the last workout as proof.
- No-numbers mode (gentle / food concern) hides every calorie figure as before; heart rate stays.

## Files

| File | Change |
|---|---|
| `src/health/energy.ts` (new) | `sessionEnergy`, `dayBurn`, `keytelKcalPerMin`, `restingKcalPerMin`, `metOf`, `SOURCE_LABEL`, `SOURCE_LINE`, `selfCheck` |
| `src/health/useEnergy.ts` (new) | store wiring: `energyFor`, `energyOf`, `useEnergyData`, `useSessionEnergy`, `burnOn`, `useTodayBurn` |
| `src/health/TodayBurn.tsx` (new) | Home row |
| `src/health/WatchGives.tsx` (new) | "What comes into Gym Buddy" card |
| `src/tracker.ts` | `SessionKcal`, `sessionKcal`, `putSessionKcal`, `STRAP_ORIGIN`; Disconnect keeps strap HR; calories kept for 500 workouts |
| `src/health/healthConnect.ts` | `readSessionKcal`, back-fill in `sync` |
| `src/health/index.ts` | reads calories with HR after a workout; records strap HR during a workout |
| `src/calendar.tsx` | `burned` replaced by `burnOn`; `DayInfo.est`; `monthSummary.kcalPerWeek / kcalEst`; number under the day; day sheet rows; `SourceBadge` |
| `app/history.tsx`, `app/summary.tsx`, `app/tracker.tsx`, `app/watch.tsx` | as above |
| `scripts/selfcheck.mjs` | runs `energy.ts` selfCheck |

Not changed: `src/journey.tsx` still uses its own older `sessionKcal` for the weight journey's weekly balance (not
this stream's file); it reads lower than the new estimate because it counts set time only. Worth pointing it at
`energyOf` later so the app has one number.

## Screenshots

`/tmp/claude-0/-home-user/9e8428a6-a257-5d7c-bdaf-c7110a3cfdcf/scratchpad/wearables/` (seeded stores, `seed.cjs`
kinds `watch`, `nowatch`, `strap`; `shot.cjs`): `cal-light.png`, `cal-light-2.png` (recent workouts),
`cal-nowatch-dark.png`, `day-light.png`, `day-ex-light.png`, `day-est-dark.png` (watch missed the workout),
`summary-watch-light.png`, `summary-watch-light-2.png` (by exercise), `summary-nowatch-dark.png`,
`summary-strap-light.png`, `tracker-light.png`, `tracker-empty-light.png`, `watch-dark.png`, `todayburn-all.png`.

## Not verified (needs a real Android phone with a watch)

- Everything native: `readSessionKcal` has never run against Health Connect. The call shape matches
  react-native-health-connect 3.5.3's types and the existing round 13 `watchNumbers` read, nothing more.
- **How each brand writes calories.** Some apps write active calories in fine slices, some in hourly or daily records.
  Health Connect gives a partly overlapping record its share by time, so a coarse record makes the window number too
  low; the 30 % guard then falls back to heart rate or the estimate. Which brands do this is unknown until tested.
  WHOOP shares no heart-rate samples, so its workouts depend on the calorie read alone.
- Whether `TotalCaloriesBurned` in a short window is real or derived by Health Connect from a basal rate.
- The strap recording (BLE does not exist on web): sample cadence, a workout paused for long, app killed mid-workout
  (the recording is in memory and is lost).
- The day rule assumes a watch day total that is at least the workouts' sum contains them. If the watch was off
  during the gym but the day was otherwise active, the workout is not added on top, so that day reads low.
- Calorie figures were sanity-checked against the formulas only, not against a metabolic cart or a watch.
- `WeekStrip` on Progress uses the same day cell, so it now also shows the number under each day and is 10 px taller
  (checked on web: `progress-light.png`).
- `TodayBurn` was screenshotted on a throwaway route (since deleted), not inside Home.
