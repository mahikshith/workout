# Round 13 · Fuel stream: food, protein, water, supplements and their reminders

Owner's ask: a proper food log (protein especially), a water log that is really looked after, and daily reminders for
the things people take regularly (protein shake, creatine, coffee, pre-workout…) at their own time.

## Journey before → after

**Before.** Fuel had totals, a Log food button and four meal rows that folded open. Water was glasses only (always
250 ml, no goal you could change). Supplements were three items hidden inside "Tips for you", only for muscle goals,
with no reminders. A food logged was only removable, never editable, and there was no way to log yesterday's dinner.
Food rows logged one serving with no choice of amount.

**After.**
1. Fuel opens on **today** with a day bar (‹ Today ›, up to 6 days back). Totals: **kcal left** ring, **protein g of
   target with a bar**, **water in ml with a bar**. One filled button: **Log food** (says "Log food to yesterday" when
   you page back).
2. Meals show every food with its kcal · protein, each meal with its time (first logged) and its kcal and protein.
   **Tap a food → Edit food sheet** (name, meal, kcal, protein, carbs, fat · Remove / Save). A one-time hint teaches it.
3. **Protein card**: "61 g protein to go", a suggestion of two diet-aware foods that would cover it ("Try seitan and soya
   chunks: about 51 g"), and six quick protein picks (from `proteinPicks`, diet-aware). Tapping a pick opens the log sheet
   straight on that food's serving picker; logging closes the sheet.
4. **Log sheet**: Yesterday / Today switch, meal (defaults by time of day), search (with the describe-a-meal estimate as
   before), Log again (recent), Foods / Recipes / Your own. A food's **+** still logs one serving in one tap (with Undo);
   tapping the food opens a **serving stepper** (−/+ by ½, quick ½ 1 1½ 2 3) that scales kcal and protein, optional carbs
   and fat, and "Log 1½ servings to snack". "Your own" gained optional carbs and fat.
5. **Water card**: ml of goal, a bar, − and **+ Glass · 250 ml** (tonal, with Undo), and a settings button opening the
   **Water sheet**: daily goal in ml (default from body weight, ±250, "Use my body weight" to go back), one-tap size
   (150 / 250 / 350 / 500 / 750 ml), the drink reminder switch and a link to Reminders.
6. **Supplements card** on Fuel (today only): tick chips for what you take and a "Reminders" link; empty state has one
   action, "Add what you take". Ticking a **protein shake offers "Log it"** as food (+24 g, with Undo) both here and on
   the Supplements screen.
7. **New `/supplements` screen**: Today ticks, "What you take" (dose · reminder times · days), and "Add more" from a
   catalogue (protein shake, creatine, caffeine, pre-workout, multivitamin, omega-3, vitamin D, electrolytes,
   citrulline) each with one safe line of guidance, plus "Something else" for a custom name. Tapping one opens a sheet:
   dose, up to 3 reminder times each with days and on/off, a time wheel, notes (inside quiet hours; caffeine within ~6 h
   of bedtime), Remove / Done. Notification permission is asked the moment a reminder is switched on. Under-18s and
   pregnancy/postpartum don't see pre-workout, creatine or citrulline and get a short caution.
8. **Reminders** is grouped so it scans: Training (workouts, missed, streak, recap) · Food and drink (meals, water in ml,
   **Supplements → /supplements** with the times that are on) · Through the day (motivation, desk breaks) · Quiet hours.

## Changes and why

| File | Change |
| --- | --- |
| `app/(tabs)/fuel.tsx` | Rebuilt as above: day bar, totals with bars, meal list with per-food edit, ProteinCard, WaterCard + WaterSheet, Supplements card. Supplements moved out of the tips fold (protein picks too). Gentle mode: meals ring, no kcal/protein numbers, protein card becomes "Protein ideas" without grams; water stays (it was shown in gentle mode before too). |
| `src/foodsheet.tsx` | `FoodSheet` gains `day` and `food` props and a Yesterday/Today switch; `FoodPicker` gains the `Servings` panel, carbs/fat, `onDone`; new `MealSheet` (edit/remove), `SlotPicker`, helpers `servings` (½ formatting), `dayLabel`, `timeOf`, `findFood`, `yesterday`. Existing callers (Today, workout summary, /food) are unchanged. Touch targets raised to 44 px (meal chips, toast). |
| `src/supps.tsx` (new) | `useMySupplements`, `addSupplement` / `removeSupplement`, `SupplementTicks` (with the shake → food offer), `catalogue` (age/pregnancy filter). |
| `src/water.ts` (new) | ml helpers: `useWater()`, `drink(n)`, `goalMl`, `autoGoalMl`, `SIZES`. |
| `app/supplements.tsx` (new) | The supplements screen and its edit sheet. |
| `src/data/foods.ts` | `SUPPLEMENTS` became a 9-item catalogue with icon, default time, guidance, and flags (`strong`, `caffeine`, `shake`); `supplementByName`, `shortName`, `shakeFood`. Old names "Creatine monohydrate" and "Whey or pea protein" kept, so earlier ticks still count. |
| `src/notify.ts` | `plan()` schedules each switched-on supplement time (daily, or weekly per picked day) as a repeating reminder that opens `/supplements`; like workout reminders, they ring inside quiet hours because the person picked the time (defaults all sit outside them, and the sheet says so). Water nudges now read in ml against the ml goal and stop at it. `watched` includes `supplementReminders` and `waterPrefs`; motivation nudges avoid supplement times. |
| `app/reminders.tsx` | Grouped headings, Supplements row, water line in ml. |
| `app/food.tsx` | Recipe servings read "1½ servings". |
| `src/store.ts` (additive) | `addMeal` accepts optional `day` and keeps a passed `at`; `waterPrefs` gains optional `auto` (goal follows body weight until set); `addWater` rounds to 0.01 so ml sizes don't build float noise. Comment on `waterPrefs` updated. |

### Water units (decision)
`State.water[day]` stays in **standard 250 ml glasses** (a 500 ml bottle adds 2, a 150 ml glass adds 0.6). The other
option was "glasses of the chosen size", but badges, charts, engine insights, Today and notify all compare `water[day]`
with `targets().water` (250 ml glasses); keeping the unit means they all stay right whatever size is picked, and changing
the glass size never rewrites history. One tap = `drink()` in `src/water.ts`. Other streams' quick-log "+ water" should
call `drink(1)` (adds the person's glass) instead of `addWater(1)` (always 250 ml).

## Screenshots (`/tmp/claude-0/shots/fuel/`)
- Fuel: `fuel-empty-light.png`, `fuel-empty-dark.png`, `fuel-meals-light.png`, `fuel-meals-light-2.png`, `fuel-meals-dark.png`, `fuel-meals-dark-2.png`, `fuel-yesterday-dark.png`, `fuel-gentle-light.png`
- Log sheet: `sheet-log-light.png`, `sheet-search-dark.png`, `sheet-serving-light.png`, `sheet-serving-dark.png` (carbs/fat open), `sheet-yesterday-light.png`, `sheet-custom-light.png`, `flow-added-light.png` (+ with Undo), `flow-protein-pick-light.png` (pick → logged)
- Edit: `edit-meal-light.png` · Water: `water-sheet-light.png`, `flow-water-dark.png` (+ with Undo)
- Supplements: `supps-light.png`, `supps-dark.png` (shake → "Log it"), `supps-empty-light.png`, `supps-edit-dark.png`
- Reminders: `reminders-light.png`, `reminders-dark-2.png`

## Not verified
- Notifications can't run on web: supplement scheduling, the permission prompt on switch-on and the "Notifications are
  off" banner were checked by reading the code paths only (`Platform.OS` guarded like the existing reminders).
- Haptics and Android Back closing the sheets (inherited from `Sheet`).

## Hurdles and alternatives
- **Favourites** were skipped (needs a new persisted list); "Log again" (recent) covers repeat foods.
- **Editing a meal** writes through `useStore.setState` (as `src/hint.tsx` does) instead of adding an `updateMeal`
  action, so the store change stayed minimal and the food keeps its place and time.
- **Bedtime** isn't known; the caffeine warning uses the start of quiet hours (default 22:00) as a stand-in.
- Other screens that print `water[day]` as a glass count (workout summary "Add water · n", the engine's "You're at n of
  m glasses") can now show a decimal if a 150/350 ml glass is chosen. Not my files; worth a `toMl`/`ml()` pass.
- The web focus outline on the search box is the browser's, same as before.
