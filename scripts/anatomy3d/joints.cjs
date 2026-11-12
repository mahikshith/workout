// joints.cjs <all.json from dump.mjs> <live.html> <exercise id> [position 0..1] : where the 3D figure's joints are, in
// millimetres (x = the figure's left, y = back, z = up), at the start and the end of the move. Settles by numbers what
// a picture leaves unclear: is the hand on the floor, did the leg cross to the right side.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [allF, page, id, at] = process.argv.slice(2);
const e = JSON.parse(fs.readFileSync(allF, 'utf8')).find((x) => x.id === id);
if (!e) { console.log('no exercise', id); process.exit(1); }
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 380, height: 380 } }); p.on('pageerror', (er) => console.log('ERR', er.message));
  await p.goto('file://' + path.resolve(page) + '#bare=1'); await p.waitForFunction('window.show', null, { timeout: 120000 });
  for (const q of at != null ? [+at] : [0, 1]) {
    await p.evaluate(([sp, q]) => { window.show(sp); window.hold(q); }, [{ name: e.name, pose: e.pose, primary: e.primary, secondary: e.secondary }, q]); await p.waitForTimeout(300);
    const j = await p.evaluate(() => window.joints());
    console.log('at ' + q + '\n' + Object.entries(j).filter(([k]) => !k.includes('fing')).map(([k, v]) => '  ' + k.padEnd(8) + v.join(', ')).join('\n'));
  }
  await b.close();
})();
