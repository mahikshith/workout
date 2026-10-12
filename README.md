# Gym Buddy

An offline-first workout companion for Android (iOS later from the same code). It logs every set,
shows an animated demo for each exercise, swaps exercises when a machine isn't available, adapts
plans to your gender, age, goal, place and diet, and nudges you to keep your streak.

## Get the app

Every push to `main` builds a fresh APK. Download `gym-buddy.apk` from the
[latest release](https://github.com/mahikshith/workout/releases/tag/latest) and open it on your phone
(allow installs from your browser when Android asks).

## What's inside

- **Onboarding** that asks name, gender, age, height, weight, goal, experience, where you train,
  home equipment, days per week, diet and reminder time, then picks a plan.
- **Today**: streak, week strip, the next session in your plan, a Gym/Home switch that swaps
  exercises automatically, a coach nudge, today's food rings and quick sessions (Kegels, mobility, cardio).
- **Live session**: previous weights pre-filled, steppers, tap-to-complete with haptics, rest ring
  with ±15 s, swap or add exercises mid-workout, PR detection and a celebration summary.
- **878 exercises** with looping demos, steps, muscles and 3 gym + 3 home alternatives each.
- **9 plans**: Full Body, Push Pull Legs, Upper/Lower, Lower Body Sculpt, Home No Equipment,
  Home Dumbbells & Bands, Sweat Circuit, Pelvic Floor & Kegels, Mobility.
- **Progress**: weekly volume, 12-week heatmap, body-weight trend against your goal, muscle split, top lifts.
- **Fuel**: calorie and protein targets (Mifflin-St Jeor), diet-aware quick add, water tracker.
- **Nudges**: daily reminder plus a streak-at-risk alert.

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
