// Mirrors every exercise photo (free-exercise-db, public domain), line drawing (workout-guide, CC BY-SA 4.0)
// and video (wger, CC BY-SA 4.0, from our `media` release) into dist/media, so the app loads them from GitHub Pages.
// Runs in the web job after `expo export`. Usage: node scripts/media.mjs [outDir]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const out = process.argv[2] ?? 'dist/media';
const ex = JSON.parse(readFileSync('src/data/exercises.json', 'utf8'));
const videos = JSON.parse(readFileSync('src/data/videos.json', 'utf8'));
const IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const WG = 'https://cdn.jsdelivr.net/gh/bryllim/workout-guide@aac599224bb9780305239607ef98540b7e0ce389/packages/workout-guide/assets/';

const jobs = [];
for (const e of ex) {
  if (!(e.noPhoto || e.noImages)) for (const n of [0, 1]) jobs.push([`${IMG}${e.id}/${n}.jpg`, `photo/${e.id}/${n}.jpg`]);
  if (e.art) for (const n of [1, 2, 3]) jobs.push([`${WG}${e.art}/frame-${n}.svg`, `art/${e.art}/frame-${n}.svg`]);
}
for (const [id, v] of Object.entries(videos)) jobs.push([v.url, `video/${id}.mp4`]);

let failed = 0;
async function get([url, path]) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      mkdirSync(dirname(`${out}/${path}`), { recursive: true });
      writeFileSync(`${out}/${path}`, Buffer.from(await r.arrayBuffer()));
      return;
    } catch (err) {
      if (i === 3) { failed++; console.log(`::warning::media ${path}: ${err.message}`); }
      else await new Promise((res) => setTimeout(res, 1000 * 2 ** i));
    }
  }
}
const queue = [...jobs];
await Promise.all(Array.from({ length: 24 }, async () => { while (queue.length) await get(queue.shift()); }));
console.log(`media: ${jobs.length - failed}/${jobs.length} files`);
if (failed > jobs.length * 0.02) process.exit(1);
