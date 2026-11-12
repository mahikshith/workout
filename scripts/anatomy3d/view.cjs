// view.cjs <data dir> <out.png> <az deg> <el> <dist mm> <tx> <ty> <tz> [size] [exercise] [t]
// Renders the figure from a free camera. az: 0 front, 90 the figure's left side, 180 back. With FOV 22 deg, dist 4600 shows the whole body
// (target 0,0,900); dist 1800 shows about a 700 mm tall region.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [data, out, az, el, dist, tx, ty, tz, size = '800', name = 'rest', t = '0'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +size, height: +size } }); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:8090/web/index.html?size=' + size + '&data=' + data); await p.waitForFunction('window.ready', null, { timeout: 180000 });
  const d = await p.evaluate((a) => window.view(...a), [+az, +el, +dist, +tx, +ty, +tz, name, +t]);
  const { PNG } = {}; const buf = Buffer.from(d.split(',')[1], 'base64');
  // flatten onto white so the picture is easy to read
  await p.setContent(`<body style="margin:0;background:#fff"><img src="${d}"></body>`); await p.screenshot({ path: out, clip: { x: 0, y: 0, width: +size, height: +size } });
  await b.close();
})();
