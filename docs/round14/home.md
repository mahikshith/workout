# Round 14: Home, the tab bar, Plans and Workouts

## What was wrong (seen on screen at 393 x 851)

Home opened with a workout, a row of "Not today?" chips, a five-row Get started list, three ring cards, a challenge
pane, a week strip and a quote, all the same weight. Plans were nowhere on it. The centre button started a workout at
once, and plans and challenges were two taps deep inside Train.

## The tab bar

`Home · Progress · (Workouts) · Fuel · Plans` (`app/(tabs)/_layout.tsx`).

- **Workouts** is the raised centre button (file `train.tsx`, route `/train`): today's workout in one row with Start,
  short sessions, the muscle grid and search over every exercise and plan. While a workout runs the centre shows its
  clock and returns to it.
- **Plans** is new (`plans.tsx`), at the right end beside Fuel. Two segments:
  - *Plans*: "Doing now" (your plan with this week's progress and Start, and your challenge), "Recommended for you"
    (the engine's best fits with one reason each), then every plan by kind with a Gym / Home / Office filter.
  - *Challenges*: the full challenges catalogue (`ChallengesBody` from `app/challenges.tsx`; the `/challenges` route
    still works for deep links). `?tab=challenges` opens this segment.
- The bar itself is the glass `TabBarSurface` from `src/glass.tsx`.

## Home, top to bottom

1. Header: date and streak, greeting, **+ Log**, avatar (unchanged).
2. **Recommended for you**: today's workout, its muscles, two short reasons from the engine, Start and Change.
   "Can't train today?" is one quiet line that unfolds the Sick / Travelling / Rest chips only when tapped.
3. **Today**: the three rings in one card (was three cards).
4. **Plans for you**: a sideways row, your plan first, then the best fits, each with one reason; "All plans" opens the
   Plans tab.
5. Your challenge (or one picked for you), the tracker pane, and **Get started** folded to one row (progress ring and
   the next step) that opens in place.
6. This week (opens the calendar), one coach line, and at most one note that needs a decision.

Nothing was removed: the Get started steps, excuse chips, tracker pane, challenge pane, week strip, coach line and
notes are all still there, folded or moved lower.

## Muscle tiles

Owner's note: the muscle icons in the exercise section were too small. Each tile now shows a close-up
(`MuscleZoom` in `src/body.tsx`): the body drawing cropped to a square window around that muscle group, 84 px, on the
side that shows it best. Windows were measured from the outlines' bounding boxes.

## Colour: each place has its own mood

Owner's note: the app read as monochrome, every screen the same. Each tab now has its own soft background glow
(`Ambient` colours, `Screen tone=`) from the domain colours: Home green and teal, Progress amber and indigo, Workouts
teal and red, Fuel orange, blue and pink, Plans indigo and amber. Plan cards carry a wash of their kind's colour
(muscle teal, fat loss orange, cardio red, recovery indigo...), short sessions take turns through the domain colours,
and the "today" and "doing now" cards use the same tinted gradient as Home's recommendation. Text stays on solid
cards, so contrast is unchanged.
