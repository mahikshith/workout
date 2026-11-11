# Data and sources

Where every number in the app comes from, how the scores are worked out, and what is stored where.

## What is stored, and where

Everything stays **on the phone**. There is no account and no server.

| Store | Holds | Code |
|---|---|---|
| `gym-buddy` | Profile, plan, workouts and sets, meals (with optional carbs, fat and time), water, water goal and glass size, weights, periods, badges, the running challenge and past challenges, supplements and their reminder times, reminders, one-time hints, settings | `src/store.ts` |
| `gym-buddy-tracker` | Watch data per day (steps, calories, sleep, heart rate, HRV…), today's heart rate in 10-minute steps, watch workouts (with kcal and heart rate), saved strap and ring, per-set heart rate, what we wrote to Health Connect | `src/tracker.ts` |
| `gym-buddy-look` | Theme mode, accent, haptics | `src/look.ts` |

**You › Your data** exports everything as JSON, or every set as CSV, and can erase it all.

## Your own entries

| Shown as | Comes from |
|---|---|
| Sets, reps, kg, volume, minutes | The sets you tick. Minutes are rounded the same way everywhere (`src/glance.ts`) |
| Last time / first weight | Your last session of that exercise; the first time, a light starter weight from your level and body weight |
| Streak | Days in a row with a logged workout ("day streak") |
| Meals, kcal, protein, carbs, fat | Foods and recipes you log, times the servings you pick (values below), or your own entry |
| Water | Glasses you add, stored as standard 250 ml units, so changing your glass size (150–750 ml) never rewrites history. Shown in ml everywhere |
| Water goal | About 35 ml per kg of body weight until you set your own (Fuel › Water) |
| Supplements | What you tick each day and the reminder times you set (You › Reminders › Supplements) |
| Weight | Weights you log (Quick log, You › About you, the body chart) |
| Go heavier | Last time's weight, plus 2.5 kg (barbell, machine) or 2 kg (dumbbell, kettlebell) when every set last time reached the target reps (`goHeavier()` in `src/store.ts`). Not in Deload weeks, timed holds, under 18, pregnancy or after birth |
| Plates | Greedy fill of 25, 20, 15, 10, 5, 2.5 and 1.25 kg plates per side for the total and bar you set (`src/plates.tsx`); anything that can't be made is shown |

## Watch data (through Health Connect)

Read with `react-native-health-connect` (`src/health/healthConnect.ts`): steps, distance, active and total calories,
heart rate (day average and today's samples in 10-minute steps), resting heart rate, HRV (RMSSD), SpO2, breathing rate,
VO2 max, sleep sessions with stages, weight, and exercise sessions (with kcal and average/max heart rate for the last
14 days). Each record keeps the app that wrote it, so Tracker, Watch & health and the Calendar can say what came from
where ("Fitbit", "WHOOP", "Samsung Health"). What each brand shares: [Connect your watch](connect-devices.md).

Not read: **skin temperature** (the Health Connect library we use, 3.5.3, has no record for it; Fitbit does write it),
WHOOP recovery and strain, Garmin Body Battery and HRV status (those apps never share them). Health Connect access is
asked for the last 30 days first; older history is a separate, optional step.

Live heart rate comes over standard Bluetooth heart rate (service 0x180D) with `react-native-ble-plx`
(`src/health/ble.ts`); RR intervals give workout HRV. Colmi rings use our own adapter (`src/health/colmi.ts`,
protocol notes from the MIT-licensed colmi_r02_client). Files are read by our own parsers (`src/health/fit.ts`,
`importers.ts`, `src/importApps.ts`); the Garmin FIT SDK is used only in tests because its licence forbids shipping it.

## Calories burned (Calendar)

One number per day, counted once (`burned()` in `src/calendar.tsx`): the watch's **active calories** for the day win,
because they already include the watch's workouts (the day sheet lists those under "Already counted in that total").
Without a day total, the watch workouts' own kcal are added up, each once. Workouts logged only in Gym Buddy carry no
calorie estimate in the calendar: we don't invent one. "With resting calories" shows the watch's total when it sends it.
The month total is the sum of the days. Gentle mode hides every calorie figure.

## Challenges

`src/data/challenges.ts` (pure code, checked by `scripts/selfcheck.mjs`). Each day of a challenge is worked out from what
the app already knows:

| Task | Ticks when |
|---|---|
| Workout | Any finished workout that day, or a 15+ minute watch workout |
| Session | That challenge session (by name) was finished, started from the challenge |
| Cardio | A cardio session or circuit, or a watch workout of the asked minutes |
| Steps | The watch's steps for the day (`gym-buddy-tracker`) |
| Protein | Protein from meals logged that day vs your target (gentle mode: 3 meals) |
| Water | Water that day vs your water goal |

Rest days count as done. A **missed day can be made up** by doing its task again in the next two days. Days marked
sick, travel or rest count as rest. Each challenge has 2–4 free misses; the badge needs the challenge finished within
them, and going past them never resets you. A hand tick ("Mark today done") marks the whole day. Picks for you weigh
goal, level, age, place and home kit, concerns, body weight (fewer jumps) and pregnancy or after birth (no HIIT,
impact or Advanced near the top). Progressions grow by week, not by day.

## Readiness

0–100 each morning (`src/health/readiness.ts`). Shown once there are 4 nights of data.

| Input | Weight | Compared with |
|---|---|---|
| HRV (RMSSD, on a log scale) | 45% | Your own last 28 days |
| Resting heart rate (lower is better) | 25% | Your own last 28 days |
| Sleep length | 20% | 7.5 hours |
| Sleep regularity | 10% | How steady your bedtimes were over 7 nights |

Each input becomes a z-score against your baseline; the weighted sum goes through a normal curve, so a usual day is
about 50 and a clearly better one 80+. Breathing rate well above usual, or SpO2 under 93%, adds a flag and lowers the
score. When the watch shares no HRV (WHOOP), HRV from live heart rate in workouts stands in.

Bands: **67+ Ready to push**, **34–66 Train as planned**, **under 34 Take it easy**. The workout shows matching advice
before you start.

**Effort** (0–100) is Banister TRIMP from the workout's heart rate, with max heart rate estimated as 208 − 0.7 × age
(Tanaka). Workouts without heart rate get a time-based estimate, marked "estimated". Weekly load is compared with your
4-week average.

Ideas (not code) came from MIT-licensed open-source projects studied with REA: geniemax-core, unstrapped,
whoop-reader and vitals. These are our own scores, not WHOOP's Recovery or Strain.

## Plan engine

`src/planner.ts` picks the plan; `src/data/split.ts` builds any plan for 1–7 days.

1. **Life stage first**: pregnancy, the first 12 weeks after birth, and office workers get their own plans.
2. **Hard rules**: where you train (gym plans for the gym, home plans that need at most the gear you have, 80% of moves
   must work with it), women's plans only for women, no bro split for beginners, injuries remove plans with too many
   moves you should skip.
3. **Days are a hard rule**: every plan left is fitted to exactly your days. 2–3 days: full body. 4: upper/lower.
   5: upper/lower + full body (or push/pull/legs + upper/lower). 6: push/pull/legs twice. Beginners keep their days
   but get lower volume (one set fewer, gentler reps, longer rests, easier versions of hard moves); at 6 days two of
   them are light recovery days.
4. **Scores** rank what's left: goal, level, body, age (fewer jumps past 55 or with knee concerns), concerns.
5. **Reasons** are shown with the pick: the days line first, then level, then concerns and goal.

Sets in a workout follow the plan's week (Learn, Build, Push, then a Deload week). The next workout follows the
plan's own order. Tested on 900 profiles in `scripts/selfcheck.mjs`.

## Food values

| Thing | Source |
|---|---|
| Calorie and protein targets | Mifflin–St Jeor, scaled by training days and nudged by goal; pregnancy, after birth and thyroid never get a big deficit (`src/calc.ts`) |
| Foods (`src/data/foods.ts`, plus everyday foods in `src/foodsheet.tsx`) | Hand-entered per-serving approximations of standard nutrition tables |
| Recipes (`src/data/recipes.ts`) | Ingredient lists with approximate kcal and protein each, summed per serving |
| "Describe a meal" estimate | Matches the words you typed to foods and counts ("2 roti" = 2 servings) |
| Supplements catalogue (`src/data/foods.ts`) | Nine common supplements with one line of general guidance each; a protein shake logs as about 24 g protein |

## Exercises, drawings and media

| Thing | Source and licence |
|---|---|
| 873 exercises: muscles, equipment, level, steps, photos | [free-exercise-db](https://github.com/yuhonas/free-exercise-db), public domain |
| Animated figures (893 drawn) | Our own poses (`src/data/poses.ts`) drawn by `src/figure.tsx`. Each frame is fixed for the whole rep, so travelling moves stay inside it |
| Line drawings | [workout-guide](https://github.com/bryllim/workout-guide) by Bryl Lim, CC BY-SA 4.0 (from Everkinetic) |
| Videos | [wger.de](https://wger.de), CC BY-SA 4.0, authors credited under each video |
| Muscle map | [MuscleMap](https://github.com/melihcolpan/MuscleMap) by Melih Colpan, MIT |
| Exercise swaps | Our own ranking (`alternatives()` in `src/data/exercises.ts`, re-ranked in `app/session.tsx` by your reason): same muscles and movement, filtered by place, gear, level and the reason you give |

## Colours

One colour per part of the day (`src/theme.ts`), with a light and a dark value each, all at least 4.5:1 contrast on
their background: training teal, heart red, sleep indigo, food orange, protein pink, water blue, weight purple,
streak gold, steps green. The hues follow Google Fitbit's app.
