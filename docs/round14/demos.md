# Round 14: demos (animations and line drawings)

Owner's complaint: "for standing it is showing sitting, for sitting some are showing standing; and the hand drawings:
for a lot of exercises the white outlines are too thick ... a bit off, not properly handled."

## Where each demo kind comes from

| Kind | Source | Licence | Pinned | How it reaches the phone |
| --- | --- | --- | --- | --- |
| Animated | Our own code: `src/figure.tsx` draws, `src/data/poses.ts` holds the poses and `poseFor(ex)` picks one | ours | in the repo | inside the app |
| Drawing | github.com/bryllim/workout-guide, `packages/workout-guide/assets/<slug>/frame-1..3.svg` (based on Everkinetic) | CC BY-SA 4.0 | commit `aac599224bb9780305239607ef98540b7e0ce389` | **new:** inside the app, `src/data/art/<slug>.json`, built by `scripts/art.mjs` |
| Photo | github.com/yuhonas/free-exercise-db, `exercises/<id>/0.jpg, 1.jpg` | public domain | `main` | mirrored to GitHub Pages by `scripts/media.mjs` (web job, on merge to main) |
| Video | wger.de, transcoded into our `media` release | CC BY-SA 4.0 | `src/data/videos.json` | mirrored the same way |

## A. Animations: posture audit

Method: `postureOf(pose, 0|1)` in poses.ts reads the posture off the solved joints (pelvis, knee, hand clearance above
the floor, spine angle, `ground`): stand, bent, seat, recline, lean (chest on an incline), kneel, allfours, plank,
supine, prone, side, hang, inverted. `wantPosture(ex)` reads what the exercise asks for from its name, then from the
first two instruction steps, with a short table of ids the wording misleads (`WANT_ID`). `postureMismatch(ex)`
compares them through `POSTURE_OK` (an incline bench counts as seated-reclined, a hinge as standing, and so on).

Counts (1043 exercises, 20 breathing drills without a figure):

- 1023 poses audited. 134 are `weak` (a borrowed movement): the app never shows those, it shows the photo.
- Of the 889 shown: 726 have an expectation from name or steps, 163 have none (mostly `wg_` moves without steps and
  names with no posture word); those 163 were read by hand from the list and the wrong ones given name rules.
- First run: **123 mismatches** against the rules (about 95 real, the rest were rule or classifier noise). Typical:
  every lat pulldown, every seated or machine shoulder press, seated curls and lateral raises drew a standing figure;
  machine chest presses and the ab crunch machine drew one lying down; kneeling cable work stood; lying triceps
  extensions stood; standing leg curl lay prone; Shotgun Row and the standing medicine ball twist sat.
- Now: **0 mismatches**. 106 exercises show a different (corrected) figure, 5 more are now `weak` because no honest
  side or front view exists (Dumbbell_Seated_Box_Jump, Lying_One-Arm_Lateral_Raise, Reverse_Flyes,
  Reverse_Flyes_With_External_Rotation, Weighted_Ball_Side_Bend): they show the photo.

What changed in `src/data/poses.ts`:

- `adapt()`: when the instructions seat or kneel an upper-body move whose legs do nothing, the legs fold onto a bench,
  the floor, or the knees (half-kneeling too) and the arms and trunk keep their movement. This fixes whole families
  (presses, pulldowns, curls, raises, extensions) instead of one id at a time, also for direct `POSES` entries.
- Front view seated: new `sit` flag; thighs point at the camera so they are drawn short, shins hang, a wider seat.
- 28 new poses (`f_pulldown_side`, `f_seated_crunch`, `f_dip_machine`, `f_machine_press`, `f_calf_press`,
  `f_incline_raise`, `f_incline_skull`, `f_seated_kickback`, `f_seated_gm`, `f_chair_ham`, `f_kneel_squat`,
  `f_kneel_jump`, `f_gorilla`, `f_prone_row`, `f_standing_leg_curl`, `f_hip_flexor_stand`, `f_ham_walkout`,
  `f_fallout`, `f_renegade`, `f_stand_twist`, `f_low_row_one`, `f_svend`, `f_antigravity`, `f_wrist_bench`,
  `f_swim`, `f_high_plank`, ...) and about 45 name rules at the top of `pattern()`.
- Plank: the forearms floated 9 units above the floor; they now rest on it.
- `selfCheck` now fails on any posture mismatch of a shown figure, and runs the joint-limit and feet-through-floor
  checks on the adapted poses too (before, only the hand-made `POSES` were checked).

Justified leftovers (in `WANT_ID`, each with its reason): Glute_Ham_Raise (face down but on the knee pad: kneel),
Quadriceps-SMR (face down on the forearms: plank), Wind_Sprints (a hanging drill despite the name), Barbell_Ab_Rollout
(the steps start from a push-up position; the figure rolls out from the knees).

Exercises whose figure changed (106):
Ab_Crunch_Machine Alternating_Renegade_Row Anti-Gravity_Press Arnold_Dumbbell_Press Barbell_Shoulder_Press Bradford_Rocky_Presses Cable_Incline_Triceps_Extension Cable_Rope_Rear-Delt_Rows Cable_Seated_Crunch Cable_Seated_Lateral_Raise Calf_Press Chain_Handle_Extension Chair_Leg_Extended_Stretch Chest_Push_multiple_response Chest_Push_single_response Close-Grip_Dumbbell_Press Close-Grip_EZ-Bar_Press Close-Grip_Front_Lat_Pulldown Decline_Dumbbell_Triceps_Extension Decline_EZ_Bar_Triceps_Extension Dip_Machine Drop_Push Dumbbell_Incline_Row Dumbbell_One-Arm_Shoulder_Press Dumbbell_One-Arm_Triceps_Extension Dumbbell_Prone_Incline_Curl Dumbbell_Shoulder_Press Dumbbell_Tricep_Extension_-Pronated_Grip Forward_Drag_with_Press Front_Incline_Dumbbell_Raise Full_Range-Of-Motion_Lat_Pulldown Gorilla_Chin_Crunch Hamstring_Stretch Incline_Barbell_Triceps_Extension Incline_Push-Up_Depth_Jump Kettlebell_Seated_Press Kneeling_Cable_Crunch_With_Alternating_Oblique_Twists Kneeling_Cable_Triceps_Extension Kneeling_High_Pulley_Row Kneeling_Jump_Squat Kneeling_Single-Arm_High_Pulley_Row Kneeling_Squat Leg_Lift Leverage_Chest_Press Leverage_Decline_Chest_Press Leverage_Incline_Chest_Press Leverage_Shoulder_Press London_Bridges Low_Cable_Triceps_Extension Low_Pulley_Row_To_Neck Lying_Cambered_Barbell_Row Lying_T-Bar_Row Machine_Bench_Press Machine_Bicep_Curl Machine_Shoulder_Military_Press Machine_Triceps_Extension Medicine_Ball_Full_Twist One_Arm_Lat_Pulldown One_Arm_Pronated_Dumbbell_Triceps_Extension One_Arm_Supinated_Dumbbell_Triceps_Extension Overhead_Triceps Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench Palms-Down_Wrist_Curl_Over_A_Bench Palms-Up_Barbell_Wrist_Curl_Over_A_Bench Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench Plank Reverse_Machine_Flyes Rope_Crunch Seated_Barbell_Military_Press Seated_Bent-Over_One-Arm_Dumbbell_Triceps_Extension Seated_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension Seated_Cable_Shoulder_Press Seated_Dumbbell_Curl Seated_Dumbbell_Inner_Biceps_Curl Seated_Dumbbell_Press Seated_Flat_Bench_Leg_Pull-In Seated_Good_Mornings Seated_One-arm_Cable_Pulley_Rows Seated_Overhead_Stretch Seated_Side_Lateral_Raise Seated_Triceps_Press Shotgun_Row Smith_Machine_Overhead_Shoulder_Press Standing_Hip_Flexors Standing_Leg_Curl Suspended_Fallout Svend_Press Underhand_Cable_Pulldowns V-Bar_Pulldown Wide-Grip_Lat_Pulldown Wide-Grip_Pulldown_Behind_The_Neck wg_chest-supported-row wg_machine-row wg_lat-pulldown wg_machine-lateral-raise wg_half-kneeling-pallof-press wg_push-up-shoulder-tap wg_chair-dip wg_lying-hamstring-walkout wg_towel-hamstring-curl wg_stability-ball-hamstring-curl wg_plank-shoulder-tap wg_plank-jack wg_bear-plank wg_seated-knee-tuck wg_copenhagen-plank

## B. Looking at them

Contact sheets (start, middle, end of the rep), rendered from the same geometry functions the app uses, plus real
app screenshots at 393 x 851, dark and light. In /mnt/project-files/round14/demos/ :

- `poses-fixed-before-1.png`, `poses-fixed-before-2.png` / `poses-fixed-after-1.png`, `poses-fixed-after-2.png`
- `poses-sample60.png`: 60 random other poses. Found there and fixed: Close-Grip Dumbbell Press stood (it lies on a
  bench), Reverse Machine Flyes stood (seated machine).
- `app-screens-after.png`, `app-lat-pulldown-after.png`: the real app.
- A sweep over all 831 distinct shown poses: no joint out of range, nothing below the floor, no oversized frame.

## C. Drawings: what was actually wrong

The files have **no strokes**. Each frame is one white filled path traced from a bitmap in a 512 box, so there is no
stroke width to set and `vector-effect` cannot apply. Measured on all 906 frames (mean line width = 2 x area /
outline length): 2.1 (p10), 3.8 (median), 5.5 (p90), up to 13 units. Worse, **in 131 of the 302 drawings one of the
three frames is 2 to 4 times heavier than the other two** (usually the middle one, e.g. bench-press 3.1 / 7.0 / 3.4,
lat-pulldown 3.7 / 11.4 / 3.9), so the picture pulsed thick and thin while it played; a few frames are near-empty
speckle (pallof-press frame 2) or drawn at another scale. And the fill is hard-coded white, invisible on the light
theme's card (pane and thumbnails).

Fix:

- `scripts/art.mjs` (new) downloads the pinned originals, measures every frame, and writes `src/data/art/<slug>.json`
  `{ b: square crop shared by the frames, k: knock-out width per frame, d: paths re-encoded to one decimal }` plus
  `index.ts` (one lazy `require` per drawing). 30 frames that cannot be rescued are left out (those drawings play
  two poses); the list is printed by the script.
- `src/ui.tsx`: `Drawing` / `ArtSvg` draw the path with react-native-svg (the renderer the animated figure already
  uses on Android), filled in `c.text` and stroked in the pane colour by `k`, which trims k/2 off both sides of each
  line, so every frame of every drawing comes out about 2.4/512 of the pane wide (about 1 dp). Faint frames get a
  hairline of the text colour instead. Light theme: near-black lines on the light pane; `Thumb` uses the same
  component, so list thumbnails are visible on light too.
- expo-image no longer decodes SVG at all, so the Android/web SVG decoder difference is out of the picture.
- Bundled, not mirrored: drawings work offline and in the APK built from this branch (the mirror only rebuilds on
  merge to main). `scripts/media.mjs` no longer mirrors art. The cloud icon and "Needs internet once" hint are gone
  for drawings.
- Cost: 300 files, 17.2 MB of JSON in the repo (25.7 MB originals). The Android Hermes bundle built with
  `expo export -p android` is 25 MB with them (9 MB gzipped); the drawings are about 17 MB of it uncompressed, about
  6 MB compressed. Whether the APK grows by 17 or by 6 MB depends on whether Gradle compresses the bundle; not measured.

## D. Drawing matched to the wrong exercise

All 300 drawings were looked at next to the exercise names (`drawings-all-dark-1..3.png`, `drawings-all-light-1..3.png`).
150 belong to their own `wg_` exercise; 162 were matched to dataset exercises by name or alias. Wrong posture, fixed
in `scripts/build-exercises.mjs` and `src/data/exercises.json`:

- `wrist-curl` is drawn standing: removed from Palms-Up_Barbell_Wrist_Curl_Over_A_Bench and Seated_Palm-Up_Barbell_Wrist_Curl.
- `arnold-press` is drawn standing, the instructions sit: removed from Arnold_Dumbbell_Press.
- `single-arm-cable-row` is drawn standing: moved from Seated_One-arm_Cable_Pulley_Rows to Shotgun_Row.
- `dumbbell-overhead-tricep-extension` is drawn seated: moved from Standing_Dumbbell_Triceps_Extension to Seated_Triceps_Press.

Before/after of the line weight: `drawings-before-after.png`.

## Not done / not verified

- Nothing here ran on a real Android phone. The Android JS bundle builds; rendering was checked in the web build only.
  react-native-svg drawing a 10 to 30 KB path per frame should be fine (the figure is heavier), but list scrolling with
  many drawing thumbnails on a slow phone is untested.
- Some source drawings change artist, scale or camera between frames (e.g. dumbbell-sumo-squat, belt-squat); the weight
  is now even but the jump between frames remains.
- The 163 exercises with no posture expectation are only as right as a read of their names.
- A posture match does not prove the movement is right; 134 borrowed poses stay hidden behind the photo.
- `src/data/exercises.ts` still exports `artFrames` and the art branch of `origin`; unused now (not my file).
