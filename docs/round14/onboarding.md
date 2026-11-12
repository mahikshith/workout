# Round 14: onboarding on one page

Owner file: `app/onboarding.tsx` (nothing else was touched).

## What changed and why

The first run was six screens (welcome, goal, place, days, plan, name) of four small tiles each, with two thirds of
every screen empty, and height, weight, level and equipment were only reachable through an optional link on the last
step. It is now **one scrolling page**: every question is visible by scrolling, nothing is required, and one pinned
button finishes.

- **Top bar (fixed):** app mark, a thin progress bar with "n of 6 answered" ("Nothing is required" before the first
  answer), and **Skip** at the top right (`skipSetup(true)`, as before).
- **Page:** a short heading, then six titled blocks, 32 px apart.
- **Bottom bar (pinned):** "Show my plan" and a one-line safety note with the "Safety and disclaimer" link. The bar
  hides while the keyboard is up so the field being typed in has the room.
- **Finish** saves exactly as before (`setProfile` with the engine's `planFor` pick, hydration and motivation nudges
  on, `skipSetup(!name)`, reminders rescheduled if permission exists) and lands on Home via `toToday()`. The separate
  "Your plan" step is gone: Home's "Recommended for you" and the plan list replace it.
- **Plan preview kept:** the last row of the page, "Best match so far", shows the engine's live pick for the answers
  so far and opens the full plan page as a preview (same `setSetupFinish` hand-off as before; "Use this plan" there
  finishes setup).
- The welcome screen is folded into the page heading. Its "skip" link is the Skip button.

## Fields (everything the old flow could set, plus level up front)

| Block | Field in `profile` | Control |
| --- | --- | --- |
| What do you want most? | `goal` | two-column boxes from `GOALS` (any count; checked with 4 and 9) |
| How much have you trained? | `level` | three full-width boxes from `LEVELS` |
| Where will you work out? | `place`, `gear` | four boxes; Home or Both opens the `HOME_GEAR` chips inline |
| How many days a week? | `daysPerWeek` | one row of number chips, 2 to 6, with a one-line note for the pick |
| About you | `gender`, `heightCm`, `weightKg`, `age`, `diet` | segmented sex; number boxes with -/+ and type-in, two per row; diet chips |
| What should we call you? | `name` | text field, optional |

`goalWeightKg` is set to the weight on a first setup, as before. On a first run nothing is pre-selected in the goal,
level, place and days blocks: an answer lights up only once picked, and unanswered ones keep the guest defaults.

## Edit and redo on the same page

- **First run** (no name, no `redo`): Skip top right, progress count, "Show my plan".
- **`?redo=1`**: heading "Answer again", back button top left, answers pre-filled, "Show my plan" picks a fresh plan
  and goes to Home.
- **Editing a set-up profile** (has a name, no `redo`): heading "Your answers", back top left, Save top right and
  "Save changes" pinned; the current plan is kept and the screen goes back.
- **`?step=`** scrolls to a block instead of opening a step: `goal`, `level`, `place`, `days`, `about`, `name`.
  Unknown values (the old `plan`, `welcome`) open at the top.
- **Android back**: on a first run the system handles it (as the old first step did); otherwise it leaves without
  saving.
- **Keyboard**: iOS pads the view; focusing a number or the name scrolls its block to the top, and the pinned bar
  steps aside until the keyboard closes. Dragging the page dismisses the keyboard.
- **Motion**: blocks rise in with a 60 ms stagger, picked boxes fill with the accent (opacity and scale only), the
  level tick pops in, the gear panel fades in. All off with reduced motion.

## Checked

Playwright at 393 x 851 and 360 x 740, light and dark: top, middle and bottom of the page with the gear panel open;
finish lands on `/` with goal, level, place, gear, days, height, weight, age, sex, diet and name saved; Skip; the
button with nothing answered (defaults, `setupSkipped` true); edit with `?step=about|days|place` (plan kept); redo
(new plan); plan preview and "Use this plan". `npx tsc --noEmit` is clean for the file.
