// shot.cjs <exercise> <outprefix> <t,t,...> [size] [az]
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [name, out, ts, size = '720', az] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +size, height: +size } }); p.on('pageerror', (e) => console.log('ERR', e.message)); p.on('console', (m) => m.type() === 'error' && console.log('C', m.text()));
  await p.goto('http://localhost:8090/web/index.html?size=' + size); await p.waitForFunction('window.ready', null, { timeout: 180000 });
  let i = 0; for (const t of ts.split(',')) { const t0 = Date.now(); const d = await p.evaluate(([n, t, az]) => window.draw(n, t, az), [name, +t, az != null ? +az : null]); fs.writeFileSync(`${out}-${String(i++).padStart(2, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')); console.log(t, Date.now() - t0, 'ms'); }
  await b.close();
})();
