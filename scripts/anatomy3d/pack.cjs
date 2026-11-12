// pack.cjs <data dir> <out.html> : packs the live viewer (web/live.js), three.js and the figure into one page for the app.
// Needs `npm i three esbuild` next to this file. The data is made smaller on the way: positions as 0.1 mm steps,
// one byte per skin weight, fibre data as 16-bit steps.
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');
const [data = 'web_own3', out = '../../assets/anatomy/live.html'] = process.argv.slice(2);
const rd = (f, T) => { const b = fs.readFileSync(path.join(data, f)); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const meta = JSON.parse(fs.readFileSync(path.join(data, 'meta.json'), 'utf8'));
const V = rd('V.bin', Float32Array), F = rd('F.bin', Uint32Array), bi = rd('bi.bin', Uint8Array), bw = rd('bw.bin', Float32Array), fib = rd('fib.bin', Float32Array);
// ---- fingers. The generated hand is one stiff piece; here the four fingers get two joints each side (knuckles and
// the middle joint), so the live figure can close its hands around a handle. The thumb stays with the palm.
// Hand frame as in extremities.py: x across the palm (thumb side +), y out of the back of the hand, z towards the wrist.
{
  const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); }, dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const w = unit([18, -12, -255]), u = unit([1 - w[0] * w[0], -w[0] * w[1], -w[0] * w[2]]), vv = cross(w.map((x) => -x), u), o = [244, -12, 885];
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const world = (q, sg) => [sg * (o[0] + q[0] * u[0] + q[1] * vv[0] - q[2] * w[0]), o[1] + q[0] * u[1] + q[1] * vv[1] - q[2] * w[1], o[2] + q[0] * u[2] + q[1] * vv[2] - q[2] * w[2]];
  meta.curl = {}; meta.palm = {};
  for (const [S, sg] of [['L', 1], ['R', -1]]) {
    const hand = meta.seg.indexOf(S + 'hand'), f1 = meta.seg.length, f2 = f1 + 1; meta.seg.push(S + 'fing1', S + 'fing2');
    meta.joints[S + 'mcp'] = world([0, 2, -97], sg); meta.joints[S + 'pip'] = world([0, 2, -143], sg);
    // turning about this axis by a positive angle closes the fingers towards the palm
    const ax = cross(u, w), toPalm = dot(ax, vv.map((x) => -x)) > 0 ? u : u.map((x) => -x); meta.curl[S] = sg > 0 ? toPalm : [toPalm[0], -toPalm[1], -toPalm[2]]; // a turning axis mirrors with the opposite sign
    meta.palm[S] = world([0, -30, -90], sg).map((x, i) => x - meta.joints[S + 'wr'][i]); // middle of the closed hand, from the wrist
    const part = meta.parts.find((p) => p.name === S + 'hand'); if (!part) throw new Error('no hand part ' + S);
    for (let i = part.v0; i < part.v0 + part.nv; i++) {
      const d = [sg * V[i * 3] - o[0], V[i * 3 + 1] - o[1], V[i * 3 + 2] - o[2]], x = dot(d, u), z = -dot(d, w);
      const zm = -97 - 0.18 * x, zp = zm - 46; if (x > 46 || z > zm + 9) continue; // palm and thumb stay as they are
      if (z > zp + 8) { const k = ss(zm + 9, zm - 9, z); bi[i * 2] = hand; bi[i * 2 + 1] = f1; bw[i * 2] = 1 - k; bw[i * 2 + 1] = k; }
      else { const k = ss(zp + 8, zp - 8, z); bi[i * 2] = f1; bi[i * 2 + 1] = f2; bw[i * 2] = 1 - k; bw[i * 2 + 1] = k; }
    }
  }
}
const Vq = Int16Array.from(V, (x) => Math.round(x * 10));
const Wq = new Uint8Array(meta.n); for (let i = 0; i < meta.n; i++) Wq[i] = Math.round(bw[i * 2] * 255);
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < fib.length; i++) { const k = i % 3; if (fib[i] < lo[k]) lo[k] = fib[i]; if (fib[i] > hi[k]) hi[k] = fib[i]; }
const Fq = new Uint16Array(fib.length); for (let i = 0; i < fib.length; i++) { const k = i % 3; Fq[i] = Math.round((fib[i] - lo[k]) / (hi[k] - lo[k] || 1) * 65535); }
// only what the viewer reads
const slim = { n: meta.n, joints: meta.joints, seg: meta.seg, ground: meta.ground, curl: meta.curl, palm: meta.palm, parts: meta.parts.map((p) => ({ kind: p.kind, groups: p.groups, v0: p.v0, nv: p.nv })) };
const A = { meta: slim, V: b64(Vq), F: b64(F), bi: b64(bi), bw: b64(Wq), fib: b64(Fq), fibLo: lo, fibHi: hi };
const code = esbuild.buildSync({ entryPoints: [path.join(__dirname, 'web/live.js')], bundle: true, minify: true, format: 'iife', write: false, target: 'es2019', nodePaths: [path.join(process.cwd(), 'node_modules'), ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)] }).outputFiles[0].text;
const page = fs.readFileSync(path.join(__dirname, 'web/live.html'), 'utf8').replace('/*DATA*/', () => JSON.stringify(A)).replace('/*CODE*/', () => code.replace(/<\/script/g, '<\\/script'));
fs.writeFileSync(out, page); console.log(out, (page.length / 1e6).toFixed(2) + ' MB');
