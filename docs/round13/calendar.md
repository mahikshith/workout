# Round 13 · Calendar stream

Owner: "Whenever there were no workouts, show it in a different colour… track calories burned from the fitness
tracker apps… import that into our calendar. Keep track of what our app is getting from partner applications."

## Journey before → after

**Before.** Progress › Consistency opened a big 56 px streak number, three tiles, and a month grid where a day was
either teal (sets logged) or blank. Below the grid sat the picked day's workouts. Watch runs, rest days, excused days,
planned days and calories never showed on the calendar. You could only excuse today, from Today.

**After.** Progress shows a **Calendar card** right under "This week": the streak, workouts this month, and this
week's seven days in the calendar's colours. Tap it → **Calendar** (`/history`):

1. A calm streak strip (one line plus its rule).
2. The month card: arrows or swipe between months, "Back to today" under the month name when you're away from it, a
   numbers row for that month (workouts · active days · rest days · kcal burned), the grid, and a legend.
3. "From your watch": which apps sent data in the last 30 days (Fitbit, WHOOP…), when it last synced, and what it
   sends (workouts, calories, steps, sleep). Opens `/tracker`. Without a watch: "Add your watch" → `/watch`.
4. Sessions per week and Habits (kept).

Tap any day → **day sheet**: calories burned (one honest number and where it came from), your workouts (time, sets,
volume, HR, the watch workout matched to it; Exercises to expand; Delete with a second tap), watch workouts (type,
app, minutes, kcal, km, avg HR), day totals from the watch (steps, sleep, resting HR), food (kcal, protein) and water,
and "Mark this day" (Rest day / Sick / Travel, tap again to clear) on days without a workout of ours.

## Day markers

| Day | Marker |
|---|---|
| Workout (ours) | filled training teal |
| Watch activity (imported, not merged) | soft blue fill + blue badge dot in the corner; both sources = teal fill + blue dot |
| Rest day (past, not planned, nothing done) | calm indigo (sleep colour) wash |
| Excused (sick / travel / rest) | grey fill + icon badge (medkit, plane, bed) |
| Missed planned day | faint red dashed ring (research §7) |
| Planned (today or future) | teal outline |
| Today | dark/white ring around the cell |
| Calories burned | small orange bar under the day, length = active kcal (full at 800) |
| Before you started (first session, plan pick, or first synced day) | blank, never "rest" |

"Planned" = a weekday with a workout reminder on; without workout reminders, a training day in the plan's
Monday–Sunday `week` schedule. Today never shows as rest or missed (it isn't over).

## Calories: counted once

`burned()` in `src/calendar.tsx`: the watch's day **active kcal** wins, because it already contains the watch's
workouts; the sheet lists those workouts under "Already counted in that total". Without a day total, the watch
workouts' own kcal add up (imported + merged, each once, merged ones only via the session they belong to). Our
logged workouts carry no calorie estimate: we don't invent one. "With resting calories" shows `totalKcal` when the
watch sends it. Month total = sum of each day's number. No-numbers mode (gentle / food concern) hides every calorie
figure and bar, and shows meal count instead of kcal.

Sources are named: package → friendly name (`appName`; `com.fitbit.FitbitMobile` shows as "Fitbit", the rest via
`originName` in `src/health/guides.ts`), and files/straps by source ("FIT file", "Heart rate strap"…).

## Files

- `src/calendar.tsx` (new): pure helpers (`monthDays`, `weekDays`, `monthSummary`, `burned`, `plannedDay`,
  `appName`/`sourceName`), `MonthGrid` (swipe), `WeekStrip`, `Legend`, `DaySheet`.
- `app/history.tsx`: rebuilt as above; title "Calendar".
- `app/(tabs)/progress.tsx`: Calendar card with week strip replaces the Consistency door (same place, more
  prominent); doors under a "Trends" heading; this-week numbers 24 px instead of 28; Strength meta shortened
  ("Romanian Deadlift 52.5 kg · up 12.5 kg"); all sections kept.
- `src/store.ts` (not mine, additive): `excuse(why, day?)` takes an optional day so any day can be marked.
- `app/chart/[kind].tsx`: unchanged.

## Screenshots (`/tmp/claude-0/shots/calendar/`)

Seeds: `seed.cjs` → `full.json` (6 weeks of sessions, Fitbit + WHOOP daily rows, runs, a ride, a merged WHOOP
strength workout, excuses, meals, water), `nowatch.json`, `new.json`. `shot.cjs` also seeds `gym-buddy-tracker`.

- `cal-dark.png` November, dark · `oct-light.png`, `oct-dark.png` a full month with rest/missed/excused/watch
- `sheet-both-light2.png`, `sheet-both-dark.png` Nov 10: our workout + Fitbit run + merged WHOOP
- `sheet-rest-light.png` rest day with Mark chips · `sheet-sick-dark.png` excused day
- `new-light.png`, `new-dark.png` empty month, new user · `nowatch-light.png` no watch
- `cal-lower-light.png` watch note and lower page · `progress-light.png`, `progress-dark.png`,
  `progress-lower-light.png`, `progress-new-light.png`

## Not verified / open

- Swipe between months is wired with gesture-handler Pan; checked arrows on web, not a real touch swipe on a phone.
- Health Connect data was seeded, not synced (native only).
- A seed with empty sleep `start`/`end` made Recovery show "Readiness NaN"; real syncs always carry times, but the
  readiness code could guard it.
- Streak stays in days (research suggests weeks): changing it touches Today and calc, outside this stream.

## Hurdles and choices

- `Sheet` content can be long: the day body is a ScrollView with `flexShrink: 1` inside the 92 % sheet.
- Showing a calorie figure in every cell needed 10 px text (off the type scale); a short orange bar reads at a glance
  and keeps the exact number in the sheet and the cell's accessibility label.
- Kept per-reason excuse icons rather than one pause mark: "sick" vs "travel" is useful at a glance.
