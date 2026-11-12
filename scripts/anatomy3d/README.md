# 3D anatomy figure

Bodyweight Squat and Butterfly have a "3D" view: a muscle figure performs the movement. The working muscles pulse
red, helpers are light red, the camera shows three angles (one per rep, moving only while the figure rests), and two
angles are measured against a baseline (the floor, upright, or the line through the shoulders). The clips are animated
WebP files in `assets/anatomy/`, named by exercise id and listed in `ANATOMY` in `src/ui.tsx`.

## The model is ours

The figure is generated entirely by the code in this folder. It uses no outside mesh, so it needs no credit line and
has no licence conditions.

- `own3.py` builds the body: a torso and limbs with true (non-round) cross-sections, 17 body segments with joints, and
  the muscle sheets. Each sheet hugs the body surface along a path of control points; fibres, the groove at each
  sheet edge and the pale tendon ends are drawn by the shader from per-vertex fibre coordinates.
- `muscles3_upper.py` and `muscles3_lower.py` are the muscle tables (about 130 sheets per side, including tendons and
  connective tissue). The file headers explain the format.
- `extremities.py` generates the head, hands and feet from smooth distance fields.
- `web/main.js` poses the figure (joint rotations per exercise in `EX`), skins it, and renders with three.js.
  It also draws the angle baselines and labels.

## Making a clip

    npm i three@0.170.0 && node serve.cjs &          # serves this folder on :8090
    python3 own3.py --out web_own3                    # writes web_own3/*.bin and meta.json
    node view.cjs web_own3 out/check.png 20 0.12 4700 0 0 900     # still picture from any angle
    node clip.cjs squat out/sq web_own3 600           # 204 frames: three reps, 2 s down, hold, 2 s up, 1 s rest

The frames are scaled to 360 px and saved as a looping WebP at 12.5 frames a second (about 1.7 MB each).
A new exercise is a new entry in `web/moves.js`: the joint rotations at the start and end of the rep, the muscle groups to
highlight, the camera angles and the two angles to label.

## The live view

`node pack.cjs web_own3 ../../assets/anatomy/live.html` (needs `npm i three@0.170.0 esbuild`) packs `web/live.js`,
three.js and the figure into one page of about 7.5 MB. The app shows it in a web view when the user taps
"Explore in 3D" (`src/live3d.tsx`): drag to turn, pinch to zoom, Slow, Pause, Reset view. The phone's graphics chip
bends the figure, so it costs almost no processor time. It uses the same moves and angle labels as the clips
(`web/moves.js`). If the page cannot start (no WebGL, an error, or nothing drawn within 20 s) the app stays on the clip,
and a phone that draws it slowly gets a coarser picture.

## Every exercise in 3D

The live view can show any exercise the app's 2D animation can show. `web/drive.js` runs the app's own 2D solver
(`src/data/poses.ts`, with its limb lengths set to the 3D figure's) and turns each body segment to point the way its 2D
bone points: side views turn about the left-right axis, front views about the front-back axis, mat views lie on the
back. It adds the equipment the pose names (dumbbells, barbell, kettlebell, ball, plate, band or cable, pull-up and dip
bars, bench with back pad, box, wall, treadmill, leg-press plate, bike). The app passes `{ pose, primary, secondary }`
in the address (`#j=`), plus `name`, which only decides whether a kettlebell move uses one bell or two.

The app offers this 3D view where the movement data can be trusted (`has3d` in `src/ui.tsx`): not borrowed from another
movement, posture agreeing with the name and steps, and not listed in `src/data/no3d.ts`. To check the movements:

    node --experimental-strip-types --no-warnings scripts/anatomy3d/dump.mjs all.json   # from the repo root
    node scripts/anatomy3d/sheet.cjs all.json assets/anatomy/live.html sheets          # start and end picture of each distinct movement

### Hands and weights

`pack.cjs` adds two finger joints per hand, so a hand that holds something closes around it. `drive.js` decides the
grip once per exercise from the two ends of the move: curls are held palm up, a weight hanging at the side palm in,
everything else overhand, and the hand turns about its own long axis until the fingers wrap the way the handle runs.
Weights sit at the middle of the closed hand. A kettlebell hangs under the hand, or rests against the outside of the
wrist when the forearm is upright; a two-handed kettlebell move brings both hands to one handle. Hands on a fixed bar
stay on it while the body moves. A bar carried on the back leans with the shoulders.

### Movements only the 3D figure can show

Some movements leave the flat figure's drawing plane. Five optional fields on a pose (`src/data/poses.ts`) are read
only here: `twist` (the upper body turns about the spine), `tilt` (a front-view movement done bent over, or lying or
leaning chest down on a bench or the floor), `clasp` (both hands meet), `splay` (the near thigh opens to the side) and
`swing` (the forearm turns about the upper arm). Such a pose is marked `d3`: the 3D view shows it, while the flat
animation keeps treating it as borrowed and stays hidden. An arm that reaches across the body is swung in front of
the chest.

On 2026-11-12 all 516 distinct movements were looked at on sheets, and the 97 newly written ones one by one. 979
exercises pass; 38 still borrow a movement and keep their photo or drawing; 6 are listed in `no3d.ts`.

## reference/

Study material only; nothing in it ships. `load.py` and `build.py` read the open BodyParts3D 4.0 model, and
`measure.py` takes coarse measurements from it (muscle lengths, widths, attachment regions, body proportions), listed
in `reference.md`. Those numbers were used to check our proportions. The mesh itself is not copied.

## Known limits

The fingers close as one block (no separate fingers or thumb), the shoulder blade does not move, and joints are simple two-segment blends, so the
hip and knee are plain at the deepest part of a squat. The live view has only been tried in a desktop browser so far, not on a phone.
