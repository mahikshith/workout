// Runs the assert-based self-checks of the pure logic (streaks, targets, women's context, engine rules, muscles).
// Usage: node --experimental-strip-types scripts/selfcheck.mjs
import { register } from 'node:module';
register('./ts-loader.mjs', import.meta.url);
const { byId } = await import(new URL('../src/data/exercises.ts', import.meta.url));
for (const m of ['../src/calc.ts', '../src/engine.ts', '../src/data/muscles.ts', '../src/data/order.ts', '../src/data/program.ts']) {
  (await import(new URL(m, import.meta.url))).selfCheck(byId);
  console.log('ok', m);
}
