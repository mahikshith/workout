// Runs the assert-based self-checks of the pure logic (streaks, targets, women's context, engine rules).
// Usage: node --experimental-strip-types scripts/selfcheck.mjs
import { register } from 'node:module';
register('./ts-loader.mjs', import.meta.url);
for (const m of ['../src/calc.ts', '../src/engine.ts']) {
  (await import(new URL(m, import.meta.url))).selfCheck();
  console.log('ok', m);
}
