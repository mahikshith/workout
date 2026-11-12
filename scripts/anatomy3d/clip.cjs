// clip.cjs <exercise> <outprefix> <data> [size] : renders a 3-rep clip with camera moves, pulse and angle labels
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [name, out, data = 'web_own', size = '560'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +size, height: +size } }); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:8090/web/index.html?size=' + size + '&data=' + data); await p.waitForFunction('window.ready', null, { timeout: 180000 });
  // one rep: 2 s down, short hold, 2 s up, 1 s rest at the top while the camera moves. 12.5 frames a second.
  const REPS = 3, PER = +(process.argv[6] || 68), N = REPS * PER;
  for (let i = 0; i < N; i++) {
    const ph = (i % PER) / PER, e = (x) => x * x * (3 - 2 * x), t = ph < 0.37 ? e(ph / 0.37) : ph < 0.445 ? 1 : ph < 0.815 ? 1 - e((ph - 0.445) / 0.37) : 0;
    const d = await p.evaluate(([n, t, g, pu]) => window.draw2(n, t, g, pu), [name, t, i / N, 0.5 - 0.5 * Math.cos(2 * Math.PI * i / 11)]);
    fs.writeFileSync(`${out}-${String(i).padStart(3, '0')}.png`, Buffer.from(d.split(',')[1], 'base64'));
  }
  await b.close();
})();
