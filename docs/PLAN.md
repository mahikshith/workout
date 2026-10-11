# Gym Buddy: plan

An offline-first Android app (iOS later from the same code) that logs sessions, guides each
exercise with animated demos, swaps exercises when equipment is missing, adapts plans to the
person (gender, age, place, goal, diet) and nudges them to keep going.

## Stack

| Choice | Why |
|---|---|
| Expo SDK 54 + React Native + TypeScript | One codebase for Android now and iOS later. Same stack as Omega, so its patterns translate. |
| expo-router (tabs + stacks) | File-based navigation, native transitions. |
| zustand + AsyncStorage persist | Whole app state as one JSON document, the way Open-GYM does it. No server, no account. |
| react-native-reanimated | 60 fps animations on the UI thread (demo frames, rest ring, press feedback). |
| expo-image | Disk-cached exercise frames. |
| expo-haptics, expo-notifications | Tactile set logging; daily reminders and nudges. |
| react-native-svg | Rings, charts, heatmap drawn by hand, no chart library. |
| GitHub Actions | Builds the release APK on every push, so no local Android SDK is needed. |

## Exercise data (licensing checked)

| Source | Licence | Use |
|---|---|---|
| yuhonas/free-exercise-db | Public domain | **Core library**: 873 exercises, 2 frames each, muscles, equipment, level, instructions. Frames crossfade into a looping demo. |
| bryllim/workout-guide | MIT code, CC BY-SA art | Candidate second art pack (3 frames, 302 exercises) with attribution. |
| gellyfish-ai/gymbells-exercises | CC BY-NC | Uses the same exercise ids as free-exercise-db and has a swap graph. Not bundled (non-commercial). Our own swap algorithm replaces it. |
| DuarteSantos8/openGym | AGPL code; media licensed from Gym visual | Borrow structure and features only. Media must not be copied. |
| ExerciseDB API | AGPL, hosted API | Skipped: needs a key and a server. |
| Hevy scraper | Scraped data | Skipped: Hevy's terms. |
| Open-GYM, Omega, My-Workouts | GPL / PolyForm NC / MIT | Design and feature reference only. |

Kegel and pelvic-floor drills are not in any dataset, so they are written in-house and shown with
an animated breathing/contract-relax guide instead of pictures.

## Features (v1)

1. **Onboarding**: name, gender, age, height, weight, goal (lose fat, build muscle, get stronger,
   stay fit), experience, where they train (gym, home, both), home equipment, days per week,
   diet (veg, vegan, eggetarian, non-veg, pescatarian), reminder time.
2. **Today**: greeting, streak flame, week strip, today's session card, quick stats, a nudge line.
3. **Plans**: templates by place and goal (PPL, upper/lower, full body, home bodyweight, dumbbell
   home, glutes and legs, pelvic floor/Kegels, mobility). Suggested plan picked from the profile.
   Gender only changes defaults; every plan is open to everyone.
4. **Exercise library**: search, muscle and equipment filters, home-only toggle.
5. **Exercise detail**: animated demo, steps, muscles, and 2–3 **alternatives** ranked for gym or
   home (same primary muscle and movement, available equipment first).
6. **Live session**: set rows with previous values pre-filled, steppers, tap to complete with a
   haptic, rest timer ring with ±15 s, swap any exercise mid-session, PR detection.
7. **Session summary**: volume, sets, time, PRs, celebration animation.
8. **Progress**: weekly volume chart, 12-week heatmap, body-weight trend vs goal, PR list,
   muscle split for the last 30 days.
9. **Nutrition**: calorie and protein targets (Mifflin-St Jeor and goal), quick-add meals filtered
   by diet type, water glasses.
10. **Nudges**: daily reminder notification, a missed-day nudge, streak milestones.

Later: gym edits from photos with templates (user parked this), iOS build, cloud backup.

## What we borrow, by repo

- **openGym**: weekday routine plus rotation idea, weights pre-filled from last time, PR detection,
  per-side reps, plate math later, starter plans, equipment filter.
- **Open-GYM**: body-map idea, places and gear presets, rest that uses an absolute deadline, heatmap,
  share cards (for the later edits feature), single-JSON state.
- **Omega**: monthly compliance calendar, streak pill, session summary numbers, Expo stack.
- **My-Workouts**: black UI with a neon lime accent, big photo-style day cards, horizontal date strip.
- **GymBells**: swaps, easier and harder variants as a concept.
- **workout_buddy**: home workout builder, countdown and congratulations moments, sounds.
- **reactjs18-fitness**: browse by body part, similar exercises by target and equipment.
- **Competitors**: Fitbod (equipment-aware plans, muscle recovery), Hevy and Strong (inline previous
  values, rest timer), Sweat (programs aimed at women), Future and Ladder (coach-style nudges),
  MyFitnessPal (calorie and macro targets).

## Design

OLED black base, one neon lime accent, warm secondary for rest states, large bold display numbers,
rounded 24 px cards, spring press feedback on every tappable surface, haptics on set completion.
Comfort first: thumb-reach primary buttons at the bottom, 48 px minimum targets, large type.
