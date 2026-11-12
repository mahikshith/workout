# Round 14 summary (11 Nov 2026)

The round 13 build "felt off". We looked at every screen at phone size first, agreed, and reworked the first run,
Home, the tab bar, the recommendation engine, the exercise demos, watch data and the overall feel. No feature was
removed. Details per stream are in this folder.

| Area | What changed | Notes |
| --- | --- | --- |
| First run | One scrolling page: goal (9 choices), level, where and equipment, days, sex, age, height, weight, diet, name. Skip at the top, one button at the bottom. | `onboarding.md` |
| Home | One calm column: recommended workout with two reasons, today's rings in one card, plans for you, your challenge, the rest folded lower. | `home.md` |
| Tab bar | Home · Progress · Workouts (centre) · Fuel · Plans. Glass bar; a liquid drop flows to the selected tab. | `home.md`, `fluid.md` |
| Plans tab | Doing now (plan and challenge), recommended plans with a match score, every plan by kind, every challenge. | `home.md` |
| Workouts tab | Today's workout, short sessions, close-up muscle tiles, search. The place chip swaps gym, home, both, office. | `home.md` |
| Engine | `src/reco/`: a person model (height, weight, level, equipment, history, recovery, readiness), exercise scoring, plan ranking with reasons, a built session when there is no plan day. 3,375 test people in the self-check. | `engine.md` |
| Demos | 106 animated figures corrected (seated shown standing and the reverse), posture check in the self-check. Drawings redrawn at an even line weight, visible in light and dark, bundled for offline use. | `demos.md` |
| Watch data | Calories and heart rate attached to every logged workout (watch, heart rate formula, or estimate, labelled), per exercise split, calories per day on the calendar. Watch screens fixed in light and dark. | `wearables.md` |
| Feel | One motion system (springs), glass on floating layers, soft depth on cards, sheets that follow the finger, a colour mood per tab, tinted gradient cards. | `fluid.md` |

## Not verified on a real phone

Everything was checked in the web build at 393 x 851 in light and dark, plus the Node self-checks. Still to confirm on
Android: Health Connect calorie reads, the strap recording, native screen transitions, shadows under glass, scroll
speed with shadows, "Real glass blur" (You, off by default), drawings in long lists on a slow phone, and the app size
(the bundled drawings add about 6 MB compressed).

## Parked for later

- 3D anatomy-style exercise animation (owner's idea): test on two exercises with an openly licensed muscle model.
- `src/journey.tsx` still uses its older calorie estimate; point it at `energyOf` for one number everywhere.
- `app/recovery.tsx` zone and sleep-stage colours are hard-coded rather than domain tokens.

## Added after the PR opened

- Workout screen: the clock in the header counts the whole workout, so it keeps running from one exercise to the
  next. It now says "WHOLE WORKOUT" under the time. The "i" button beside the exercise name is a labelled
  "How to do it" button.
- 3D view: Bodyweight Squat and Butterfly have a "3D" view in the demo switch. The figure is our own, made in code,
  so it needs no credit. See `scripts/anatomy3d/README.md` for how the model and a clip are made.
- 3D on every exercise: 888 exercises now have the live 3D figure, driven by the same movement data as the 2D animation.
  There the 3D view replaces animation, photo and video; the drawing stays. The other 155 keep their old views. If the
  live view cannot start on a phone, the old views come back by themselves.
- Explore in 3D: on those two exercises a button on the 3D clip opens the live figure, which can be turned, zoomed,
  slowed down and paused. It falls back to the clip if the phone cannot draw it. Not yet tried on a phone.
