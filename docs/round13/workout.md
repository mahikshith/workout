# Round 13 · Workout stream

Files: `app/session.tsx`, `app/summary.tsx`, `src/kit.tsx` (mini bar, plus a shared `nextOpen`). Uses `Hint` from
`src/hint.tsx` (navigation stream) without changing it.

## Owner's ask

"We are not providing the next option or next exercise option directly on the workout page. If I'm doing an exercise
for chest, after completing their set they'll focus on rest. From the screen they could easily see whether they want to
go, take rest, take a pause, or go directly to the next exercise. When the user directly completed, for the first time
or first two times, we could show that by clicking on Next you are auto-logging the exercises." Earlier rounds: two
Finish buttons confused them; they want sets logged and the workout to move on by itself.

## Journey before → after

**Before.** Bottom bar: pause · ‹ · "4/15 sets" · **Next**. Next only changed the exercise on screen and logged
nothing, so someone who did a set and tapped Next lost it without noticing. Logging was only the small ✓ on each row.
The rest panel was a ring plus four unlabelled-ish buttons (pause icon, −15, +15, Skip); "Skip" didn't say where it went.

**After.**

1. **Doing a set.** The one filled button is **✓ Done · log set 2**. It logs the next unlogged set with the numbers on
   screen and starts the rest. The ✓ on each row still works the same way. Under it, two text links:
   **‹ Previous** and **Next exercise · logs set 2 ›** — the label says exactly what Next does.
2. **Resting.** The rest panel spells out every choice:
   - the countdown ring, with "Rest · up next" and what comes next ("Set 2 · 14 kg × 10", or the next exercise's name
     after its last set), and **−15 / +15**;
   - **Pause** (freezes the workout clock and the rest; becomes **Resume**, the one filled button while paused);
   - **Next exercise** (tonal, only while this exercise has sets left: ends the rest and moves on, nothing logged);
   - **Next set** (filled: rest over, go now), or **Next exercise** (filled) after the exercise's last set.
   When the rest runs out on its own, the screen moves to the next exercise as before.
3. **Going straight to the next exercise.** "Next exercise · logs set 2" logs the set in progress with the shown
   numbers, leaves that exercise's other sets unlogged (the strip at the top goes back to them) and brings on the next
   exercise with sets left. The first two workout visits show a tip above the bar: "Tapping Next logs this set with
   these numbers and moves on. You can always go back and edit." (`Hint` id `session-next-logs`, max 2, closable). After
   every such Next, a toast "Set 2 of Dumbbell Bench Press logged · **Undo**" stays for 5 s; Undo un-logs it and goes back.
4. **Last exercise.** The only Finish on screen: "Finish workout ⚑" as the right-hand link while sets are left (it asks
   first, as before), or the filled **Finish workout** once that exercise is logged (with "Back to Seated Cable Rows ›"
   when an earlier exercise still has sets). End early stays in ⋯. Logging the very last set still runs the 3 s
   "All sets done · Saving…" beat with Add more.
5. **Minimised.** The mini bar mirrors the bar: ✓ logs the next set; during a rest it shows "Rest 1:06 · 4/14 sets"
   and a **Next ›** button that ends the rest (and brings on the next exercise if that one is done). The countdown
   now freezes while paused ("Paused · rest 1:06"); before, it kept counting down.
6. **Summary.** Already one clear Done (pinned) with Log a meal / Add water as quiet buttons. Added a "Next time · Full
   Body B" card (plan workouts only; the plan has already moved on) so the end of a workout points at the next one, and
   a read-only challenge line (see below).

## Changes and why

| Change | Why |
| --- | --- |
| Big **Done · log set N** replaces "n/N sets" + Next | One obvious next step; logging with sweaty hands no longer needs the small ✓. |
| **Next exercise · logs set N** link | Owner: Next should log what you just did. The label says it before it happens (principle 5). |
| Tip for the first 2 visits + Undo toast | Teach once, then get out of the way; the auto-log is never a surprise and always reversible. |
| Rest panel with labelled Pause / Next exercise / Next set | Owner: "easily see whether they want to go, take rest, take a pause, or go directly to the next exercise". |
| Up next line in rest shows the next set's numbers | You know what's coming (and can adjust the numbers) while resting. |
| Finish only on the last exercise, filled only when that exercise is done | Removes the double-Finish confusion from earlier rounds. |
| Mini bar Next during rest, frozen countdown while paused | Mirrors the workout screen; fixes the countdown running on while paused. |
| Taps on the rest panel in its first 0.5 s, and a second tap on Done/Next within 0.6 s, are ignored | A double tap on Done would otherwise skip the rest it just started, or log two sets. |
| Rest countdown uses `T v="h3"` (Outfit SemiBold 17) | Calmer than the old display face; reads fine in the 64 px ring. |
| `nextOpen` moved to `src/kit.tsx` (exported) | The mini bar needs the same "next exercise with sets left" rule. |
| Bottom padding of the exercise list follows the bar's real height | The bar is taller now (two rows, sometimes the tip); the last row never hides under it. |

## Challenge line on the summary

Read-only, from `useRun()` in `src/challenges/use.tsx` (challenges stream), so it uses the same day rules as the
Challenges screens, with this workout already counted:

- today's challenge day is now done → "(trophy) Challenge day done · 21-day Kickstart · Day 1 of 21" (weekly challenges:
  "2 of 3 this week");
- the workout counted but the day asks for more → "Muscle gain 30 · workout counted · Still today: Hit 130 g protein";
- today's task isn't something a workout can count for (steps, water, a specific challenge session) or no challenge
  runs → nothing. It never claims a day that didn't happen.

It sits with the "Next time" card right under the stat tiles, before records and badges. Nothing on it is tappable:
the summary still has one way out, Done.

## Screenshots (390 × 844, `/tmp/claude-0/shots/workout/`)

- `ready.png` — opened, clock stopped, Start workout.
- `running.png`, `running-dark.png` — bench press, Done · log set 1, tip, Next link.
- `after-done.png` — after Done: rest panel with Pause / Next exercise / Next set. `rest.png`, `rest-dark.png` too.
- `restlast.png` — rest after the exercise's last set: up next = Seated Cable Rows, filled Next exercise.
- `rest-paused.png` — paused during rest: Resume filled, Next set tonal.
- `next-undo.png`, `next-undo-dark.png` — after "Next exercise · logs set 1": next exercise, Undo toast, tip.
- `t-undo.png` — after Undo: back on bench press, set 1 unlogged.
- `tip-after-rest.png` — the tip survives a rest cycle and counts one showing per visit.
- `t-rest-nextex.png` — rest panel's Next exercise: moved on, nothing extra logged.
- `last.png` — last exercise: Done · log set 1 + "Finish workout" link. `lastgap.png` — last exercise done, earlier
  sets open: filled Finish workout + "Back to Seated Cable Rows".
- `save-beat.png` — "All sets done · Saving…".
- `mini-rest.png`, `t-mini-next.png` — mini bar on Today during a rest (Rest 1:06 · Next) and after its Next.
- `summary.png`, `summary-dark.png` — Workout done, tiles, badge, Next time · Full Body B, one Done.
- `summary-challenge.png` (Kickstart: day done), `summary-challenge3.png` (Muscle gain: workout counted, protein left),
  `summary-challenge2-dark.png` (Advanced strength: today's task is a specific session, so no line).
- `rest-paused-dark.png`, `combo-paused.png` (crop of both themes).
- Script: `/tmp/claude-0/shots/workout/wshot.cjs <scenario> <out.png> [--dark] [--click text] [--label aria] [--hints n]
  [--challenge id]`; scenarios ready, running, rest, restlast, last, lastgap, mini, done (times relative to now).

## Couldn't verify

- Haptics, the rest-over notification (`restAlert`) and Android back on a real device (web only here).
- Reduced-motion paths were not screenshotted (code keeps the existing `still` guards).

## Hurdles and alternatives

- **Where the tip lives.** `Hint` counts a showing per mount. Rendering it inside the bottom bar would remount it after
  every rest and use up both showings within one workout. It is mounted once per visit, the first time Next would log
  a set, and only hidden (not unmounted) during rests, the save beat and on the last exercise.
- **Next during rest.** The brief allowed "Next exercise · logs this set". During a rest the set was already ticked, so
  Next exercise there logs nothing and says so by not saying "logs". Only the bar's link (no rest running) logs.
- **Three buttons in the rest panel at 390 px.** Pause and Next exercise size to their text; Next set takes the rest.
  "Rest · up next" moved under the ring's label so the numbers aren't cut.
- **Shared scratchpad.** Another agent overwrote my screenshot script in the scratchpad; it now lives in the shots folder.
- **Alternative considered:** Next as a tonal button beside Done in one row. Rejected: "Next exercise · logs set 2"
  doesn't fit beside Done at 390 px, and "Next" alone hides the auto-log.
