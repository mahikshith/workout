# Round 14: simpler first run and home, a real workout engine, fluid UI

Owner's feedback on the round 13 APK (11 Nov 2026): "something is off". We looked at the real screens at phone size
first (393 x 851, before shots in the project files under `round14/before/`) and agree:

- **Onboarding** is five screens of four small tiles pinned to the top with two thirds of the screen empty, and it
  never asks height, weight, level or equipment unless you find the optional extra step.
- **Home** opens with a workout already chosen, then a "Not today?" chip row, a five-row Get started list, three rings,
  a challenge pane, a week strip and a quote. Many things compete; plans are not visible at all.
- **Bottom bar**: the centre button starts a workout straight away; plans and challenges are buried inside Train.
- **Engine**: four goals only; the plan pick ignores height/weight mostly, history, recovery and muscle balance.
- **Demos**: some animated figures sit when the move is standing (and the reverse); line drawings have heavy white strokes.
- **Wearables**: calories and heart rate from the watch are not attached to the workouts logged here.
- **Feel**: flat cards, abrupt transitions. Wanted: glass, fluid motion, Google Health / Fitbit smoothness.

Rule for the whole round: **remove no feature**. Fold things into fewer, calmer places.

## The new map

```
Tabs:   Home    Plans    ( Workouts )    Progress    Fuel         avatar -> You
Home:   header [date, streak, + Log, avatar]
        Recommended for you   one card: today's workout, why (2 short reasons), Start / Change
        Today strip           one row: training, protein, third ring (tap to open)  [compact]
        Plans for you         every plan that fits, best first, horizontal cards by group, "All plans" -> Plans
        Challenges            one row -> Plans tab, Challenges segment
        More                  Get started (collapsed to one row), tracker, week, coach line, notes
Plans:  segmented  Plans | Challenges.  Your plan on top, then every plan by category; challenges catalogue
Workouts (centre): search, muscles, all exercises, quick sessions, "Start today's workout"
        while a workout runs the centre shows the clock and resumes it
Progress, Fuel: as round 13
```

First run: one scrollable page (goal, level, where + equipment, days, height, weight, age, sex, name), Skip at the top,
one button at the bottom. It lands on Home, where the recommendation sits on top and all plans are below to browse;
nothing is forced.

## Streams (one file each in this folder)

| Stream | Owner files | Notes file |
| --- | --- | --- |
| engine | `src/reco/*`, `src/planner.ts`, `src/coach.ts`, `src/engine.ts`, `src/store.ts` (Goal), `src/context.tsx` (GOALS), `src/calc.ts`, `src/data/plans.ts`, `src/data/challenges.ts` (goal map), `scripts/selfcheck.mjs` | `engine.md` |
| onboarding | `app/onboarding.tsx` | `onboarding.md` |
| home + nav | `app/(tabs)/*`, `app/library.tsx`, `app/challenges.tsx` | `home.md` |
| demos | `src/data/poses.ts`, `src/figure.tsx`, drawings (`scripts/media.mjs`, the `Loop`/`Demo` part of `src/ui.tsx`) | `demos.md` |
| wearables | `src/tracker.ts`, `src/health/*`, `src/calendar.tsx`, `app/summary.tsx`, `app/history.tsx`, `app/tracker.tsx` | `wearables.md` |
| fluid UI | `src/theme.ts`, `src/ui.tsx` (not Demo/Loop), `src/sheet.tsx`, `src/kit.tsx`, `app/_layout.tsx`, new `src/glass.tsx`, `src/motion.tsx` | `fluid.md` |

Then: friction pass on every screen, `docs/guide/` refresh with new screenshots.
