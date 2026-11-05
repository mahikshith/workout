# Round 10 build brief (for every screen agent)

Read first: `docs/REDESIGN.md` (the approved plan: tabs, navigation rules, screen specs, motion table),
`docs/DESIGN.md` (type scale, spacing, colours), and the clickable prototype source `docs/prototype.dc.html`
(HTML; shows the intended look and flow of each screen — match it in React Native).

Foundation already in place (do not rewrite, reuse):
- `src/kit.tsx`: `Header` (every pushed screen uses it), `Segmented` (the only segmented control),
  `CountUp`, `useElapsed`, `useToday()` (today's workout + one-tap `start()`), `MiniBar`, `Empty`, `DoorCard`,
  `goBack`, easing constants `EASE`, `EASE_FILL`, `EASE_POP`.
- `src/ui.tsx`: `Tap` (press scale + haptic), `T` (type scale), `Section`, `Card`, `Tile`, `ListRow`, `Button`,
  `Chip`, `Ring`, `Demo` (exercise animation/photo/video, keep using it), `Thumb`, `Stepper`, `Row`, `haptic`.
- `src/sheet.tsx`: `Sheet` (spring up, drag down to close). Actions go in sheets.
- `src/rings.tsx`, `src/charts.tsx`, `src/body.tsx` (MuscleMap), `src/medals.tsx`, `src/journey.tsx`: keep.
- `src/store.ts`: Start opens the workout ready (look first); the clock starts on its Start workout button (`begin()`). `active.idx` is the exercise on screen and
  `active.restUntil/restTotal` the rest timer, via `setIdx` and `setRest` (the mini bar reads them).
- `src/tracker.ts`: watch data (`useTracker`, `latest`, `sleepScore`).
- Tabs (`app/(tabs)/_layout.tsx`): Today (`index`), Train (`train`), centre Start, Progress, Fuel. `You` is now a
  pushed screen at `app/you.tsx` (opened by `Avatar` from `src/ui.tsx`). The old Exercises tab is gone; the library
  lives inside Train.

Hard rules:
1. Edit only the files your task owns. If you need a change elsewhere, say so in your report instead.
2. Max depth 2 below a tab; actions in `Sheet`s; never two sheets at once; pushed screens use `Header`.
3. One primary button per screen. Every number has one home (see REDESIGN.md); elsewhere only a glance that links.
4. `c.accent` changes at runtime: read it in inline styles only, never inside `StyleSheet.create`.
5. Animate only `transform` and `opacity` with Reanimated; respect `useReducedMotion()`; timings from the motion
   table in REDESIGN.md section 3. Entrance: `FadeInDown`/`FadeIn` with `EASE`, staggered 50-80 ms, max ~6 items.
6. Lists of more than ~20 rows use `FlatList`/`FlashList`-style virtualisation (`FlatList` is fine), never a big map
   inside a ScrollView. Select narrow store slices (`useStore((s) => s.x)`), never `useStore()` whole.
7. Must run on web too (we verify in a browser): guard native-only APIs with `Platform.OS`.
8. Keep all existing features reachable (nothing silently dropped). If something moves, it gets one new home.
9. Copy: sentence case, short, no exclamation marks, no paragraphs on cards.
10. Run `npx tsc --noEmit` before you finish. Fix every error in your files; other agents are editing other files at
    the same time, so ignore errors that are only in files you don't own. No new npm dependencies.
11. Do not commit or push. Report: files changed, what moved where, anything you couldn't do, and the exact
    journeys a tester should click through (with expected results) to verify your screens.
