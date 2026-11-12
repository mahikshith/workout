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
A new exercise is a new entry in `EX`: the joint rotations at the start and end of the rep, the muscle groups to
highlight, the camera angles and the two angles to label.

## reference/

Study material only; nothing in it ships. `load.py` and `build.py` read the open BodyParts3D 4.0 model, and
`measure.py` takes coarse measurements from it (muscle lengths, widths, attachment regions, body proportions), listed
in `reference.md`. Those numbers were used to check our proportions. The mesh itself is not copied.

## Known limits

Fingers do not wrap around handles, the shoulder blade does not move, and joints are simple two-segment blends, so the
hip and knee are plain at the deepest part of a squat. Clips are large for what they are; the planned next step is to
draw the figure live in the app, which makes slow motion, pause and free rotation possible and needs one model for all
exercises.
