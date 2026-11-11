# Round 13 · Friction audit · Train part

Walked at 390 px on web (Playwright, light and dark), new-user state (cleared storage → setup) and regular-user state
(`navigation/vet.json`, `challenges/mid.json`), clicking through: first launch → welcome → setup → Today → Start → ready
workout → Start workout → Done → rest → Next set / Next exercise (tip + Undo) → ⋯ Edit / Change / End → minimise to the
mini bar → finish → Summary → Done; Today → Change; rest-day sheet; Train → search → exercise → Train this now; Train →
plan; Train/Today → Challenges → join → today's task. Also the coordinator's extra asks (safety note, guilt-free
leaving, a catalogue that copes with 27 challenges, Go heavier, plate calculator, needs/who pills, Cardio colour).

## Issues and fixes

| Issue | Screen | Fix |
| --- | --- | --- |
| Welcome says "4 quick questions" but the steps read "Step 1 of 5" | Onboarding | "5 quick steps, about a minute." |
| No safety/disclaimer where a plan is chosen | Onboarding plan step, plan welcome page | Quiet `SafetyNote` under "Use this plan" (both places) |
| Plan preview from setup says "Start this plan" while setup says "Use this plan" | Plan welcome | "Use this plan" when previewing from setup |
| "You can redo setup anytime in Profile" (there is no "Profile" tab; the plan lives in Train) | Plan welcome | "You can change your plan any time in Train" |
| "Start this plan" on another plan reads like starting a workout | Plan page | "Switch to this plan" when you already have one |
| "YOUR CURRENT PLAN" all-caps badge | Plan page | Sentence case, small semibold |
| Day "Start" buttons 40 px tall | Plan page | 44 px |
| Water ring "0.0 L" (decimal zero) | Today | Under 1 L shows ml ("0 ml", "750 ml", smaller size so it fits the ring); 1 L+ stays "1.2 L" |
| "Connect a watch" asked twice (Get started row + tracker pane) | Today | Tracker pane hidden while Get started still lists the watch row |
| Get started says "Start your first workout" while one is in progress | Today | "Finish your first workout" while a workout is open |
| "Done for today" said twice ("Done for today · next: Full Body A Fri.") | Today hero, rest-day sheet | Shared `restLine()`: "Next: Full Body B on Fri" |
| "Quick 20 min" heading over 15 and 25 min sessions | Change / rest-day sheets | "Short on time" |
| Long exercise names cut ("Alternating Cable Should…") | Edit workout sheet | Name wraps to 2 lines |
| Go heavier bump was silent | Workout | "Last time 60 kg × 5 · Go heavier: +2.5 kg" (train colour) when `item.up` is set |
| No plate maths for bar lifts | Workout | "Plates" (44 px) in the set table header for barbell / EZ-bar moves → `PlateSheet` with the current set's weight; never stacked on another sheet |
| "Add water · 1.4" (glasses, decimals with non-250 ml glass) | Summary | Adds one of the person's own glasses (`drink()`); label "Add water", then "Water · 500 ml" |
| "Streak 2" (2 what?) | Summary | "Day streak", same as Today's header |
| Placeholder "Search 1043 exercises" | Train | "1,043" |
| Clear-search ✕ was an 18 px target; place pill 32 px | Train | 44 px targets |
| Search with no hits had no action | Train | "Browse all exercises ›" |
| "bench" listed Bench Dips, Bench Jump, Bench Sprint before the bench press | Train search | Moves used by plans rank first, then names starting with the word |
| Web focus outline box on the search field | Train | `outlineWidth: 0` (as in onboarding) |
| "Inner and ou…" muscle tile; titles/subs cut in list rows ("Your goal, your d…") | Train, Library | Tile label wraps to 2 lines; `ListRow` title and sub allow 2 lines; library rows allow 2-line names |
| Level chips wrapped "Expert" alone onto a line | Library | Scrolling row like muscles and equipment |
| "Moderate" tag (moderate what?) and "fresh in 2d" jargon | Exercise page | "Moderate effort"; "ready again in 2 days" |
| "I've trained before" link ~30 px tall | Exercise page (locked) | 44 px |
| Leaving a challenge only in ⋯, confirm framed as a loss (red Leave, "Keep going" primary) | Challenge detail | Visible "Need a break? Leave any time. Your done days stay…" row under Your days; confirm "Take a break from HIIT 21?" · "No problem…" with Leave as the plain action and Keep going as ghost |
| No disclaimer at Join; glass join bar let text show through | Challenge detail | `SafetyNote` ("Leave any time…") under Join; bar background solid |
| 27 challenges = one long scroll; nothing says you can switch | Challenges | Unfiltered: "Recommended for you" (3), then one block per goal with its best 2 and "See all n" (sets the filter); filters still give the full list. Note under the hero: "Switch or stop any time; your done days and badges stay." + safety link |
| Goal pill wrapped to its own line ("Weight loss"); no kit/who info | Challenges, detail | Pills on one line, last one shrinks; inside goal blocks the goal pill (redundant) becomes the kit/who pill ("Kettlebell", "Made for 55+"); detail hero shows all of them |
| Cardio and HIIT chips the same red | Challenges | `goalTint()`: Cardio uses the steps green (data file untouched) |

Left as is, and why:
- **Get started card position** (under the hero, above the rings). Kept: for a new person Start is the one next step and
  must stay above the fold; the rings are all zero then anyway. The duplicate watch ask was the real clutter (fixed).
- **Two Start-like buttons on Today during a workout** (hero Resume + mini bar Next + centre tab). Mini bar is shared
  across tabs; changing it is a redesign.
- **`f.display` / `f.bold` at big sizes**: every remaining use is a number (rest timer, set steppers, rep counter,
  level number, stat tiles) or the tab-bar clock; `T display` is already Outfit SemiBold. No heavy non-number text found.
- **Small all-caps labels** ("EXERCISE 1 OF 5 · QUADRICEPS", "PICKED FOR YOU", set table heads) are the `label`
  variant, allowed by the brief.
- **Nested `<button>` console warning on web** comes from a card inside a pressable on Today (web-only hydration
  warning, no visible effect); not traced further.
- "Zone 2 28" style names, the engine's reason text, and `GOAL_COLOR` live in files I don't own.

## Screenshots (`/tmp/claude-0/shots/audit-train/`, `-dark` = dark)

Onboarding `01-welcome`, `02-goal`, `03-place`, `04-days`, `05-plan` (+dark), `05b-plan-preview` (+dark), `06b-name`;
Today `07-today` (+dark), `07b-today-lower` (+dark), `30-today-vet`, `30b-today-vet-lower`, `33-today-done`,
`63-today-challenge`; sheets `31-change-sheet`, `34-restday-sheet`; workout `10-ready`, `11-running`, `12-rest`,
`13-afterrest`, `14-next-undo`, `15-menu`, `16-edit`, `17-change`, `18-end`, `19-mini`, `19b-mini-bottom`,
`50-goheavier` (+dark), `51-plates` (+dark); summary `20-summary`; Train `32-train` (+dark), `32b-train-lower`,
`35-search`, `35b-search-empty`, `36-exercise`, `36b-exercise-lower`, `37-trainnow`, `38-plan`, `38b-plan-lower`;
Library `62-library` (+dark); Challenges `40-cat-none`…`40d`, `41-cat-mid` (+dark), `41b`, `41c`, `45-cat-filter`,
detail `42-detail-mid`, `42b-detail-mid` (+dark), `43-leave-sheet`, `44-detail-join` (+dark);
`60-etiquette` (+dark), `61-notfound` (+dark). Journey script: `j.cjs` in the same folder; seeds `new.json`,
`restday.json`, `plates.json`.

## Not verified

Native only: haptics, Android back on the new sheets, `adjustsFontSizeToFit` (removed from the muscle tile in favour of
wrapping). `tsc`, `scripts/check.mjs` and `selfcheck.mjs` pass.
