// Builds the bundled line drawings: src/data/art/<slug>.json (+ index.ts), from workout-guide (CC BY-SA 4.0, based on
// Everkinetic) at the pinned commit. Run by hand when the `art` slugs in exercises.json change; the output is committed,
// so the APK and the web build need no network for drawings.
//   node scripts/art.mjs [cacheDir]      (cacheDir keeps the downloaded originals between runs)
//
// The originals are not strokes: each frame is ONE white filled path traced from a bitmap, in a 512 box, and the traced
// "line" is anywhere from 2 to 5+ units wide depending on the drawing, which is why some looked heavy in the app. Here
// every frame is measured (mean line width = 2 x filled area / outline length) and gets a knock-out width `k`: the app
// draws the path filled in the text colour and strokes it in the pane colour, which trims k/2 off both sides of every
// line, so all drawings come out the same weight. The three frames share one square crop `b` (their common extent), so
// small drawings fill the pane like large ones and the frames stay registered. Coordinates are re-encoded to one decimal.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const WG = 'https://cdn.jsdelivr.net/gh/bryllim/workout-guide@aac599224bb9780305239607ef98540b7e0ce389/packages/workout-guide/assets/';
const OUT = 'src/data/art';
const TARGET = 2.4; // line width aimed for, in units of a 512-wide crop (about 1 dp in the 216 dp demo pane)
const cache = process.argv[2];
const slugs = [...new Set(JSON.parse(readFileSync('src/data/exercises.json', 'utf8')).filter((e) => e.art).map((e) => e.art))].sort();

async function get(slug, n) {
  const file = cache && `${cache}/${slug}/frame-${n}.svg`;
  if (file && existsSync(file)) return readFileSync(file, 'utf8');
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(`${WG}${slug}/frame-${n}.svg`);
      if (!r.ok) throw new Error(String(r.status));
      const s = await r.text();
      if (file) { mkdirSync(`${cache}/${slug}`, { recursive: true }); writeFileSync(file, s); }
      return s;
    } catch (err) {
      if (i === 3) throw new Error(`${slug}/frame-${n}: ${err.message}`);
      await new Promise((res) => setTimeout(res, 1000 * 2 ** i));
    }
  }
}

// ---- path: parse to absolute segments ----
const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
function parse(d) {
  const out = []; // [cmd, ...absolute numbers]
  const re = /([a-zA-Z])|(-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?)/gi;
  let cmd = '', buf = [], x = 0, y = 0, sx = 0, sy = 0, m;
  const flush = () => {
    const k = cmd.toLowerCase(), rel = cmd === k, n = ARGS[k];
    if (k === 'z') { out.push(['Z']); x = sx; y = sy; return; }
    const a = buf.splice(0, n);
    if (k === 'h') { x = rel ? x + a[0] : a[0]; out.push(['L', x, y]); return; }
    if (k === 'v') { y = rel ? y + a[0] : a[0]; out.push(['L', x, y]); return; }
    if (k === 'a') { const ex = rel ? x + a[5] : a[5], ey = rel ? y + a[6] : a[6]; out.push(['A', a[0], a[1], a[2], a[3], a[4], ex, ey]); x = ex; y = ey; return; }
    const p = a.map((v, i) => (rel ? v + (i % 2 ? y : x) : v));
    out.push([k.toUpperCase(), ...p]);
    x = p[n - 2]; y = p[n - 1];
    if (k === 'm') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
  };
  // arc flags may be written without separators ("a5 5 0 01 3 4"): split them by position
  const tokens = [];
  while ((m = re.exec(d))) tokens.push(m[1] ? m[1] : m[2]);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) { if (buf.length) throw new Error('path: stray numbers before ' + t); cmd = t; if (t.toLowerCase() === 'z') flush(); continue; }
    if (cmd.toLowerCase() === 'a' && (buf.length === 3 || buf.length === 4) && /^[01]\d/.test(t)) { buf.push(+t[0]); tokens[i] = t.slice(1); i--; }
    else buf.push(+t);
    if (buf.length === ARGS[cmd.toLowerCase()]) flush();
  }
  if (buf.length) throw new Error('path: trailing numbers');
  return out;
}

// ---- flatten to polylines (for measuring only) ----
function flatten(segs) {
  const polys = []; let cur = null, x = 0, y = 0, px = 0, py = 0, last = '';
  const to = (nx, ny) => { cur.push([nx, ny]); x = nx; y = ny; };
  const bez = (p, n = 8) => { for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t;
    if (p.length === 8) to(u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6], u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7]);
    else to(u * u * p[0] + 2 * u * t * p[2] + t * t * p[4], u * u * p[1] + 2 * u * t * p[3] + t * t * p[5]); } };
  for (const s of segs) {
    const c = s[0];
    if (c === 'M') { cur = [[s[1], s[2]]]; polys.push(cur); x = s[1]; y = s[2]; }
    else if (c === 'L') to(s[1], s[2]);
    else if (c === 'Z') { if (cur?.length) to(cur[0][0], cur[0][1]); }
    else if (c === 'C') { px = s[3]; py = s[4]; bez([x, y, s[1], s[2], s[3], s[4], s[5], s[6]]); }
    else if (c === 'S') { const c1 = last === 'C' || last === 'S' ? [2 * x - px, 2 * y - py] : [x, y]; px = s[1]; py = s[2]; bez([x, y, ...c1, s[1], s[2], s[3], s[4]]); }
    else if (c === 'Q') { px = s[1]; py = s[2]; bez([x, y, s[1], s[2], s[3], s[4]]); }
    else if (c === 'T') { const c1 = last === 'Q' || last === 'T' ? [2 * x - px, 2 * y - py] : [x, y]; px = c1[0]; py = c1[1]; bez([x, y, ...c1, s[1], s[2]]); }
    else if (c === 'A') arc(x, y, s, to);
    last = c;
  }
  return polys;
}
function arc(x0, y0, [, rx, ry, rot, large, sweep, x1, y1], to) { // SVG endpoint -> centre form
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry || (x0 === x1 && y0 === y1)) return to(x1, y1);
  const ph = (rot * Math.PI) / 180, cs = Math.cos(ph), sn = Math.sin(ph);
  const dx = (x0 - x1) / 2, dy = (y0 - y1) / 2, xp = cs * dx + sn * dy, yp = -sn * dx + cs * dy;
  const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = Math.max(0, rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp), den = rx * rx * yp * yp + ry * ry * xp * xp;
  const co = (large === sweep ? -1 : 1) * Math.sqrt(num / den), cxp = (co * rx * yp) / ry, cyp = (-co * ry * xp) / rx;
  const cx = cs * cxp - sn * cyp + (x0 + x1) / 2, cy = sn * cxp + cs * cyp + (y0 + y1) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t0 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(4, Math.ceil(Math.abs(dt) / 0.2));
  for (let i = 1; i <= n; i++) { const t = t0 + (dt * i) / n; to(cx + rx * Math.cos(t) * cs - ry * Math.sin(t) * sn, cy + rx * Math.cos(t) * sn + ry * Math.sin(t) * cs); }
}
// Outline length, even-odd filled area (scanlines, 4 per unit) and extent.
function measure(polys) {
  let len = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const edges = [];
  for (const p of polys) for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    len += Math.hypot(b[0] - a[0], b[1] - a[1]);
    edges.push(a[1] < b[1] ? [a, b] : [b, a]);
    x0 = Math.min(x0, b[0], a[0]); x1 = Math.max(x1, b[0], a[0]); y0 = Math.min(y0, b[1], a[1]); y1 = Math.max(y1, b[1], a[1]);
  }
  // even-odd area: two scanlines per unit, edges bucketed by the scanlines they cross
  const STEP = 0.5, base = Math.floor(y0), rows = Array.from({ length: Math.ceil((y1 - base) / STEP) + 1 }, () => []);
  for (const [a, b] of edges) {
    const dx = (b[0] - a[0]) / (b[1] - a[1] || 1);
    for (let i = Math.max(0, Math.ceil((a[1] - base) / STEP - 0.5)); i < rows.length; i++) { const y = base + (i + 0.5) * STEP; if (y >= b[1]) break; if (y >= a[1]) rows[i].push(a[0] + (y - a[1]) * dx); }
  }
  let area = 0;
  for (const xs of rows) { xs.sort((p, q) => p - q); for (let i = 0; i + 1 < xs.length; i += 2) area += (xs[i + 1] - xs[i]) * STEP; }
  return { w: (2 * area) / len, box: [x0, y0, x1, y1] };
}

// ---- re-encode: one decimal, relative, each step measured from the rounded point so nothing drifts ----
function encode(segs) {
  const r = (v) => Math.round(v * 10) / 10;
  const f = (v) => { const s = String(r(v)); return s.startsWith('0.') ? s.slice(1) : s.startsWith('-0.') ? '-' + s.slice(2) : s; };
  const parts = []; // tokens; `tail` is the last number written (a number starting with "." may follow one that has a ".")
  let x = 0, y = 0, sx = 0, sy = 0, prev = '', tail = '';
  const num = (t) => { parts.push((tail === '' || t[0] === '-' || (t[0] === '.' && tail.includes('.')) ? '' : ' ') + t); tail = t; };
  const put = (c, nums) => {
    if (c !== prev) { parts.push(c); tail = ''; }
    for (const v of nums) num(f(v));
    prev = c;
  };
  for (const s of segs) {
    const c = s[0];
    if (c === 'Z') { parts.push('z'); prev = 'z'; tail = ''; x = sx; y = sy; continue; }
    if (c === 'A') { const ex = r(s[6]), ey = r(s[7]); parts.push(`a${f(s[1])} ${f(s[2])} ${f(s[3])} ${s[4]} ${s[5]} ${f(ex - x)} ${f(ey - y)}`); prev = 'A'; tail = ''; x = ex; y = ey; continue; }
    const abs = s.slice(1).map(r), rel = abs.map((v, i) => v - (i % 2 ? y : x));
    if (c === 'M') { parts.push(`M${f(abs[0])} ${f(abs[1])}`); prev = 'M'; tail = ''; sx = abs[0]; sy = abs[1]; }
    else if (c === 'L' && r(rel[1]) === 0) put('h', [rel[0]]);
    else if (c === 'L' && r(rel[0]) === 0) put('v', [rel[1]]);
    else put(c.toLowerCase(), rel);
    x = abs[abs.length - 2]; y = abs[abs.length - 1];
  }
  return parts.join('');
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let bytes = 0, raw = 0;
const widths = [];
const queue = [...slugs];
await Promise.all(Array.from({ length: 12 }, async () => {
  while (queue.length) {
    const slug = queue.shift();
    const frames = [];
    for (const n of [1, 2, 3]) {
      const svg = await get(slug, n);
      raw += svg.length;
      const m = / d="([^"]+)"/.exec(svg);
      if (!m || !/viewBox="0 0 512 512"/.test(svg) || (svg.match(/<path/g) ?? []).length !== 1) throw new Error(`${slug}/frame-${n}: not the one-path 512 drawing this script expects`);
      const segs = parse(m[1]);
      frames.push({ d: encode(segs), ...measure(flatten(segs)) });
    }
    // one square crop for the three frames, with a small margin
    const x0 = Math.min(...frames.map((f) => f.box[0])), y0 = Math.min(...frames.map((f) => f.box[1]));
    const x1 = Math.max(...frames.map((f) => f.box[2])), y1 = Math.max(...frames.map((f) => f.box[3]));
    const side = Math.ceil(Math.max(x1 - x0, y1 - y0) * 1.04 + 4);
    const b = [Math.round(((x0 + x1 - side) / 2) * 10) / 10, Math.round(((y0 + y1 - side) / 2) * 10) / 10, side];
    const k = frames.map((f) => { widths.push((f.w * 512) / side); return Math.round(Math.max(0, f.w - (TARGET * side) / 512) * 0.9 * 100) / 100; });
    const json = JSON.stringify({ b, k, d: frames.map((f) => f.d) });
    bytes += json.length;
    writeFileSync(`${OUT}/${slug}.json`, json);
  }
}));
writeFileSync(`${OUT}/index.ts`, `// Generated by scripts/art.mjs: do not edit. Line drawings from workout-guide by Bryl Lim (CC BY-SA 4.0, based on
// Everkinetic), one file per drawing, loaded only when shown. b: square crop [x, y, side]; k: knock-out width per frame;
// d: the three frames as filled paths.
export type Art = { b: [number, number, number]; k: number[]; d: string[] };
export const ART: Record<string, () => Art> = {
${slugs.map((s) => `  '${s}': () => require('./${s}.json'),`).join('\n')}
};
`);
widths.sort((a, b) => a - b);
const q = (p) => widths[Math.floor(p * (widths.length - 1))].toFixed(2);
console.log(`art: ${slugs.length} drawings, ${readdirSync(OUT).length - 1} files, ${(raw / 1e6).toFixed(1)} MB of originals -> ${(bytes / 1e6).toFixed(1)} MB`);
console.log(`line width before (per 512 of crop): p10 ${q(0.1)}, median ${q(0.5)}, p90 ${q(0.9)}, max ${q(1)}; after: ${TARGET} wherever it was wider`);
