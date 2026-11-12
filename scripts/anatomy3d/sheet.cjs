// sheet.cjs <all.json from dump.mjs> <live.html> <out dir> [workers] : pictures of every distinct movement at its start
// and end, for checking the 3D figure against the exercise names. Writes <out>/shots/<n>a.jpg (start), <n>b.jpg (end) and <out>/index.json.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [allF, page, out, workers = '4'] = process.argv.slice(2);
const all = JSON.parse(fs.readFileSync(allF, 'utf8'));
const key = (e) => JSON.stringify({ ...e.pose, guide: 0, weak: 0 });
const groups = new Map(); for (const e of all) { const k = key(e); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
const list = [...groups.values()].map((g, i) => ({ n: i, pose: g[0].pose, primary: g[0].primary, secondary: g[0].secondary, names: g.map((e) => e.name), ids: g.map((e) => e.id), weak: g.filter((e) => e.weak).length, mismatch: g.filter((e) => e.mismatch).length }));
fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(list.map(({ pose, ...r }) => ({ ...r, view: pose.view, ground: pose.ground, prop: pose.prop }))));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let next = 0;
  const work = async () => {
    const p = await b.newPage({ viewport: { width: 260, height: 260 } });
    p.on('pageerror', (e) => console.log('ERR', e.message));
    await p.goto('file://' + path.resolve(page) + '#bare=1'); await p.waitForFunction('window.show', null, { timeout: 120000 });
    for (;;) {
      const it = list[next++]; if (!it) break;
      const f = (k) => path.join(out, 'shots', it.n + k + '.jpg'); if (fs.existsSync(f('b'))) continue;
      try {
        await p.evaluate((sp) => { window.show(sp); window.hold(0); }, { name: it.names[0], pose: it.pose, primary: it.primary, secondary: it.secondary });
        await p.waitForTimeout(300); await p.screenshot({ path: f('a'), type: 'jpeg', quality: 75 });
        await p.evaluate(() => window.hold(1));
        await p.waitForTimeout(300); await p.screenshot({ path: f('b'), type: 'jpeg', quality: 75 });
      } catch (e) { console.log('FAIL', it.n, it.names[0], String(e.message).slice(0, 150)); }
    }
    await p.close();
  };
  await Promise.all(Array.from({ length: +workers }, work));
  await b.close(); console.log('done', list.length);
})();
