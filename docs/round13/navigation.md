# Round 13 · Navigation stream

Owner's ask: a general gym-goer gets lost between landing, setup, logging and finishing. Keep it simple, use sheets,
learn from Fitbit / WHOOP, remove no screens, be self-critical.

Files: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx` (Today), `app/onboarding.tsx`, `app/you.tsx`,
`src/restday.tsx`, new `src/quicklog.tsx`, new `src/hint.tsx`. `app/profile.tsx` was checked and needed no change.

## 1. Walkthrough of the old journey (harsh critique)

Walked on web at 390 px with localStorage cleared (`before-*.png`).

First launch
- Drops you straight into "What do you want most?" with no idea what the app is or how long setup takes.
- "Stay healthy" is already highlighted before you've answered (the guest default looks like your answer). Same for
  place and days. A beginner thinks they already picked something.
- "Skip" in the corner with no hint of what you lose.
- Plan step has two exits: "Start this plan" and "Add your details first". The second sounds required.
- The notification permission prompt pops at the end of setup with no context (before you ever asked for a reminder),
  and a 6 pm workout reminder was created silently.
- No step count: the bar is the only clue to how long this is.

Today
- After finishing setup without a name, the bottom of Today says "Finish setting up your plan · 1 min", which contradicts
  what you just did.
- No way to log water, weight, supplements or how you feel from Today. Food was only reachable by tapping the Protein
  ring (a hidden action).
- The streak pill reads "Start a streak" and goes to the calendar; the week strip (the obvious calendar) is not tappable.
- "Add watch" ring, plus (now) the tracker pane, plus a checklist would ask three times for the same thing.
- All-caps labels ("WED, NOV 11", "UP NEXT") are louder than the content.
- No first-steps guidance at all: a new user sees a workout card and three empty rings, and nothing says "here is what
  to do next" beyond Start.

Start workout: fine as a flow (the workout stream owns it), but Start from the tab bar and Start on the hero are the same
action with two looks; kept, since the centre button is the app's signature.

Fuel: opens with "How do you eat?" chips above your totals (fuel stream owns it).

You
- "You and your plan" mixes the plan, your body, your location and reminders in one list.
- Reminders is a single row buried fourth in that group; water and supplement reminders have no entry at all.
- No path to Challenges, Tracker or Supplements (the new places).
- Section heads are small all-caps labels.

Tab bar: "Today" used a calendar icon while the calendar itself lives elsewhere (Progress / history).

## 2. What changed

### Onboarding (`app/onboarding.tsx`)
Before: goal → place → days → plan (Start) [→ optional about]. After:
**welcome → goal → place → days → plan → name (optional) [→ optional about]**.
- Welcome: "Your gym buddy", one line on what it does ("Tells you what to do today, logs it in a few taps, and shows your
  progress"), three short benefit rows, "4 quick questions, about a minute", **Get started** (the one primary) and
  "I've used gym apps before · skip" (same as the old Skip: lands on Today with defaults).
- Progress: the bar stays and each question gets "Step n of 5 · Your goal" above it, in sentence case.
- Nothing is pre-selected on first launch; an answer lights up only after you pick it (`touched`).
- Back: round back button on every question (from Goal it returns to the welcome), Android back walks the steps.
- Plan step has one action, "Use this plan" (says it moves on, not that it starts a workout).
- Name step: "What should we call you?", optional, CTA becomes "Let's go, Alex"; Skip top right; a quiet link "Add age
  and weight for food targets" leads to the existing About step (gender, age, height, weight, diet: all data kept).
- Permission: no prompt during setup and no silent workout reminder. The phone asks the first time a reminder is turned
  on (Reminders already does that). Hydration and motivation nudges are still switched on as before; they start
  arriving once permission exists. If permission was already granted (redo), the schedule is refreshed.
- Calmer type: name and number inputs use Outfit semibold instead of the display face.

### Today (`app/(tabs)/index.tsx`)
- Header: date (sentence case, short) and the streak in one small line (tap → calendar), title "Hi, Alex" (or "Today"
  without a name), **+ Log** tonal pill, avatar. The old all-caps date and the "Start a streak" pill are gone.
- **Quick log sheet** (`src/quicklog.tsx`, `QuickLogSheet({open,onClose})`): Food (hands over to the existing FoodSheet),
  Water ("+ 250 ml" inline in the person's glass size via `drink()` from the fuel stream's `src/water.ts`, Undo for 4 s, shows ml of goal via `useWater()`), Weight (stepper + Save via
  `logWeight`; hidden in gentle mode; the weigh-in that setup seeds from the default weight is not shown as "logged"),
  Supplements (ticks today's picked ones via `takeSupplement`, "Edit" → /supplements; with none picked, one row →
  /supplements), How do you feel (4 choices → `checkIn`, "Today's workout adjusts to it").
- **Get started card** under the hero: Start your first workout · Connect a watch · Set a workout reminder · Log a meal ·
  Join a challenge (plus "Get a plan made for you" first if setup was skipped). Each row goes to its place (Start, /watch,
  /reminders, the food sheet, /challenges) and ticks itself from real state (sessions, tracker hc/strap/daily data,
  any reminder or supplement reminder on, meals, challenge or past challenge). Progress line "2 of 5 done". Close hides
  it for good (`dismiss('get-started')`); also hidden once all done or after 5 workouts.
  Deviation from PLAN.md: the card sits **under** the hero, not above it. For a brand-new person the hero's Start is the
  one next step; putting a 5-row list above it pushed Start below the fold at 390 px.
- Rings: Training · Protein (or Meals in gentle mode) · Readiness / Sleep / Steps, and now **Water** (litres, from `useWater()`) when there's no
  watch data, instead of the "Add watch" placeholder (the tracker pane and the checklist already offer to connect; a ring you
  can fill yourself in one tap is more useful). Ring numbers use semibold.
- `<ChallengeCard />` and `<TrackerCard />` placed below the rings.
- Week strip is now a card "This week · Calendar ›" and the whole card opens /history.
- Hero label "Up next" in sentence case. Bottom note: "Get a plan made for you" only when setup was skipped and the
  checklist is gone; finishing setup without a name no longer triggers it.
- One-time hint under the header ("Tap Log to add food, water, weight or how you feel"), shown at most twice and only
  when the checklist is not showing.

### Hint (`src/hint.tsx`)
`Hint({ id, text, max = 2, style, icon })` and `useHint(id, max) → { show, dismiss }`. Decides once per mount (so counting
doesn't make it vanish mid-view), calls `seeHint(id)` once per showing mount (guarded against StrictMode double
effects), close button (44 px) sets the count to `max`. Verified: count goes 1 → closed → 2, stays hidden on reload.

### You (`app/you.tsx`)
Profile card, then **Your watch** (Connect a watch / Watch & health → /watch, Tracker → /tracker, Recovery),
**Goals** (Challenges → /challenges, Plan and goal, Where you train), **Reminders** (Workout → /reminders, Meals and
water → /reminders, Supplements → /supplements), **Look and feel** (Theme and colours, Exercise demos, Haptics),
**More** (About you, period log when cycle tracking is on, Gym etiquette, Your data). Group heads are `T h3` in sentence
case; the theme sheet's uppercase labels are h3 too.

### Tab bar (`app/(tabs)/_layout.tsx`)
Labels unchanged (Today · Train · Start · Progress · Fuel). Today's icon is now a house instead of a calendar, so it
doesn't read as "calendar". Android back: every sheet is a `Modal` with `onRequestClose`, so Back closes the sheet first;
tabs use `backBehavior="firstRoute"`; onboarding handles Back per step.

### Rest day / Change sheet (`src/restday.tsx`)
Section labels ("Quick 20 min", plan name, "Different focus") are sentence-case small text instead of all-caps labels.

## 3. Screenshots (`/tmp/claude-0/shots/navigation/`, 390 px; `-dark` = dark theme)
- Before: `before-01-first` … `before-12-progress`
- First launch end to end (light and dark): `first-01-welcome`, `first-02-goal`, `first-03-place`,
  `first-03b-home-gear`, `first-04-days`, `first-05-plan`, `first-06-name`, `first-06b-name-typed`, `first-07-today`,
  `first-08-quicklog`, `first-09-you`
- Skip path: `skip-today`, `skip-today-bottom` (+ dark)
- Today: `today-new`, `today-new-bottom`, `today-vet`, `today-vet-bottom` (+ dark); checklist ticking `tick-food-open`,
  `tick-after-meal`, `tick-challenges`, `tick-dismissed`; hint closed `hint-dismissed`
- Quick log: `quicklog-new`, `quicklog-vet`, `quicklog-vet-water`, `quicklog-vet-mood` (+ dark), Food hand-off
  `quicklog-food`
- You: `you-top`, `you-bottom` (+ dark); Change sheet `change-sheet-dark`; redo setup `redo-goal`

## 4. Not verified
- Native only: Android hardware Back on sheets and onboarding, haptics, the notification permission prompt now coming
  from Reminders instead of setup, `autoFocus` on the name field (off on web).

## 5. Hurdles and choices
- A `?? []` inside a zustand selector made a new array each render and looped; fixed with a stable empty list.
- `src/store.ts` seeds a weigh-in from the default profile weight on first setup, so Quick log would have said
  "Logged today: 70 kg" for someone who never weighed in. Rather than touch the store, Quick log only trusts a weigh-in
  once there are two, or the weight was set by hand (`set:weightKg`), and marks that key when you save.
- "Skip" for experienced users keeps the old behaviour (Today with defaults) instead of a new path; the Get started card
  then leads with "Get a plan made for you".
- Removed the automatic 6 pm workout reminder in setup: without the permission prompt it would be a reminder that never
  fires, and the checklist's "Set a workout reminder" now does it with consent.
