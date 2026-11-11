# Round 13 · Challenges

Owner's ask: a Challenges pane on the homepage and a Challenges screen, with 21-day and other challenges for
beginners, intermediate and serious lifters (weight loss, muscle gain, fitness, HIIT…), and more than weights.
Motivation matters a lot.

## Journey: before → after

**Before.** No challenges. The only "challenge" was the weekly badge challenge in `src/data/badges.ts`. Everything to
start was a weights plan or a quick session; nothing gave a 2–4 week goal with a finish line.

**After.**
1. Today shows a compact challenge pane (`ChallengeCard`). With nothing running it says *Try a 28-day challenge ·
   Weight loss 28 · picked for you* and opens Challenges. With one running it shows a progress ring with the day
   number, the name, *Day 8 of 21 · Build HIIT*, and one tonal action (Start / Log / + Glass / Did it), or a green
   tick when today is done. It also points out a missed day that can be made up and a new milestone star.
2. Train has a *Challenges* door under Your plan (running challenge's day, or "12 challenges · 14 to 30 days").
3. **Challenges** (`/challenges`): *Your challenge* on top (ring, day X of N, a cheer line, today's task with one
   button) or, with none running, *Picked for you* with **Start this challenge** (joins and opens it) and *See what's
   involved*. Then *Your badges* (finished challenges), then level chips (All, Beginner, Intermediate, Advanced) and
   goal chips (Any goal, Weight loss, Muscle gain, Strength, HIIT, Core, Mobility, Steps, Habits, Consistency), then
   the cards, ordered by fit for this person (top three tagged *For you*; *Yours* and *Finished* tags).
4. **Challenge** (`/challenge/[id]`):
   - Not joined: hero (level · goal, name, tagline, days, effort, gym tag, why it works), *The N days* grid preview,
     *What you'll do* (every task counted: "Spark HIIT ×3", "Rest days ×6"), *Rules*, and **Join · starts today**
     pinned in thumb reach. If another challenge runs, a sheet says what happens to it first ("Switch challenge?").
   - Joined: ring (Day 8 of 21), cheer line, streak, free misses left, % done, milestone stars; *Today · day 8* with the
     task(s), one primary button and "Did it without the app? Mark today done"; a *Make up day 6* block when a missed
     day can still be made up; *Your days* grid (done green ✓, missed red, rest moon, today ringed, upcoming grey); tap a
     past day for a sheet with what it asked and *Mark this day done*. ⋯ menu: All challenges, Leave challenge (with a
     confirm that says what's kept).
   - Milestones: at ¼, ½ and ¾ a one-time sheet ("Quarter way!", stars) — remembered per run in `hints`.
   - Finish: badge hero (*Badge unlocked · Kickstarter*, stars and trophy) with **Collect your badge** → saved to
     `pastChallenges` (completed) and a celebration sheet with **Up next:** the next level of the same goal (or the
     next recommendation). Over without the badge: honest "17 of 21 days. Every one of those counted.", *Finish
     challenge* and *Go again from today*.

## What's in it

### `src/data/challenges.ts` (pure, runs in Node)
- 12 challenges: **Beginner** 21-day Kickstart, Weight loss 28, Mobility 14, 10k steps 21, Hydration 14, Consistency 30
  (3×/week); **Intermediate** Muscle gain 30, HIIT 21, Core 14, Push-up 30; **Advanced** Advanced strength 28, Shred 21.
  Each has a tagline, a "why", effort per day, a finisher badge name, free misses, and `day(i)` → tasks.
- Task kinds: `workout` (any finished workout, or a 15+ min watch workout), `session` (a specific session, started
  from the challenge), `cardio` (a cardio-ladder session from `src/data/cardio.ts`, a cardio circuit, or a watch
  workout of N min), `steps` (tracker `daily[day].steps`), `protein` (`targets(profile).protein` from logged meals; in
  no-numbers mode "Log 3 meals"), `water` (glasses × `waterPrefs.glassMl` vs `waterPrefs.goalMl`). Rest days have none.
- 13 new sessions (`circuits`) built only from existing exercise ids: 10-minute starter, Fat-burn circuit, Spark /
  Build / Burn HIIT (harder each week), Steel core, Hips and back flow, Strength A and B (5×5 barbell), Push-ups week
  1–4. They are started with the store's `start(asDay(q), place)`, so the engine's level/safety gates still swap
  locked moves (e.g. jumping for heavier bodies).
- `progress(ch, run, ctx, today)`: per day `done | missed | rest | today | upcoming | open`, plus done/required, missed,
  free misses left, streak, % and over/completed. Weekly challenges count each 7-day block instead of days.
- Research (round13/research.md §5) applied: **rest days count as done**; **a missed day becomes a make-up**: doing its
  task again in the next two days (more workouts than that day asked for, or the steps/protein/water on a day that
  didn't ask for it) marks it done (`madeUp`); **excused days** (Today's sick/travel/rest excuse) count as rest, like
  Apple's pause; **milestone stars at ¼, ½, ¾** and a badge at the finish; finishing suggests the next level.
- `recommend(profile, sessions)`: goal fit, level fit, concerns (posture/back → Mobility, lose-weight, run…),
  gym-only challenges sink for home trainers, HIIT sinks for heavier bodies, pregnancy/after birth keep HIIT and
  Advanced out of the top. `cheer(progress)`: a short motivating line for the moment (day one, streak, halfway, make
  up, last days, weekly count, finished).
- `selfCheck`: every circuit id exists; day states, ticks, make-up (and its 2-day window), excused days, steps, water,
  protein (and gentle), watch/ladder cardio, finishing early, over with too many misses, weekly weeks, milestones,
  recommendations.

### UI
- `src/challenges/use.tsx` (new, shared): `useCtx` (store + tracker → day data), `useRun`, `useRecommended`,
  `useTaskActions` (Start today's workout via `useToday().start`, a session via `start` + `openWorkout`, cardio via the
  person's cardio-ladder pick, Log food via `FoodSheet`, Add a glass via `addWater(1)`; an open workout is resumed,
  never replaced), `TodayTasks`, `MakeUp`, `DayGrid`, `DaySheet`, `Stars`, `MilestoneSheet`, `Pill`.
- `src/challenges/Card.tsx`: `ChallengeCard()` (Today) and `ChallengesDoor()` (Train).
- `app/challenges.tsx`, `app/challenge/[id].tsx` (new routes; the Stack picks them up from the file names).

### Edits outside my files (small, additive)
- `app/(tabs)/train.tsx`: one import and the `<ChallengesDoor />` under Your plan.
- `scripts/selfcheck.mjs`: `../src/data/challenges.ts` added to the self-check list.
- `scripts/check.mjs`: `../src/data/challenges.ts` added to the exercise-id check (comment updated).
- No store changes. Manual ticks use `tickChallenge(dayKey, on)`; milestones use `seeHint` keys
  `challenge:<id>:<start>:<k>`.

## Screenshots (`/tmp/claude-0/shots/challenges/`, 390 px)
- Catalogue: `cat-none-light.png`, `cat-none-dark.png`, `cat-mid-light.png`, `cat-mid-dark.png`, `cat-mid-light-2.png`
- Detail, not joined: `det-preview-light.png`; switch confirm `det-switch-light.png`
- Detail, joined mid-way (done / missed / rest / today / make-up): `det-mid-light.png`, `det-mid-light-2.png`,
  `det-mid-light-3.png`, `det-mid-dark.png`, `det-mid-dark-2.png`; day sheet `det-daysheet-light.png`;
  menu `det-menu-light.png`; leave confirm `det-leave-dark.png`
- Weekly (Consistency 30) + milestone sheet: `det-weekly-light.png`, `det-milestone-light.png`
- Finished: `det-fin-light.png`; collected + celebration `det-collect-dark.png`
- Today card: `today-none.png`, `today-none-dark.png`, `today-mid.png`, `today-mid-dark.png`, `today-wl.png`,
  `today-wl-light.png` (two tasks: steps + protein → Log), `today-hy.png` (+ Glass), `today-fin.png`,
  `today-mid2-light.png` (done today + new milestone); strip: `cards.png`, `today-grid.png`
- Train: `train-light.png` (running), `train-dark.png` (none)
- Seed states: `none.json`, `mid.json`, `mid2.json`, `wl.json`, `hy.json`, `fin.json`, `cs.json`, `tracker.json`;
  helper `shot.cjs` (adds `--tracker`, `--scroll`, `--xy`).

## Couldn't verify
- Native only: haptics, the reduced-motion path of the zoom-in celebrations, Android back closing the sheets. Steps
  from Health Connect / the ring were seeded into the tracker store, not synced from a device.
- Starting a session from a challenge was checked through the same `start` + `openWorkout` path Today uses, not by
  finishing a full workout in the browser; the day's auto-tick from a finished session is covered by the self-check.

## Hurdles and choices
- **Per-task ticks.** `ChallengeRun.done` holds day keys only, so a hand tick marks the whole day (simple, honest:
  "Mark today done" for what the app can't see). I didn't encode task ticks into the strings.
- **Session days count only that session** (title match), so HIIT days need HIIT; anything else can be ticked by hand.
  `workout` days accept any workout, ours or the watch's.
- **Badge rule:** finish within the free misses (missed days not made up). Past it the challenge keeps going and ends
  honestly with "X of Y" and *Go again*; no shame screen, no reset.
- **Not done (research ideas):** "Repeat this week" after two missed days in a row needs a store op to shift the start
  date; left out to keep the store untouched. Step-ladder targets from the 7-day average and 6–8 week blocks were
  out of scope for this round's lengths (14/21/28/30).
- Done cells are green (not the goal colour) so HIIT's red never reads as "missed". Today's card action is tonal
  because Today's one filled button is the workout's Start.
