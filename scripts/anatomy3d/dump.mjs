// dump.mjs <out.json> : every exercise with the movement data the 3D figure is driven by, for sheet.cjs.
// Run from the repo root: node --experimental-strip-types --no-warnings scripts/anatomy3d/dump.mjs out.json
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
register('../ts-loader.mjs', import.meta.url);
const { exercises } = await import(new URL('../../src/data/exercises.ts', import.meta.url));
const { poseFor, postureMismatch, POSES } = await import(new URL('../../src/data/poses.ts', import.meta.url));
const out = exercises.filter((e) => !e.noImages || POSES[e.id]?.d3).map((e) => {
  const { pose, matched } = poseFor(e);
  return { id: e.id, name: e.name, equipment: e.equipment, primary: e.primary, secondary: e.secondary, pose, own: e.id in POSES, matched, weak: !!pose.weak, mismatch: postureMismatch(e) };
});
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(out.length, 'exercises');
