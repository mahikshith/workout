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

## More challenges (round 13b)

Owner's ask: *"Perform research and add more challenges… It's up to the user to take it or break the challenge."*
So: many more to choose from, each still one clear task a day, with rest days and free misses so breaking one day
never breaks the challenge. **15 new, 27 in all** (12 Beginner, 11 Intermediate, 4 Advanced). Everything lives in
`src/data/challenges.ts`; the screens pick the new ones up with no UI change.

### Research (what's popular, and what we took from it)
- **"30-day" challenges** (squat, plank, push-up, abs, burpee) are the most copied format in app stores and
  communities. The good ones grow a little at a time and build in rest: the common plank sheets go from 20 s to minutes
  with rest days on about days 6, 13, 19, 26, and say to split the hold if form breaks
  ([UBC HR plank sheet](https://hr.ubc.ca/health/files/30-Day-Plank-Challenge.pdf),
  [Healthline](https://www.healthline.com/health/exercise-fitness/plank-challenge),
  [Garmin](https://www.garmin.com/en-US/blog/fitness/planking-challenge/)). Leap Fitness' *30 Day Fitness Challenge*
  rests every 4–5 days and reviewers complain of a hard jump around day 10–15 (research.md §5) → we grow **by week**,
  not by day, and cap each week's step at roughly +60 %.
- **Couch to 5K** (NHS): 3 run-walks a week with a rest day between; week 1 is 5 min walk, 8 × (1 min jog, 90 s walk),
  5 min walk ([NHS plan](https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/couch-to-5k-running-plan)).
- **Nike Training Club programs**: 2–8 weeks, about 3 workouts a week, staged difficulty (research.md §5) → Dumbbell,
  Kettlebell, Pull-up and Calisthenics are 3–4 sessions a week, A/B or week-by-week.
- **Fitbit / Samsung Health / Apple Fitness**: step goals, monthly challenges with milestone stars, rest that doesn't
  break the streak (research.md §5) → kept our make-up days, excused days and ¼ ½ ¾ stars for every new challenge.
- **WHO / CDC activity guidelines**: 150 min of moderate cardio a week, strength 2+ days, and for older adults balance
  work too ([WHO](https://www.who.int/initiatives/behealthy/physical-activity),
  [CDC older adults](https://www.cdc.gov/physical-activity-basics/guidelines/older-adults.html)) → Zone 2 28 adds up to
  about 150 min a week; Steady and strong 28 mixes strength, balance and walks.
- **Stair "exercise snacks"** (McMaster, 2019): three short climbs a day improved fitness in sedentary adults
  ([McMaster news](https://news.mcmaster.ca/exercise-snacks-make-fitness-easier-researchers-find-short-bouts-of-stairclimbing-throughout-the-day-can-boost-health/))
  → not added as its own challenge: the app can't see flights climbed, so every day would be a hand tick. Desk 14
  uses the same "small dose, often" idea.
- **Dead hang / first pull-up**: grip gains are well supported, shoulder "cures" aren't; add about 5 s a week, and get
  advice first with a recent shoulder injury ([Fitness Volt review](https://fitnessvolt.com/hanging-for-2-minutes/),
  [Bullbar 30-day pull-up](https://bullbarfit.com/blogs/updates/the-30-day-pull-up-challenge-that-actually-holds-up-build-the-joints-then-build-the-reps))
  → hangs grow 20 → 45 s over four weeks, rest days between for tendons.
- **After birth**: breathing and pelvic floor first, no crunches or spinal flexion early, clearance at the postnatal
  check (about 6 weeks, longer after a C-section), see a pelvic health physio for leaking or doming
  ([NASM](https://blog.nasm.org/progressive-exercises-for-post-pregnancy),
  [Nourish Move Love](https://www.nourishmovelove.com/postpartum-core-exercises/)) → Gentle core after birth.
- **75 Hard vs 75 Soft**: 75 Hard is two 45-minute workouts a day (one outside), 4 L of water, a strict diet, no
  alcohol, a daily photo, and **any slip resets you to day 1**. That reset rule, the all-or-nothing diet and the
  volume are the opposite of what keeps beginners going and can feed an unhealthy relationship with food, so we
  **don't offer 75 Hard**. 75 Soft keeps one workout a day with an active-recovery day, a water goal and "eat well", and
  forgives a missed day ([Garage Gym Reviews](https://www.garagegymreviews.com/what-is-the-75-soft-challenge),
  [Grazia](https://graziadaily.co.uk/life/health-fitness/what-is-75-soft-challenge-rules)) → **Soft 30**: same idea in
  30 days, nothing resets.
- **Not added, on purpose**: *no-sugar / clean-eating* (the app can't check it, and restriction challenges are a poor
  fit for our gentle-eating mode; Soft 30 asks for protein and water instead), *sleep* (no sleep task kind yet; a good
  next one, since the tracker already has sleep), *stairs* (see above), *75 Hard* (see above).

### The 15 new challenges
| Challenge | Level · goal | Days | What a day asks | Why it's in |
|---|---|---|---|---|
| **Squat 30** | Beginner · Strength | 30 | Squats · week 1–4 (36 → 100 squats, wall sit 20 → 45 s, bridges); rest every 4th day | The classic 30-day squat challenge, joint-friendly (no jumps) |
| **Plank 30** | Beginner · Core | 30 | Planks · week 1–4 (3 × 20 → 60 s, side planks, bird dogs); a rest day each week | Most popular core challenge; holds grow by week |
| **Walk to run 28** | Beginner · Cardio | 28 | Run-walk · week 1–4 (8 × 60 s jog → 4 × 3 min), 3 a week | Couch-to-5K's first month |
| **Steady and strong 28** | Beginner · Mobility · 55+ | 28 | Chair squats, wall push-ups, calf raises, step-ups, bird dogs (level 2 from day 15) ×3, 20 min cardio ×2 | WHO/CDC older-adult mix: strength, balance, walking |
| **Desk 14** | Beginner · Mobility | 14 | Desk reset / Desk mover on alternate workdays, weekends off | Office "exercise snacks" |
| **Gentle core after birth** | Beginner · Core · after birth | 28 | Breathing, pelvic floor, pelvic tilts, bridges, clams; then bridge marches, bird dogs, slow dead bugs; 5 days a week | Postnatal-safe core; 4 free misses (newborns) |
| **Glutes 28** | Intermediate · Muscle gain | 28 | Glutes level 1 (weeks 1–2), level 2 (weeks 3–4), 4 a week | Hugely popular "booty" challenge, bodyweight |
| **Burpee 30** | Intermediate · HIIT | 30 | Burpees · week 1–4 (24 half → 50 full), 2 on 1 off | Classic burpee challenge, with a half-burpee start |
| **Dumbbell 28** | Intermediate · Muscle gain | 28 | Dumbbell A / B alternating, 3 a week | One pair of dumbbells at home |
| **Kettlebell 21** | Intermediate · Weight loss | 21 | Kettlebell sessions ×3 a week, 8,000 steps ×2 | Swings for conditioning, walking for the burn |
| **First pull-up 28** | Intermediate · Strength | 28 | Pull-up · week 1–4 (hangs 20 → 45 s, negatives, first pull-ups), 3 a week | Dead-hang and pull-up challenges, tendon-friendly |
| **Zone 2 28** | Intermediate · Cardio | 28 | 30 → 45 min easy cardio, 4 a week | About 150 min a week at talking pace |
| **Soft 30** | Intermediate · Habits | 30 | Workout (6 days) or 7,000 steps (day 7), plus water and protein every day | 75 Soft, without the reset |
| **Calisthenics 28** | Advanced · Muscle gain | 28 | Push and legs / Pull and core, 4 a week | Advanced bodyweight (archer, pistol, L-sit, dragon flag) |
| **Hybrid 28** | Advanced · Cardio | 28 | 3 plan workouts, Burn HIIT, 40 and 60 min easy cardio | Hybrid training: strength and engine together |

Every new challenge: rest days that count as done, 2–4 free misses, make-up days, excused days and milestone stars
(all from the existing `progress()`), and a finisher badge. "Up next" after a finish follows goal and level, e.g. Walk
to run → Zone 2 → Hybrid, Squat 30 → Push-up 30 → Advanced strength.

### Data model and safety (additive)
- New goal tag **Cardio** (in `GoalTag`, `GOALS`, `GOAL_COLOR` → `heart`, same as HIIT). The goal chips on
  `/challenges` are built from `GOALS`, so the chip appears with no UI change (checked in the screenshots).
- New optional fields on `Challenge`: `needs` (home kit: `dumbbell`, `kettlebells`, `pull-up bar`), `impact`
  (running or jumping) and `who` (`'55+'` or `'after birth'`).
- `recommend()`: Cardio joins *lose fat* and *stay fit*; run/endurance concerns lift Cardio; desk concern lifts Desk 14;
  kit you own lifts a challenge (+2), missing kit at home sinks it (−4); `who: '55+'` is picked first at 55+;
  `who: 'after birth'` is picked first after birth and sinks for everyone else; impact challenges sink for heavier
  bodies and at 55+, and drop out of the top picks in pregnancy and after birth (like HIIT and Advanced already did).
- Sessions use only existing exercise ids and start through the same `start(asDay(q), place)`, so the engine still swaps
  what's locked or unsafe for this person (jumps for heavier bodies, planks and crunches up to 12 weeks after birth,
  knee/back concerns, missing kit at home).

### Self-checks added (`selfCheck` in challenges.ts, run by scripts/selfcheck.mjs)
At least 25 challenges, unique ids, unique session names (days tick by title); each level has 4+ and each goal has a
colour and a challenge; per challenge: valid level/goal, all words present, free misses ≤ one per week, kit is known,
**every day has a task list** with known task kinds and sane numbers, every session is a known one and its kit is
listed in `needs`, 3+ task days in every full week, and training challenges keep a rest day each week (≤ 6 in a row).
Progressions grow every week by no more than 60–70 % (squats, plank holds, jog time, burpees, hangs). The after-birth,
55+ and desk sessions contain no planks, crunches or jumps. Auto-tick: a plank day ticks from its session; a Soft 30 day
needs workout, water and protein. Picks: after birth → Gentle core in the top 3 and no impact/HIIT/Advanced in the top
6; 64-year-old → Steady and strong first; home without a bar → no pull-up first, with a bar → it's first; a new runner
→ Walk to run.

### Screenshots (`/tmp/claude-0/shots/challenges2/`, 390 px)
`cat-older-light.png`, `cat-older-dark.png` (55+ → Steady and strong picked), `cat-postnatal-light.png` (after birth →
Gentle core picked), `cat-cardio-light.png`, `cat-cardio-dark.png` (new Cardio chip), `cat-beg-light.png`,
`cat-int-light.png`, `cat-int-dark.png`, `cat-adv-light.png`, `cat-adv-dark.png`, `det-postnatal-light.png`,
`det-postnatal-dark.png`, `det-walkrun-light.png`, `det-soft-dark.png`. Seeds: `older.json`, `postnatal.json`;
helper `shot.cjs` adds `--first "text"` (exact, first match) so a chip is clicked rather than a row pill.

### Left open (UI owned elsewhere)
- The detail hero shows a *Gym* pill only for `gear: 'gym'`; a pill for `needs` (Dumbbells / Kettlebell / Pull-up bar)
  and a small "55+" / "After birth" tag would help people choose. The kit is named in each tagline/why for now.
- Cardio and HIIT chips share the heart colour.
- On a catalogue row, a long goal pill (e.g. "Weight loss" next to "Intermediate · 21 days") wraps to a second line.
