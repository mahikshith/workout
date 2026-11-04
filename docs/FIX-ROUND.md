# Round 10 fix round (after browser click-through + code review)

Read `docs/BUILD-BRIEF.md` (hard rules still apply: edit only your files, no new deps, `npx tsc --noEmit` clean,
do not commit) and the relevant parts of `docs/REDESIGN.md`. Screenshots of the current state:
`/tmp/claude-0/-home-claude-workout/ecf4cab3-2df7-5d0f-aa3e-5f277cbefe1f/scratchpad/verify/shots/` (named in each item).

Already fixed, do not redo: `openWorkout()` / `toToday()` in `src/kit.tsx` (use them for every "open the workout" and
"back to Today"), Header + Empty on missing plan/exercise/summary, session no-workout redirect, Train place follows
profile.place.

Note on motion findings: the web build uses a JS stack with no push animation; native Android uses native-stack
`slide_from_right`. Do not try to make web push/pop animate; just keep native config correct.

## Agent 1: flow and workout logic
Owns: `src/store.ts`, `src/engine.ts`, `src/calc.ts`, `src/coach.ts`, `src/data/**`, `app/session.tsx`,
`app/summary.tsx`, `app/onboarding.tsx`, `app/plan/[id].tsx`, `src/journey.ts(x)`.
1. Onboarding is 5 taps; spec is 4. Remove the extra "Let's go" step at the bottom of the long plan page: "Start this
   plan" on the welcome plan view should finish setup and go to Today (`toToday`). Keep the welcome plan view
   reachable but the commit button must be visible without scrolling (sticky bottom). Shots `1-06-*`.
2. Picking "4 days" gives a 3-day plan (Full Body Foundations) and Today's ring says 0/4 against it. The suggested
   plan must match days picked, or the weekly target must equal the plan's days. Shots `1-04-days-4.png`, `2-02-*`.
3. Workout opens Goblet Squat with 2 sets while plan week 1 says 3 x 10. Sets in the session must match the plan's
   week/phase for that day. Shots `4-13-*`, `3-02-*`.
4. First workout: kg starts at 0 so Summary shows Volume 0 kg. Give a sensible starting weight suggestion (bodyweight
   moves count reps; weighted moves get a starter kg from profile/level) and show "Last time" when history exists.
5. Next workout after Full Body A shows "Mobility Flow", which is not in the plan; plan says next is Full Body B. The
   "next" suggestion must follow the plan's own day order. Shots `3-23-Done.png`, `4-01-*`.
6. Double-tapping the set check quickly un-logs the set but the rest timer keeps running. Ignore a second toggle within
   ~400 ms, and un-logging a set must cancel the rest it started (`setRest(null)`, `restAlert(null)`). Shot `9-05-*`.
7. Rest-day sheet (REDESIGN): when today is a rest day, Start opens a Sheet with Train anyway / Quick 20 min / Pick
   exercises instead of starting. `quickFor` quick sessions and the `cardioFor` cardio ladder need an entry point there.
   Expose it from the store or a small helper so `useToday().start` (in kit, Agent 2) can open it; coordinate by
   exporting e.g. `restDayOptions()` and a `RestDaySheet` component in a NEW file `src/restday.tsx` that you own.
8. Inside the workout, "Add exercise" must open a picker Sheet (reuse FoodPicker-style pattern) instead of pushing
   /library over the workout. Summary: `COLORS` captures `c.accent` at module load (read at render). Session
   re-renders every 250 ms: limit the ticking to the clock/rest components.
9. Android: swipe down on the session header minimises the workout (gesture, reduced-motion aware).

## Agent 2: shell, navigation, sheets, motion
Owns: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `src/kit.tsx`, `src/sheet.tsx`, `src/ui.tsx`, new `app/+not-found.tsx`.
1. Centre button while running: "Resume" + time, e.g. "Resume 12:34" (fits in the circle: two lines small). Shot `3-05-*`.
2. Mini bar must show on pushed screens too (plan, exercise, chart, history, library, food, you...), not only tabs:
   render it once at the root (`app/_layout.tsx`) above content, positioned above the tab bar on tabs and at the
   bottom safe area on pushed screens; hidden on session/summary/onboarding. Export a hook/const so screens can pad
   their bottom (e.g. `useMiniBarSpace()`), and tell me which screens need padding. Shots `4-15-*`.
3. Banners flush against the mini bar: leave 8 px gap; screens' bottom padding must include the bar. Shot `3-05-*`.
4. Tapping the current tab must scroll to top: make `Screen` in ui.tsx use `useScrollToTop` with its ScrollView ref
   (and export a helper for FlatList screens). Shot `8-04-*`.
5. Web: browser back with a sheet open navigates away. Make an open Sheet close on back instead (web: push a history
   state on open and listen to popstate, guarded with Platform.OS === 'web'; Android: onRequestClose already).
6. Sheet first frame draws at y=829 then jumps to 878: start fully off-screen before the first layout (hide with
   opacity 0 until `onLayout` has measured, then spring).
7. Tab switch rises ~11 px, spec 4 px: fix the tab transition (custom `sceneStyleInterpolator` with 4 px rise or
   plain fade).
8. Tab bar accessibility: `accessibilityRole="tab"`, `accessibilityState={{selected}}`, labels; centre button label
   "Start workout"/"Resume workout". `Tap` should pass through accessibility props.
9. Unknown routes show Expo's "Unmatched Route": add an app-styled `app/+not-found.tsx` (Header + Empty, Back to Today).
10. `useToday().start`: when today is a rest day, open the rest-day sheet from `src/restday.tsx` (Agent 1 creates it;
    if it doesn't exist yet when you finish, leave a clear TODO and tell me). Reduced motion in `Segmented` and `Tap`.
11. Stack: session opens with `slide_from_bottom`; check push/pop config is `slide_from_right` with gestures on
    Android (native-stack), and summary/onboarding fade.

## Agent 3: Train area
Owns: `app/(tabs)/train.tsx`, `app/library.tsx`, `app/exercise/[id].tsx`, `src/body.tsx`, `src/figure.tsx`.
1. "Leg Day · 1 days": pluralise everywhere in your files.
2. With place Home, muscle tiles showing "0 moves" lead nowhere: hide or disable them. Shot `7-14-*`.
3. Muscle page chip rows clipped at the right edge ("Expert", "Low..."): make them horizontally scrollable with
   proper end padding or wrap. Shot `4-08-*`.
4. Exercise page: the fixed "Respect the ambition" lock card covers the bottom of the content. Make it inline or pad
   the scroll content by its height. Copy: no paragraphs on cards (exercise/[id].tsx ~188-191). Shot `4-04-*-f3.png`.
5. Place switches in Train, Library and Exercise must follow `profile.place` (one home: profile). Library details from
   the library should open the exercise page normally (that's a place), fine; but Train's Start uses today's
   suggestion via `useToday().start` / `openWorkout`.
6. Train is a long screen: if it is a ScrollView built from `Screen`, scroll-to-top comes from Agent 2; if it is your
   own ScrollView/FlatList, add `useScrollToTop(ref)` yourself. Same for library.
7. Drop `as never` casts on routes in your files where types allow.

## Agent 4: Today, Progress, Fuel, You
Owns: `app/(tabs)/index.tsx`, `app/(tabs)/progress.tsx`, `app/(tabs)/fuel.tsx`, `app/chart/[kind].tsx`,
`app/history.tsx`, `app/food.tsx`, `src/foodsheet.tsx`, `app/you.tsx`, `app/profile.tsx`, `app/watch.tsx`,
`app/reminders.tsx`, `app/etiquette.tsx`, `src/charts.tsx`, `src/rings.tsx`.
1. Fuel never asks diet and silently defaults to vegetarian, so "egg" gives No match. First Fuel visit (or when diet
   unset) shows a one-tap diet choice (Sheet or inline card); search should also show matching foods outside the
   diet under a small "Not in your diet" divider rather than "No match". Shot `6-03-*`.
2. Supplements must live inside the "Tips for you" fold on Fuel, not its own row. Shot `6-01-*`.
3. Progress: "This week 0 min" while Summary said 1 min (round seconds the same way everywhere, use one helper);
   Strength chart says "Finish a workout to see volume" after a workout with bodyweight sets: show reps when volume is
   0. Shot `5-02-*`. Memoise badges/best lift in progress.tsx.
4. About you shows untouched defaults ("Other", 30 y, 170 cm) as if answered: show "Not set" for fields never set.
   Profile weight stepper must log through the weights history (one home for weight) not bypass it.
5. Depth loops: watch tiles -> /chart/body -> /watch loop; break it (chart body links to watch only if not from watch,
   or use back). profile -> onboarding?redo is depth 3: make redo a sheet or a replace.
6. Today: the Body ring opens the body chart, the food ring opens the food sheet. watch.tsx repeats metric tiles that
   live on Today/Progress: keep one home, show glances that link. Streak label wording consistent ("day streak").
7. `LinearTransition` layout animations in history, etiquette, reminders: remove (spec: transform/opacity only).
8. Copy paragraph at watch.tsx ~137: shorten. Drop `as never` route casts in your files where types allow.
9. Export data: add "Export data" in You (JSON of store + tracker via Share on native, download on web).
10. Each tab screen: if not using `Screen` from ui.tsx, add `useScrollToTop(ref)` to its scroll view.
