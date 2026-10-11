// Fails if a plan references an exercise id that is not in src/data/exercises.json.
import { readFileSync } from 'node:fs';
const ids = new Set(JSON.parse(readFileSync(new URL('../src/data/exercises.json', import.meta.url))).map((e) => e.id));
const plans = readFileSync(new URL('../src/data/plans.ts', import.meta.url), 'utf8');
const used = [...plans.matchAll(/x\('([^']+)'/g)].map((m) => m[1]);
const missing = used.filter((id) => !ids.has(id));
if (missing.length) { console.error('missing ids:', missing); process.exit(1); }
console.log(`ok: ${used.length} plan entries, all ids exist`);
