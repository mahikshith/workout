# Round 13: user journey pass

Owner's ask (Nov 2026): testers like the app but still get lost. Not a colour job: make the journey from first launch
to finishing, logging and coming back simple, and add Challenges, a Tracker pane, a real food/protein logger, water and
supplement reminders, and a better calendar. Remove no screens. Tone down heavy fonts. Check every screen for friction.

This file is the shared design every work stream follows. Each stream writes what it changed in its own file next to
this one (`navigation.md`, `workout.md`, `wearables.md`, `challenges.md`, `fuel.md`, `calendar.md`, `audit.md`), and
`docs/guide/` is updated at the end.

## Who we design for

A general gym-goer, any gender, often a beginner, who wants to be told what to do today, log it with the fewest taps,
and feel progress. They open the app at the gym with sweaty hands and one eye on the clock.

## Journey principles (apply on every screen)

1. **One obvious next step per screen.** One filled primary button. Everything else is secondary (tonal or text).
2. **Sheets for actions, screens for places** (from round 10). Logging anything (food, water, weight, supplement, a
   challenge day) happens in a bottom sheet over where you are; you never lose your place.
3. **Logging is reachable from anywhere in one tap**: a **+ Log** button in Today's header opens one Quick log sheet
   (Food, Water, Weight, Supplement, Mood check-in), the same sheet everywhere.
4. **Teach once, then get out of the way.** First-time hints use `useStore().hints` / `seeHint(id)`, shown at most
   2 times, always dismissible, never blocking.
5. **Say what happens before it happens** on buttons that save or move on ("Next · logs this set").
6. **No dead ends.** Every empty state has one action that fills it.
7. **Type is calm**: sentence case, Outfit only (Anton removed from the scale; `f.display` now points at Outfit Bold).
   Use the `T` variants; don't set your own font family or make new all-caps headings.
8. **Touch targets ≥ 44 px**, primary actions in thumb reach (bottom half) where possible.
9. **Back always works**: Android back closes a sheet first, then pops a screen.

## The new map

```
Tabs:   Today   Train   (▶ Start)   Progress   Fuel        avatar → You
Today:  header [date · streak · + Log · avatar]
        Get started checklist (new users, until done or dismissed)
        Hero: today's workout (Start / Change)
        Rings: Training · Protein · Readiness/Sleep/Steps/Add watch
        Challenge pane  → Challenges / today's challenge task       (new)
        Tracker pane    → Tracker (live HR, sensors, today's numbers) (new)
        Week strip → Calendar, coach line, one note
Train:  plan, Challenges entry (new), search + library, other plans
Progress: this week, Calendar (Consistency), Strength, Weight, Body & watch, Recovery, Achievements
Fuel:   totals (kcal, protein, water), Log food, meals, Water card (goal + glass size), Supplements card (tick + reminders)
You:    Your watch (Connect, Tracker, Recovery), Challenges, Reminders (workout, meals, water, supplements), theme…
```

New screens: `app/challenges.tsx` (catalogue + yours), `app/challenge/[id].tsx` (detail, join, day grid),
`app/tracker.tsx` (live and imported sensor data), `app/supplements.tsx` (what you take + reminder times).

## Shared data (already added to `src/store.ts`, version 6)

- `challenge`, `pastChallenges`, `joinChallenge`, `tickChallenge`, `leaveChallenge`
- `supplementReminders`, `setSupplementReminders` (scheduling lives in `src/notify.ts`)
- `waterPrefs { glassMl, goalMl }`, `setWaterPrefs`
- `hints`, `seeHint(id)`
- `Meal` gained optional `carbs`, `fat`, `at`
- Tracker data stays in `src/tracker.ts` (`daily`, `workouts` with kcal/HR, `sessionHr`).

Placeholders to fill: `src/challenges/Card.tsx` exports `ChallengeCard()` (Today's challenge pane),
`src/health/TrackerCard.tsx` exports `TrackerCard()` (Today's tracker pane). Both take no props, return their own card
(full width, `r.lg` corners, same card style as Today's ring cards) or `null` when they have nothing useful to show.
