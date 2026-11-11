# Gym Buddy

An offline-first workout companion for Android (iOS later from the same code). It logs every set,
shows an animated demo for each exercise, swaps exercises when a machine isn't available, adapts
plans to your gender, age, goal, place and diet, and nudges you to keep your streak.

## Get the app

Every push to `main` builds a fresh APK. Download `gym-buddy.apk` from the
[latest release](https://github.com/mahikshith/workout/releases/tag/latest) and open it on your phone
(allow installs from your browser when Android asks).

## Guide

How the app works, with screenshots: [docs/guide](docs/guide/README.md) (journeys, every feature, where the data
comes from, and how to connect Fitbit, WHOOP and other watches). What changed most recently:
[round 13 summary](docs/round13/README.md).

## What's inside

- **Setup in about a minute**: a welcome, then goal, where you train, days a week, your plan (with why it fits) and an
  optional name. Age, weight and diet are optional extras for food targets. No permission prompts during setup.
- **Today**: the next workout with Start, a **+ Log** sheet (food, water, weight, supplements, how you feel), a Get
  started card for new users, rings (training, protein, readiness / sleep / steps / water), your challenge, your watch's
  numbers, and the week (opens the calendar).
- **Live workout**: opens ready; **Done · log set** logs the set and starts the rest; the rest panel offers Pause, Next
  exercise and Next set and says what's next; **Next exercise · logs set N** with Undo; Go heavier when you hit every
  rep last time; a plate calculator for bar lifts; swap with a reason, edit or change the workout; a mini bar when you
  leave; a summary that points at the next workout.
- **27 challenges** (14 to 30 days, beginner to advanced: kickstart, squat, plank, walk to run, 55+, after birth, muscle
  gain, HIIT, Zone 2, Soft 30…) with make-up days, free misses, milestone stars, badges and a guilt-free break.
- **1,043 exercises** with drawn animated demos, line drawings, photos and videos, and gym and home alternatives.
- **28 plans** fitted to exactly your days a week, from Full Body Foundations to 5x5, PHUL, home, pregnancy-safe and
  after-birth plans.
- **Fuel**: calorie and protein targets (Mifflin-St Jeor), a food logger with servings, yesterday and edits, a describe-a-
  meal estimate, protein suggestions, water in ml with your own glass size and goal, and supplements with reminder times.
- **Progress and Calendar**: this week, a month calendar with workout, watch, rest, excused and missed days, calories
  burned by source, strength, body weight, body and watch trends, recovery and achievements.
- **Watches**: Fitbit / Pixel, WHOOP, Samsung, Garmin, Oura and more through Health Connect, with a clear data-path connect
  flow and a **Tracker** screen; live heart rate from straps and broadcasting watches over Bluetooth; Colmi rings; file
  import (FIT, Google Takeout, GPX, TCX, Strong, Hevy, FitNotes).
- **Reminders**: workouts, missed-workout and streak nudges, weekly recap, meals, water, supplements, desk breaks, quiet
  hours.
- **Safety**: a Safety and disclaimer page and short notes where you commit to a plan, a challenge or a supplement.

See [docs/PLAN.md](docs/PLAN.md) for the full plan and what was borrowed from each reference repo.

## Develop

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `w` for the web preview.
`npm run check` validates plan exercise ids; `npm run data` rebuilds the exercise list.

## Credits

Exercise data and images: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain).

Line-art demos: [workout-guide](https://github.com/bryllim/workout-guide) by Bryl Lim, illustrations licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (adapted from [Everkinetic](https://github.com/everkinetic/data), CC BY-SA 4.0), code MIT. Frames are loaded unmodified from jsDelivr at a pinned commit.

Exercise videos: [wger.de](https://wger.de) exercise videos, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), by the authors listed in `src/data/videos.json` (credited under each video in the app). They are re-encoded to muted 480p H.264 (otherwise unchanged) by `.github/workflows/media.yml` and served from the `media` release.

Muscle map: body outlines from [MuscleMap](https://github.com/melihcolpan/MuscleMap) by Melih Colpan (MIT), converted to plain SVG paths in `src/data/bodyPaths.ts`.
