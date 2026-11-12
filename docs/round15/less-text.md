# Round 15: less text, same features

The user found the app too wordy on every screen except the exercise screen. Wordy screens make people leave,
so this round cuts on-screen text without removing a single feature, setting or piece of information.

## What the research says

- People scan apps, they do not read them. Each extra sentence lowers the chance the important one is seen.
- **Progressive disclosure** (Nielsen): show what most people need now; keep the rest one tap away.
- **Icons work best paired with a word**, not instead of one. Unlabelled icons get misread, so icon-only is kept
  for universal ones (time, calendar, flame, info, close, search, add). Everywhere else: icon + 1-2 words.
- Fitness apps that feel calm (Strong, Hevy, Apple Fitness, Google Fit) lead with **one big number** and a 1-2 word
  label, keep one obvious action per card, and push explanations into detail pages or info sheets.
- Onboarding screens work best as short choices with no sub-captions; the option title should carry the meaning.

## Rules applied to every screen (the exercise screen and the live workout are left as they are)

1. **Titles carry meaning; captions go.** An option, card or row has a title. A caption stays only if the title
   would be ambiguous without it, and then it is at most 3-4 words.
2. **No sentence under a heading.** Helper lines ("Pick the one that matters now.") are deleted. If the line holds
   real information (privacy, safety, how a score is made), it moves into a `Tip` (the (i) icon) next to the heading.
3. **Meta lines become icon + value.** "3 days a week · Beginner · 45 min" becomes `Meta` items
   (calendar 3×/wk, bar-chart Beginner, time 45 min).
4. **Buttons are 1-2 words.** "Start this challenge" -> "Start". "See what's involved" -> "Details".
5. **Say it once.** Repeated facts on one card (e.g. "Rest day" twice) are said once.
6. **Lists show names, details show stories.** Taglines and descriptions leave list cards; they stay on the
   detail screen.
7. **Hints and notes are 6 words or fewer** where possible ("Log food, water, weight, mood").
8. **Disclaimers become one icon link** (shield + "Safety") unless law or safety needs them on screen.
9. Numbers over words: "0 of 3 done this week" -> "0/3 this week".

## Shared pieces

- `src/tip.tsx`: `Tip` (an (i) that opens the explanation in a sheet) and `Meta` (icon + value line).
- Existing: `Fold` (show more), `Hint` (one-time tip), `Sheet`, `DoorCard`, `Tile`.

## Result: visible words per screen (393 px, new user, before -> after)

| Screen | Before | After |
|---|---|---|
| `/` | 176 | 103 |
| `/challenge/kickstart/21` | 169 | 65 |
| `/challenges` | 351 | 113 |
| `/chart/body` | 9 | 7 |
| `/chart/strength` | 33 | 18 |
| `/etiquette` | 47 | 42 |
| `/food` | 225 | 189 |
| `/fuel` | 103 | 67 |
| `/history` | 69 | 36 |
| `/library` | 234 | 234 |
| `/onboarding` | 226 | 107 |
| `/plan/full/body/gym` | 124 | 95 |
| `/plans` | 273 | 183 |
| `/profile` | 254 | 162 |
| `/progress` | 65 | 44 |
| `/recovery` | 58 | 20 |
| `/reminders` | 137 | 80 |
| `/safety` | 264 | 91 |
| `/supplements` | 189 | 28 |
| `/tracker` | 116 | 36 |
| `/train` | 99 | 80 |
| `/watch` | 139 | 57 |
| `/you` | 78 | 68 |
| **All 23** | **3438** | **1925** |

The exercise screen and the live workout were not touched. Library's muscle grid is labels only, so it stays as it was.
