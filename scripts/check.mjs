// Fails if a plan or quick session references an exercise id that is not in src/data/exercises.json,
// or if src/data/guide.json describes an unknown exercise.
import { existsSync, readFileSync } from 'node:fs';
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const ids = new Set(JSON.parse(read('../src/data/exercises.json')).map((e) => e.id));
let bad = [], n = 0;
for (const f of ['../src/data/plans.ts', '../src/data/quick.ts']) {
  const used = [...read(f).matchAll(/x\('([^']+)'/g)].map((m) => m[1]);
  n += used.length;
  bad.push(...used.filter((id) => !ids.has(id)).map((id) => `${f}: ${id}`));
}
if (existsSync(new URL('../src/data/guide.json', import.meta.url)))
  bad.push(...Object.keys(JSON.parse(read('../src/data/guide.json'))).filter((id) => !ids.has(id)).map((id) => `guide.json: ${id}`));
if (bad.length) { console.error('unknown exercise ids:', bad); process.exit(1); }
console.log(`ok: ${n} plan and quick entries, all ids exist`);
