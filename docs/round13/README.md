# Round 13 summary: the user journey pass

November 2026. One page for the owner: what changed, why, what we couldn't test, and what needs your call.
The maintained user guide (journeys, every feature, data sources, connecting devices, screenshots) is in
[docs/guide](../guide/README.md) and was updated for this round.

**The ask.** Testers liked the app but got lost between first launch, setup, logging and finishing. Make that journey
simple; add Challenges, a Tracker pane, a real food and protein logger, water and supplement reminders and a better
calendar; tone down heavy fonts; check every screen for friction; remove no screens.

**Shipped in two commits**: `b7383e7` (Round 13: six work streams) and `a7ebea4` (Round 13b: 27 challenges, Safety and
disclaimer, Go heavier, plate calculator, rest alert names what's next, friction audit fixes).

## What changed, journey by journey

| Journey | Before | After |
|---|---|---|
| **First launch** | Straight into "What do you want most?" with answers already highlighted, a bare Skip, two exits on the plan step, a notification prompt and a silent 6 pm reminder at the end | A **welcome** ("5 quick steps, about a minute"), "Step n of 5" on every question, nothing pre-selected, a back button, one action on the plan step (**Use this plan**) with a quiet safety note, an optional **name** step (**Let's go, Alex**). No permission prompt and no reminder created during setup |
| **Today** | No way to log water, weight, supplements or mood; food only via the Protein ring; "Add watch" ring; all-caps date; week strip not tappable | Header with date and streak (→ calendar), **+ Log** quick sheet (food, water, weight, supplements, mood), **Get started** card under the hero (5 self-ticking rows), rings with **Water** instead of "Add watch", **challenge pane**, **tracker pane**, **This week** card → Calendar |
| **Workout** | Bottom bar "4/15 sets · Next"; Next changed the exercise but logged nothing; the rest panel had unlabelled buttons; two Finish buttons in earlier rounds | One filled **✓ Done · log set 2**; **Next exercise · logs set 2** logs the set in progress (tip on the first two workouts, Undo toast for 5 s); rest panel with **Pause / Next exercise / Next set** and "up next" with the numbers; one Finish, on the last exercise; mini bar mirrors it; **Go heavier** line; **Plates** sheet; Summary adds **Next time** and a challenge line |
| **Challenges** | None | **27 challenges** (12 beginner, 11 intermediate, 4 advanced; weight loss to HIIT, cardio, mobility, 55+, after birth), picked for you, days tick themselves, rest days count, **make-up days**, free misses, stars at ¼ ½ ¾, badges, **Need a break?** that keeps your done days. No 75 Hard, nothing resets to day 1 |
| **Food and water** | Totals, Log food, four folding meals; water in fixed 250 ml glasses with no goal you could change; supplements hidden in tips; foods only removable, one serving only, today only | Day bar (back 6 days, Yesterday/Today in the sheet), **servings picker** (½ steps), tap a food to **edit/move/remove**, **protein card** with suggestions, **water in ml** with your own goal and glass size, **Supplements** card and screen with **reminder times** (up to 3 each, days, dose) |
| **Calendar** | A grid where a day was teal or blank; only today could be excused | Month calendar with **workout / watch / rest / excused / missed / planned** markers and an orange calories bar; a **day sheet** with calories burned **by source**, workouts, watch workouts, steps, sleep, food, water and **Mark this day** for any day |
| **Watch** | A long Watch & health page; 5–6 sentence steps per brand; no picture of how data travels; nowhere to see the watch's numbers together | **Data-path diagram** with ticks per hop, 3 numbered steps with one button each, **What Gym Buddy gets** per brand, a status-first Watch & health, and a new **Tracker** (live HR, today's numbers, heart rate today, watch workouts, every missing number says why) |
| **You and reminders** | One mixed "You and your plan" list; Reminders buried; no water/supplement reminders | Groups: Watch & health, Goals, Reminders (Workout, Meals and water, Supplements), Look and feel, More (with **Safety and disclaimer**). Reminders grouped Training / Food and drink / Through the day / Quiet hours; one 12-hour time format |
| **Safety** | A grey line in places | A **Safety and disclaimer** page and short notes where you commit: setup plan, plan page, challenge Join, Challenges, Supplements, profile sections |
| **Type and polish** | Anton all-caps headings | Outfit only, sentence case, bold kept for numbers; 44 px touch targets; ~40 friction fixes (see audit notes) |

Guide screenshots for all of the above: `docs/guide/img/` (setup-*, today*, workout-*, challenge*, fuel-*,
supplement*, calendar*, tracker*, connect-*, reminders, safety, dark-*).

## Stream notes (index)

| File | What it covers |
|---|---|
| [PLAN.md](PLAN.md) | The shared design: who we design for, nine journey principles, the new map |
| [research.md](research.md) | Research and REA findings (below) |
| [navigation.md](navigation.md) | Welcome and setup, Today (+ Log, Get started, rings), You, tab bar, hints |
| [workout.md](workout.md) | Done / Next / rest panel, tip and Undo, Finish, mini bar, Summary challenge line |
| [wearables.md](wearables.md) | Connect flow, data-path diagram, Tracker, what each brand shares |
| [challenges.md](challenges.md) | 12 then 27 challenges, rules (make-up, free misses, excused days), picks, self-checks |
| [fuel.md](fuel.md) | Food logger, servings, edit, protein card, water in ml, supplements and reminders |
| [calendar.md](calendar.md) | Calendar markers, day sheet, calories counted once |
| [audit-train.md](audit-train.md) | Friction audit of setup, Today, workout, Train, Challenges; Go heavier, Plates, safety |
| [audit-track.md](audit-track.md) | Friction audit of Progress, Calendar, charts, Fuel, Reminders, Watch, Tracker; Fitbit vs Google Health naming |
| [feature-gaps.md](feature-gaps.md) | What other apps have that we don't, ranked: add now / later / skip |

## Research and REA, in short

- **REA worked** this round on three open-source APKs from F-Droid (structure, manifests and strings only; nothing
  copied): **LibreFit** (gym logger: 3 tabs, one running workout, rest-timer notification channel, plate calculator in a
  sheet, permission screen with "Skip for now", tutorial tied to real UI), **Hidroly** (water: setup with one permission
  per step, cup buttons, interval reminders with a sleep window) and **OpenTracks** (skippable intro, Health Connect
  rationale screen, permissions asked on first use).
- **Navigation**: our 4 tabs + centre Start already match WHOOP's labelled tabs with a centred action; Google Health's
  redesign shows the opposite risk (text pushing numbers below the fold), so numbers first, coach line short.
- **Onboarding**: no permission prompts at launch; ask in context (Android guidance); defer details.
- **Workout**: our flow matches Hevy/Strong; add plain rest choices and teach with one-time hints, not a tour.
- **Wearables**: no watch brand lets a third-party app pair directly; Health Connect is the path. Google's read/write
  table and WHOOP's tiers decide what each brand can ever send (Fitbit: no SpO2; WHOOP: no HR samples, HRV or VO2 max).
- **Challenges**: rest that doesn't break the streak (Apple's pause rings), make-ups, milestones (Samsung stars), staged
  difficulty by week (Nike programs; reviewers of 30-day apps complain about jumps around day 10–15). 75 Hard rejected.
- **Food and supplements**: Cronometer-style repeat prompts, WaterMinder cups, caffeine ≤ 400 mg and away from bedtime,
  creatine 3–5 g any time, protein 1.4–2.0 g/kg.
- **Calendar**: Hevy marks workouts only and calls everything else rest; Garmin's blank rest days are ambiguous; we show
  rest, missed, excused and watch days distinctly.
- **Type**: titles semibold, bold only for numbers, no condensed all-caps.

## Hurdles and the alternatives we chose

| Hurdle | What we did instead |
|---|---|
| **No direct watch pairing.** Fitbit, WHOOP, Samsung, Garmin and Oura pair only with their own app; the Fitbit Web API is gone and the Google Health API needs a server and a paid assessment | Health Connect for daily data, explained with a data-path diagram and 3 steps per brand; Bluetooth broadcast for live heart rate; our own Colmi ring adapter; file import |
| **WHOOP limits.** Never shares HR samples, HRV, VO2 max, recovery or strain; steps and SpO2 depend on plan; its developer API needs a server and is capped at 10 members | Marked "depends" on the WHOOP page; readiness uses HRV from live heart rate in workouts when the broadcast carries beat-to-beat data; we don't touch WHOOP's own protocol (its terms forbid it) |
| **Skin temperature not readable.** react-native-health-connect 3.5.3 has no record for it, though Fitbit writes it | Listed as "We can't read it yet" on the brand page; the Tracker tile only appears if a value ever arrives |
| **Untested on web**: notifications (supplement times, rest-timer channel, permission on switch-on), Health Connect (permission, history step, sync incl. today's heart rate and watch-workout kcal), Bluetooth (straps, broadcasts, Colmi), haptics, Android Back on sheets, real swipe between months | Code paths guarded with `Platform.OS` like existing ones; watch data seeded for screenshots, not synced. All of this needs a pass on an Android phone |
| Opening another app by package isn't possible with React Native's Linking (and expo-intent-launcher isn't installed) | "Get / Open {app}" opens its Play Store page, which shows Open when it's installed |
| Water was stored as 250 ml glasses everywhere (badges, charts, insights) | Kept the unit, added ml display, goal and glass size on top, so history never changes when the glass size does |
| Per-task challenge ticks would need a store change | A hand tick marks the whole day (see decisions) |
| No bedtime in the profile | The late-caffeine note uses the start of quiet hours (default 22:00) as a stand-in |
| Calorie numbers in every calendar cell needed 10 px text | A short orange bar per day; the exact number is in the day sheet and the cell's label |
| Setup's weigh-in seeded from the default weight would read as "logged" | Quick log only trusts a weigh-in you entered |

## Decisions to confirm

1. **Next logs only the set in progress.** "Next exercise · logs set 2" logs that one set with the numbers shown and
   leaves the exercise's other sets open (the strip goes back to them). Alternative: log all remaining sets of the
   exercise. During a rest, Next exercise logs nothing (the set was already logged).
2. **Get started card under the hero**, not above it as PLAN.md said: above, it pushed Start below the fold at 390 px.
3. **Water ring replaced the "Add watch" ring** when there's no watch data: the tracker pane and Get started already
   offer to connect, and a ring you can fill in one tap is more useful.
4. **Setup no longer creates a 6 pm workout reminder by itself** (it would never fire without permission). Get started
   offers "Set a workout reminder", which asks for permission then. Hydration and motivation nudges stay on and start
   once permission exists.
5. **A hand tick marks the whole challenge day** ("Mark today done"), even on days with two tasks.
6. Smaller ones: "Leave challenge" is the filled button on the break sheet (Keep going is grey); streak stays in days
   (research suggests weeks); Cardio uses the steps green so it differs from HIIT's red.

## Bugs and loose ends found while writing the guide (not fixed; docs-only pass)

- **"1 days in a row"** on a challenge page with a one-day streak (`app/challenge/[id].tsx` line 99: no singular).
- **Challenges › Recommended for you** can list a challenge you already finished first (21-day Kickstart, "Finished")
  while *Picked for you* shows a different one.
- **Plan page** still says "Done Mon · fresh again in 5 days"; the exercise page was changed to "ready again in N days".
- **"1RM" jargon** remains on the exercise page ("Your best · 38 kg 1RM") and the Summary records ("41 kg est. 1RM"); the
  Strength chart was changed to "about 70 kg for one rep".
- **Naming**: Watch & health's data path labels the app node "Fitbit", while the connect sheet labels the same node
  "Google Health" (the audit's rule says the app node should read Google Health).

## Later (from feature-gaps.md and the streams)

1. **Restore from backup** (first in line: no account or cloud, so Export is the only safety net; needs migration,
   validation and Replace / Merge).
2. Workout notes on the Summary.
3. Warm-up hint for heavy compound lifts.
4. Waist and other measurements in Quick log, with a trend.
5. kg / lb setting (only if we target the US or UK).
6. Progress photos (private, on device; hidden in gentle mode and under 18).
7. Rest-timer notification actions (✓ Done, +30 s) and an ongoing "Workout running" notification.
8. Supplement reminder actions (Taken / Snooze) and a daily caffeine total.
9. Challenges: a sleep task, "Repeat this week" after two missed days, step targets from your 7-day average.
10. A dedicated Health Connect rationale page and a Permissions row in You.
11. Skipped for now: share-a-workout image, supersets, home-screen widget, barcode scan, voice cues.
