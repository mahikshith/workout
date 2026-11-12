# 3D anatomy clips (trial)

Two exercises (Bodyweight Squat, Butterfly) have a "3D" view: a muscle and bone figure that performs the movement,
with the working muscles in red. The clips are animated WebP files in `assets/anatomy/`, named by exercise id, and
are listed in `ANATOMY` in `src/ui.tsx`.

## Model and licence

The meshes are BodyParts3D release 4.0 (356 muscles, 200 bones, cartilage, skin for head, hands and feet).
Credit line, required wherever the clips are shown: "BodyParts3D, © The Database Center for Life Science licensed
under CC Attribution 4.0 International". The archive README (updated 2025-02) states CC BY 4.0; the OBJ file
headers still carry the older CC BY-SA 2.1 Japan text. Both allow commercial use with credit. The older one would
also ask that the clips themselves stay under the same licence, which does not affect the app's own code.

The dataset has no rectus abdominis, latissimus dorsi or face muscles. The abdomen and lats are filled with patches
cut from the skin surface, and the head, hands and feet use the skin.

## How a clip is made

1. Download and unpack `isa_BP3D_4.0_obj_99.zip` and `isa_element_parts.txt` from
   https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/ into a folder `bp3d/`.
2. `python3 load.py bp3d .` reads the parts into arrays.
3. `python3 build.py` finds the joint centres from the bones and gives every vertex weights for up to two body
   segments (17 segments). It writes `web/*.bin` and `web/meta.json`.
4. `npm i three@0.170.0`, `node serve.cjs`, then `node shot.cjs <exercise> out/<name> <t,t,...> 640` renders frames
   with three.js in headless Chromium. Exercises (pose, camera, highlighted muscles, equipment) are in `EX` in
   `web/main.js`. A new exercise is a new entry there: joint rotations at the start and end of the rep.
5. The frames are cropped, scaled to 440 px and saved as a looping WebP (about 400 KB each).

## Known limits

Simple two-segment skinning: shoulders and hips crease at extreme angles, fingers do not grip, the shoulder blade
does not move. Good enough to judge the style; a production pass would add a shoulder-girdle segment and finger joints.
