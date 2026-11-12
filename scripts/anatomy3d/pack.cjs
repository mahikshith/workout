// pack.cjs <data dir> <out.html> : packs the live viewer (web/live.js), three.js and the figure into one page for the app.
// Needs `npm i three esbuild` next to this file. The data is made smaller on the way: positions as 0.1 mm steps,
// one byte per skin weight, fibre data as 16-bit steps.
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');
const [data = 'web_own3', out = '../../assets/anatomy/live.html'] = process.argv.slice(2);
const rd = (f, T) => { const b = fs.readFileSync(path.join(data, f)); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const meta = JSON.parse(fs.readFileSync(path.join(data, 'meta.json'), 'utf8'));
const V = rd('V.bin', Float32Array), F = rd('F.bin', Uint32Array), bi = rd('bi.bin', Uint8Array), bw = rd('bw.bin', Float32Array), fib = rd('fib.bin', Float32Array);
const Vq = Int16Array.from(V, (x) => Math.round(x * 10));
const Wq = new Uint8Array(meta.n); for (let i = 0; i < meta.n; i++) Wq[i] = Math.round(bw[i * 2] * 255);
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < fib.length; i++) { const k = i % 3; if (fib[i] < lo[k]) lo[k] = fib[i]; if (fib[i] > hi[k]) hi[k] = fib[i]; }
const Fq = new Uint16Array(fib.length); for (let i = 0; i < fib.length; i++) { const k = i % 3; Fq[i] = Math.round((fib[i] - lo[k]) / (hi[k] - lo[k] || 1) * 65535); }
// only what the viewer reads
const slim = { n: meta.n, joints: meta.joints, seg: meta.seg, ground: meta.ground, parts: meta.parts.map((p) => ({ kind: p.kind, groups: p.groups, v0: p.v0, nv: p.nv })) };
const A = { meta: slim, V: b64(Vq), F: b64(F), bi: b64(bi), bw: b64(Wq), fib: b64(Fq), fibLo: lo, fibHi: hi };
const code = esbuild.buildSync({ entryPoints: [path.join(__dirname, 'web/live.js')], bundle: true, minify: true, format: 'iife', write: false, target: 'es2019', nodePaths: [path.join(process.cwd(), 'node_modules'), ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)] }).outputFiles[0].text;
const page = fs.readFileSync(path.join(__dirname, 'web/live.html'), 'utf8').replace('/*DATA*/', () => JSON.stringify(A)).replace('/*CODE*/', () => code.replace(/<\/script/g, '<\\/script'));
fs.writeFileSync(out, page); console.log(out, (page.length / 1e6).toFixed(2) + ' MB');
