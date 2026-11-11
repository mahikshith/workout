# Round 14: the recommendation engine

One place decides what the app suggests: which plan, which session today, which exercise for a muscle, and why.
It lives in `src/reco/`. The core is plain TypeScript with no React and no storage, so it runs in Node and is
checked by `scripts/selfcheck.mjs`. Screens reach it through one hook, `useReco()`.

## What changed for the person

- Nine goals instead of four: lose fat, build muscle, get stronger, stay fit, tone up, gain weight, build stamina
  (`endurance`), move better (`mobility`), sport fitness (`athletic`).
- Three new plans, added only where no existing plan honestly matched a goal: Move Better (`move-better`),
  Sport Ready (`sport-ready`), Home Stamina (`home-stamina`).
- Height and weight now matter: a BMI band shapes the plan pick, the exercises and the impact rules.
- Logged workouts matter: recovery per muscle, push/pull and upper/lower balance, what the person is getting
  better at, and how many of their planned days they actually do.
- Every suggestion carries short reasons in plain words. No two plan cards lead with the same line.

## Files

| File | What it holds |
| --- | --- |
| `src/reco/model.ts` | `Person`: everything the engine knows about someone, built once from profile, sessions, check-ins and watch data |
| `src/reco/traits.ts` | What each exercise is: kind, movement pattern, hardness, impact, staple, odd, risky |
| `src/reco/score.ts` | Scores an exercise for a person, with reasons; hard rules for what is never suggested |
| `src/reco/plans.ts` | Ranks every plan for a person with a fit from 0 to 100 and reasons; groups them for a list |
| `src/reco/session.ts` | Builds a session for today; looks at a plan day and offers lighter or swapped versions |
| `src/reco/index.ts` | `recommend(person)`: today, plans, exercises for a muscle, what to do instead; the scenario matrix |
| `src/reco/use.ts` | `usePerson()`, `useReco()`: memoised hooks over the store |
| `src/planner.ts` | The plan scorer the ranking builds on (goal, level, BMI band, joints, history) |

## The model: `Person`

`buildPerson(input)` turns raw data into the facts every decision uses.

| Input | Where it comes from | What the engine derives |
| --- | --- | --- |
| Height, weight | profile | BMI and a band: under (<18.5), healthy, over (25+), heavy (30+), very heavy (35+) |
| Age | profile | teen (<18), adult, mid (40-54), senior (55+) |
| Level | profile + history | 0 beginner, 1 intermediate, 2 advanced. Enough logged sessions move a person up one step (`levelWhy` says so); four idle weeks mark them rusty |
| Goal | profile | one of nine |
| Place, gear | profile | gym, home with gear, home with nothing (`noKit`), office |
| Concerns | profile | knee, back, posture, tone, running, flexibility |
| Life stage | profile | pregnant, first weeks after birth, office-only |
| Sessions | store | sets per muscle over 7 and 14 days, when each muscle was last worked and how hard, balance (push/pull, upper/lower, front/back), per-exercise progress or stall, plan history |
| Check-in, watch | store, tracker | readiness 0-100 with a level (high, mid, low), a source (watch or estimate) and a sentence |
| Plan, next day | store | adherence: planned days against done days |

Low impact (`lowImpact`) is true during pregnancy, in the first 12 weeks after birth, with a knee concern, in a
heavy or very heavy BMI band, from 65 (from 55 unless advanced) and while coming back from an injury. It removes jumping and running from everything the engine suggests, and
`lowImpactWhy` gives the sentence shown to the person.

### Recovery

`recovery(person, muscle)` returns how recovered a muscle is (`pct` 0-1) and the hours left.

- Base: 48 hours.
- Times a volume factor from the sets in that muscle's last session (0.5 for a few sets, up to 1.5 for many).
- Longer for beginners, for 40+ and 55+, and on a low-readiness day; shorter for small muscles (arms, calves, core).
- A muscle at `FRESH` (0.85) or more may be a session's focus. Below that it is not, and the reason says so:
  "Chest and shoulders worked hard yesterday, so they rest today".

## Scoring an exercise

`scoreExercise(person, e, target?)` starts at 40, adds the factors below and clamps to 0-100.

| Factor | Effect | Reason shown (when it is one of the top two) |
| --- | --- | --- |
| Matches the target muscle | +12; helper only -6; neither -20 | |
| Matches the target movement | +8, else -4 | |
| Tried and tested basic | +14 | "A tried and tested basic" (lowest rank, only when nothing personal applies) |
| Odd or awkward move | -14 | |
| Has a picture | +2 | |
| Goal: big multi-joint lift | per goal, +2 to +10 | "Big lifts add the most size", and similar per goal |
| Goal: barbell, free weight, guided, body weight, one side, holds | per goal, -4 to +6 | "No equipment to set up", "One side at a time, for balance", "A steady hold that builds control" |
| Beginner | easy +6, guided +5, barbell -2 to -6 | "Guided, so it is easy to learn" |
| Advanced | harder +5, barbell +3 | "A harder move to match your experience" |
| Heavy BMI band | supported +6, own body weight -10, eased version +5 | "Supported, easy on your joints", "A lighter version that suits you now" |
| Senior | supported +5, heavy overhead barbell -6 | "Steady and supported" |
| Knee, back, posture | +4 to +5, risky patterns -8 | "Easy on your knees", "Kind to your back", "Strengthens the muscles that hold you upright" |
| Balance | lagging side +4 to +6 | "Evens out your pushing and pulling", "Your legs have had less work lately" |
| History | getting better +8, known +4, stalled -4, done in the last 40 hours -10 | "You are getting better at this one", "You know this one" |
| Cardio | by goal: steady for stamina, bursts for fat loss and sport; smooth for low impact +10 | "Steady work builds stamina", "No pounding on your joints" |
| Mobility | undoes sitting +4, gentle for a sore back +3 | "Undoes hours of sitting" |

Hard rules, `blocked(person, e)`. A blocked exercise is never suggested and the function returns the reason:

- Needs equipment the person does not have, or a gym when they train at home.
- Not a move for the office, for someone who trains only at their desk.
- Hidden or not yet open under the safety rules in `src/engine.ts` (pregnancy, after birth, knee, back, first sessions).
- Too hard for the level: a beginner gets no expert moves (hardness 2), and harder moves (hardness 1) only after six
  sessions; an intermediate gets no expert moves.
- High impact while `lowImpact` is true.
- Very heavy straining lifts for under-18s and 55+ (unless advanced), and for anyone with a back concern.
- Positions that bother many shoulders and backs, unless the person is advanced.
- Pull-ups, dips, burpees and the like in a heavy BMI band; supported versions are offered instead.

## How reasons are produced

Every factor is `[points, reason?, rank?]`. Points decide the score; the rank decides which reasons are shown.

1. The first reason is always what the exercise does: "Works your chest, with your shoulders and triceps helping".
2. Then the two highest-ranked personal reasons with positive points:
   history 90, body 80, balance 70, level 60, goal 50, basic 5.
3. Duplicates are dropped. Wording uses everyday words; the checks reject jargon such as 1RM, RPE or hypertrophy.

Plans work the same way in `src/planner.ts`. Each plan also carries a signature, the one line no other plan
shares ("Whole body every session", "Three big lifts a session"). `rankPlans` puts it first, so two cards never
read the same. `explain(profile, planId)` keeps "Fits your N days" first and the signature second; no signature
contains the word "days", so a screen that skips the days line lands on the signature.

## Ranking plans

`rankPlans(person)` returns every plan once, best first.

- Fit = clamp(42 + 0.55 x planner score), 0-100. The pick is at least 80 and at least one point above the next.
- The pick is exactly what `planFor(profile)` returns, so onboarding, Home and the Plans tab agree.
- Main plans are fitted to the person's days (`planId` is the fitted id, such as `ppl-gym~4`).
- A plan that cannot be offered is still listed with `suitable: false` and a `caution`: "Needs a gym",
  "Made for women", "For experienced lifters", "Too many of its moves are paused for you right now".

What moves the planner score:

| Input | Effect |
| --- | --- |
| Goal | Plans tagged for the goal and in the goal's category lead. Growing goals (muscle, strength, gain weight) push cardio plans down; stamina pushes lifting plans down; mobility never gets a muscle or strength plan |
| Level | Beginner plans for beginners (a lower-volume first weeks version when fitted), harder splits for intermediate and advanced |
| Days | Exact for fitted plans; a mismatch costs 20 points a day |
| Place and gear | Home plans for home; "No equipment needed" and "Uses your dumbbells" |
| BMI band | Under: lifting plans up, cardio down. Heavy and very heavy: low-impact plans up, jump-heavy plans down 30 |
| Age | 55+: whole-body strength plans up ("Keeps muscle and bone strong") |
| Knee, back | Plans with many paused moves drop out; gentle plans say "Kind to your back" |
| History | A plan the person finished weeks of keeps a small edge; one they dropped quickly loses a little |

`planGroups(person)` gives the Plans tab its sections: "Best for you" (the pick, up to three more with fit 60+,
one add-on day), then categories with the goal's own first (home first for home users), then
"Not for you right now".

## Building a session

`suggestSession(person, opts)` builds a workout for today when there is no plan, or as "something else".

1. Kind of day: recovery on a low-readiness day; mobility for the mobility goal; cardio-led for stamina;
   strength otherwise, with a cardio finisher for fat loss, tone up, stay fit and sport.
2. Shape: full body for beginners and for 3 days or fewer; otherwise upper or lower, picking the half that is
   more recovered and has had less work.
3. Areas (chest, back, quads, back of legs, shoulders, core, arms, calves) are ordered by
   weight + 0.6 x how far behind this week's sets are + the goal's lean + balance. Areas not yet recovered are
   left out.
4. For each area the best-scoring exercise is taken, never repeating a movement.
5. Sets, reps and rest come from the goal:

| Goal | Big lift | Smaller move |
| --- | --- | --- |
| Build muscle | 4 x 8-10, 90 s | 3 x 10-12, 60 s |
| Gain weight | 4 x 6-10, 120 s | 3 x 10-12, 75 s |
| Get stronger | 4 x 5, 180 s | 3 x 8-10, 90 s |
| Tone up, lose fat | 3 x 12-15, 60 s | 3 x 12-15, 45 s |
| Stay fit | 3 x 10-12, 75 s | 2 x 12-15, 60 s |
| Stamina | 3 x 15-20, 45 s | 2 x 15-20, 40 s |
| Move better | 2 x 10-12, 60 s | 2 x 12, 45 s |
| Sport | 4 x 6-8, 120 s | 3 x 10-12, 60 s |

   Beginners and rusty people do one set fewer; a low-readiness day does too.
6. The session is trimmed to the minutes available (`opts.minutes`, else by level).

`adjustDay(person, day)` looks at a plan day and only reports: muscles still recovering, moves that need a
stand-in, a tired day. It offers `lighter` and `swapped` versions; the plan is never changed on its own.

## API for screens

```ts
// src/reco/use.ts
usePerson(opts?: { planId?: string | null }): Person
useReco(opts?: { planId?: string | null }): Recommendation   // planId: null asks "what if I had no plan?"

// src/reco/index.ts
buildPerson(input: RecoInput): Person
recommend(person: Person): Recommendation
recommendFor(input: RecoInput): Recommendation
rankPlans(person: Person): RankedPlan[]
planGroups(person: Person): PlanGroup[]
suggestSession(person: Person, opts?: SessionOpts): SessionIdea
adjustDay(person: Person, day: Day): Adjusted
exercisesFor(person: Person, muscle: string, n?: number): Scored[]
rankExercises(person: Person, target?: Target, n?: number, exclude?: Iterable<string>): Scored[]
scoreExercise(person: Person, e: Exercise, target?: Target): Scored
explainExercise(person: Person, exId: string): Explained
blocked(person: Person, e: Exercise): string | null
muscleStates(person: Person): MuscleState[]
recovery(person: Person, muscle: string): Recovery
```

```ts
type Recommendation = {
  person: Person;
  today: Today;                 // kind, day, title, minutes, planId?, dayIndex?, why[], adjust[], lighter
  plans: RankedPlan[];          // every plan, best first
  groups: PlanGroup[];          // "Best for you", then by category
  exercisesFor: (muscle: string, n?: number) => Scored[];
  nextBest: { session: SessionIdea; plan: RankedPlan | null; muscles: MuscleState[] };
};
type RankedPlan = { plan; planId; baseId; fit; reasons; category; days; suitable; caution; pick; addOn };
type SessionIdea = { day; kind; focus; muscles; minutes; why; picks: { slot; reasons }[] };
type Scored = { ex: Exercise; score: number; reasons: string[] };
type Explained = { ok: boolean; fit: number; reasons: string[]; caution: string | null; instead: Scored[] };
```

How to use it:

- Home: `const { today } = useReco()`. With a plan, `today` is the same day `useToday()` starts
  (`today.planId`, `today.dayIndex`); without one it is a built session (`kind: 'suggested'`). Show `today.why`.
  Offer `today.lighter` when it is not null, and `nextBest.session` as "something else".
- Plans tab: `groups` for sections; on each card `fit` as a percentage and `reasons[0]` as the line. Start
  `planId`, not `baseId`.
- Exercise picker and swap: `exercisesFor(muscle, n)`; each item has its reasons.
- Exercise page: `explainExercise(person, id)` says whether it suits the person and what to do instead.
- Existing calls still work with the same signatures: `planFor`, `explain`, `scorePlan`, `ranked`, `useToday`.
  `ranked(profile)` now delegates to `rankPlans`.

`nextBest.session` is computed on first read, so a screen that never shows it does not pay for it.

## Checks

`node --experimental-strip-types --no-warnings scripts/selfcheck.mjs` runs each module's `selfCheck()`.

The planner grid covers 2,025 profiles over the nine goals. The engine matrix in `src/reco/index.ts` builds
3,375 people: goal (9) x level (3) x place (gym, home with nothing, home with dumbbells and bands, both, office)
x person (man, woman, 62 years old, 112 kg, knee and back, pregnant) x days a week (2 to 6 for the man, 3 and 5
for the others), each with and without a week of logged workouts (legs trained hard yesterday). For every one it
asserts:

- a plan is always returned, and it has the days the person asked for;
- no exercise needs equipment the person does not have;
- no exercise hidden by the safety filters appears, and no jumping when low impact applies;
- a muscle trained hard yesterday is not today's focus;
- beginners never get expert moves;
- every plan, session and exercise has reasons, none empty, none with jargon;
- `rankPlans` covers every plan exactly once, with one pick that matches `planFor`;
- the same input gives the same output twice.

Module checks add specific cases: the pick for each new goal, an intermediate at home with dumbbells on four
days gets an intermediate plan, cards lead with different lines, pregnancy puts the pregnancy plan first and
pauses add-on days, a recovery day never contains fast moves.

`node --experimental-strip-types --no-warnings scripts/reco-people.mjs [filter]` prints the full output for 13
varied people. Read it after any change to the scoring; a table of numbers does not show a silly result, a
printed session does.

## Limits

- The engine reads injuries only from the profile's knee and back concerns. Anything else is not known to it.
- Readiness without a watch is an estimate from the check-in, recent load and rest days.
- BMI is a coarse measure; it shapes impact and exercise choice, never a message about the person's body.
- The matrix adds about 12 seconds to the self-check.
