// Live 3D viewer for the app. pack.cjs bundles this file, three.js and the figure's data into one HTML page
// (assets/anatomy/live.html), which the app shows in a web view. The figure repeats the move while the user
// drags to look around, pinches to zoom, slows it down or pauses it.
// The page reads its settings from the address: #ex=squat&bg=f3f4f1&ink=1a1c1a
// It tells the app what happened with messages: {type:'ready'} after the first picture, {type:'fail', why} otherwise.
import * as THREE from 'three';
import { I, mul, lerp, angleLabel, makeMoves } from './moves.js';
import { makeDriven } from './drive.js';

const say = (m) => { const s = JSON.stringify(m); try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else if (window.parent !== window) window.parent.postMessage(s, '*'); } catch (e) { /* nobody is listening */ } };
const fail = (why) => { say({ type: 'fail', why: String(why).slice(0, 200) }); const h = document.getElementById('hint'); if (h) { h.textContent = '3D view could not start here'; h.style.opacity = 1; } };
window.addEventListener('error', (e) => fail(e.message || 'error'));
window.addEventListener('unhandledrejection', (e) => fail(e.reason?.message || 'error'));

const QS = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
const A = window.A3D, meta = A.meta;
const raw = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
const N = meta.n, J = meta.joints, SEG = meta.seg;
// positions come as 0.1 mm steps, fibre data as 16-bit steps between each channel's lowest and highest value
const rest = new Float32Array(N * 3); { const q = new Int16Array(raw(A.V)); for (let i = 0; i < N * 3; i++) rest[i] = q[i] / 10; }
const F = new Uint32Array(raw(A.F)), BI = new Uint8Array(raw(A.bi)), W0 = new Uint8Array(raw(A.bw));
const FIB = new Float32Array(N * 3); { const q = new Uint16Array(raw(A.fib)), lo = A.fibLo, hi = A.fibHi; for (let i = 0; i < N * 3; i++) { const k = i % 3; FIB[i] = lo[k] + (hi[k] - lo[k]) * q[i] / 65535; } }
window.A3D = null;

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const PIV = { pelvis: 'pel', lumbar: 'lum', chest: 'chest', neck: 'neck', head: 'head', Lupper: 'Lsh', Lfore: 'Lel', Lhand: 'Lwr', Rupper: 'Rsh', Rfore: 'Rel', Rhand: 'Rwr', Lthigh: 'Lhip', Lshank: 'Lknee', Lfoot: 'Lank', Rthigh: 'Rhip', Rshank: 'Rknee', Rfoot: 'Rank' };
const PARENT = { lumbar: 'pelvis', chest: 'lumbar', neck: 'chest', head: 'neck', Lupper: 'chest', Lfore: 'Lupper', Lhand: 'Lfore', Rupper: 'chest', Rfore: 'Rupper', Rhand: 'Rfore', Lthigh: 'pelvis', Lshank: 'Lthigh', Lfoot: 'Lshank', Rthigh: 'pelvis', Rshank: 'Rthigh', Rfoot: 'Rshank' };
const ORDER = ['pelvis', 'lumbar', 'chest', 'neck', 'head', 'Lupper', 'Lfore', 'Lhand', 'Rupper', 'Rfore', 'Rhand', 'Lthigh', 'Lshank', 'Lfoot', 'Rthigh', 'Rshank', 'Rfoot'];

// fingers (added by pack.cjs): two joints per hand, closing about the hand's own curl axis
for (const S of ['L', 'R']) if (SEG.includes(S + 'fing1')) { PIV[S + 'fing1'] = S + 'mcp'; PIV[S + 'fing2'] = S + 'pip'; PARENT[S + 'fing1'] = S + 'hand'; PARENT[S + 'fing2'] = S + 'fing1'; ORDER.push(S + 'fing1', S + 'fing2'); }
const curlAxis = (S) => new THREE.Vector3(...meta.curl[S]);
// pose.curl = { L, R } from 0 (flat hand) to 1 (closed around a handle); a relaxed hand is a little bent
const fingers = (pose, s) => { const S = s[0], c = pose.curl?.[S] ?? 0.22; return new THREE.Matrix4().makeRotationAxis(curlAxis(S), (s.endsWith('1') ? 82 : 88) * c * Math.PI / 180); };

let segOut = {};
// Two ways to say what to show: #ex=squat picks a hand-made move; #j=<JSON> (or #d=<base64 JSON>) carries an exercise's own movement
// data from the app ({ pose, primary, secondary }), which drive.js turns into a 3D pose.
const EX = makeMoves(() => segOut), name = EX[QS.get('ex')] ? QS.get('ex') : 'squat';
const spec = QS.get('j') ? JSON.parse(QS.get('j')) : QS.get('d') ? JSON.parse(decodeURIComponent(escape(atob(QS.get('d').replace(/-/g, '+').replace(/_/g, '/'))))) : window.SPEC;
let ex = spec ? makeDriven(spec, J, () => segOut, meta) : EX[name];

// ---- the figure. The phone's graphics chip bends it: every point follows two body segments (sk = which two, how much).
const C = (h) => new THREE.Color(h);
const PAL = { muscle: C('#a8736a'), body: C('#d8cfc4'), core: C('#855f58'), joint: C('#9a6b62'), fascia: C('#e4dccf'), bone: C('#e9e3d6'), tendon: C('#ece7dd') };
const col = new Float32Array(N * 3), cls = new Float32Array(N), sk = new Float32Array(N * 4);
meta.parts.forEach((p) => { const c = PAL[p.kind] || PAL.muscle; for (let i = p.v0; i < p.v0 + p.nv; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } });
// which muscles work in this move: 1 = main (pulsing red), 2 = helper (light red)
function mark() {
  meta.parts.forEach((p) => { const k = p.groups.some((g) => ex.primary.includes(g)) ? 1 : p.groups.some((g) => ex.secondary.includes(g)) ? 2 : 0; cls.fill(k, p.v0, p.v0 + p.nv); });
  if (geo.attributes.cls) geo.attributes.cls.needsUpdate = true;
}
for (let i = 0; i < N; i++) { const w = W0[i] / 255; sk[i * 4] = BI[i * 2]; sk[i * 4 + 1] = BI[i * 2 + 1]; sk[i * 4 + 2] = w; sk[i * 4 + 3] = 1 - w; }
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(rest, 3)); geo.setIndex(new THREE.BufferAttribute(F, 1)); geo.computeVertexNormals();
geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('fib', new THREE.BufferAttribute(FIB, 3));
geo.setAttribute('sk', new THREE.BufferAttribute(sk, 4)); geo.setAttribute('cls', new THREE.BufferAttribute(cls, 1));
mark();

const canvas = document.getElementById('gl');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { fail('no WebGL'); throw e; }
canvas.addEventListener('webglcontextlost', () => fail('graphics context lost'));
renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(22, 1, 100, 20000); cam.up.set(0, 0, 1);
scene.add(new THREE.HemisphereLight(0xffffff, 0x6f7480, 0.8));
const key = new THREE.DirectionalLight(0xfff4e8, 2.6), rim = new THREE.DirectionalLight(0xcfe0ff, 1.2); scene.add(key, rim);

const bones = SEG.map(() => new THREE.Matrix4()), HOT = C('#ff4a2e'), DEEP = C('#a81c16'), pri = C('#d2322a'), sec = C('#e58a78');
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, side: THREE.DoubleSide });
mat.onBeforeCompile = (sh) => {
  sh.uniforms.bones = { value: bones }; sh.uniforms.pri = { value: pri }; sh.uniforms.sec = { value: sec };
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>\nattribute vec3 fib; attribute vec4 sk; attribute float cls; uniform mat4 bones[${SEG.length}]; varying vec3 vFib; varying float vCls;`)
    .replace('#include <beginnormal_vertex>', 'mat4 skM = bones[int(sk.x + 0.5)] * sk.z + bones[int(sk.y + 0.5)] * sk.w;\nvec3 objectNormal = normalize(mat3(skM) * normal);')
    .replace('#include <begin_vertex>', 'vec3 transformed = (skM * vec4(position, 1.0)).xyz;\nvFib = fib; vCls = cls;');
  // fine fibres along each muscle, a groove at each sheet edge, pale tendon ends; working muscles take the pulsing red
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFib; varying float vCls; uniform vec3 pri; uniform vec3 sec;').replace('#include <color_fragment>', `#include <color_fragment>
    if (vCls > 1.5) diffuseColor.rgb = sec; else if (vCls > 0.5) diffuseColor.rgb = pri;
    if (vFib.x >= 0.0) {
      float f = vFib.y * vFib.z, w = fwidth(f);
      float fine = sin(f * 6.2832) * clamp(1.0 - w * 1.4, 0.0, 1.0);
      float coarse = sin(f * 0.23 * 6.2832);
      diffuseColor.rgb *= 1.0 + 0.13 * fine + 0.07 * coarse - 0.04;
      diffuseColor.rgb *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 2.6, (1.0 - abs(vFib.y)) * vFib.z * 1.2));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.89, 0.81) * (0.92 + 0.08 * fine), vFib.x * 0.92);
    }`);
};
const body = new THREE.Mesh(geo, mat); body.frustumCulled = false; scene.add(body);
const props = new THREE.Group(); scene.add(props);
const shadow = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(0,0,0,0.38)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
})(); scene.add(shadow);

// ---- pose: where every segment sits for a pose, as one matrix per segment
function solve(pose) {
  const R = {}, p = {};
  for (const s of ORDER) {
    const par = PARENT[s];
    R[s] = pose.abs?.[s] ? pose.abs[s].clone() : mul(par ? R[par] : I, pose.loc?.[s] || (s.includes('fing') ? fingers(pose, s) : I));
    p[s] = par ? v3(J[PIV[s]]).sub(v3(J[PIV[par]])).applyMatrix4(R[par]).add(p[par]) : v3(J.pel);
  }
  const off = new THREE.Vector3();
  if (pose.plant !== false) off.copy(v3(J.Lank)).add(v3(J.Rank)).sub(p.Lfoot).sub(p.Rfoot).multiplyScalar(0.5);
  if (pose.shift) off.add(pose.shift);
  // hands that hold a fixed bar stay on it: the body moves, the bar does not
  if (pose.hang && meta.palm) {
    const g = new THREE.Vector3(); for (const s of ['R', 'L']) g.add(new THREE.Vector3(...meta.palm[s]).applyMatrix4(R[s + 'hand']).add(p[s + 'hand'])); g.multiplyScalar(0.5).add(off);
    if (!ex.hangAt) ex.hangAt = g.clone(); off.add(ex.hangAt).sub(g);
  }
  SEG.forEach((s, i) => { p[s].add(off); const t = v3(J[PIV[s]]).applyMatrix4(R[s]).negate().add(p[s]); bones[i].copy(R[s]).setPosition(t); });
  segOut = { R, p };
}
// the space the whole move needs and the middle of the working muscles, measured once on every 6th point
const box = new THREE.Box3(), focus = new THREE.Vector3(), centre = new THREE.Vector3(); let radius = 1;
function measure() {
  const q = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(); let n = 0;
  box.makeEmpty(); focus.set(0, 0, 0);
  for (const t of [0, 0.5, 1]) {
    solve(ex.pose(t));
    for (let i = 0; i < N; i += 6) {
      q.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]); const w = sk[i * 4 + 2];
      a.copy(q).applyMatrix4(bones[BI[i * 2]]).multiplyScalar(w); b.copy(q).applyMatrix4(bones[BI[i * 2 + 1]]).multiplyScalar(1 - w); a.add(b);
      box.expandByPoint(a); if (cls[i] === 1 && t === 0.5) { focus.add(a); n++; }
    }
  }
  if (n) focus.multiplyScalar(1 / n); else box.getCenter(focus);
  box.getCenter(centre); { const sz = box.getSize(new THREE.Vector3()); radius = Math.max(sz.length() / 2, sz.z / 1.5); } // a tall narrow move must still fit top to bottom
  // make some room for the equipment too, but keep the body large: a barbell may run a little off the picture
  if (ex.props) {
    solve(ex.pose(0)); const pb = new THREE.Box3().setFromObject(ex.props(ex.pose(0)));
    if (!pb.isEmpty()) { const all = box.clone().union(pb), c2 = all.getCenter(new THREE.Vector3()), r2 = all.getSize(new THREE.Vector3()).length() / 2; centre.lerp(c2, 0.5); radius = Math.min(r2, radius * 1.25); }
  }
  shadow.position.set(centre.x, centre.y + 20, (meta.ground ?? 0) + 1); shadow.scale.set(1100, 900, 1);
}
measure();

// ---- camera the user steers: az and el in degrees, zoom 1 = the whole move fits
const HOME = { az: ex.shots[0].az, el: Math.atan(ex.shots[0].el) * 180 / Math.PI, zoom: 0.82 };
const view = { ...HOME }; let goal = null; // goal: where "Reset view" glides back to
const ov = document.getElementById('ov'), g2 = ov.getContext('2d');
let W = 0, H = 0, DPR = 1, quality = Math.min(window.devicePixelRatio || 1, 2);
function size() {
  W = canvas.clientWidth; H = canvas.clientHeight; if (!W || !H) return;
  renderer.setPixelRatio(quality); renderer.setSize(W, H, false); cam.aspect = W / H;
  DPR = Math.min(window.devicePixelRatio || 1, 2); ov.width = W * DPR; ov.height = H * DPR;
}
window.addEventListener('resize', size); size();
function aim() {
  const a = view.az * Math.PI / 180, e = view.el * Math.PI / 180, dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), -Math.cos(a) * Math.cos(e), Math.sin(e));
  // zoomed in, the camera turns towards the working muscles
  const tgt = centre.clone().lerp(focus, Math.min(1, Math.max(0, (1 - view.zoom) / 0.5)) * 0.9);
  const fit = radius / Math.sin(cam.fov * Math.PI / 360) / Math.min(1, cam.aspect);
  tgt.z -= radius * 0.1 * view.zoom; // leaves room for the buttons under the feet
  cam.position.copy(tgt).addScaledVector(dir, fit * view.zoom); cam.lookAt(tgt); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  key.position.copy(cam.position).add(new THREE.Vector3(-900, -300, 1600)); rim.position.set(-dir.x * 1000 + 600, 1500, 900);
}

// ---- touch: one finger turns, two fingers zoom, the mouse wheel zooms too
const touches = new Map(); let pinch = 0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); touches.set(e.pointerId, [e.clientX, e.clientY]); goal = null; pinch = 0; hideHint(); });
canvas.addEventListener('pointermove', (e) => {
  const was = touches.get(e.pointerId); if (!was) return; touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (touches.size === 1) { view.az -= (e.clientX - was[0]) * 0.45; view.el = clamp(view.el + (e.clientY - was[1]) * 0.3, -8, 80); }
  else if (touches.size === 2) { const [a, b] = [...touches.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) view.zoom = clamp(view.zoom * pinch / d, 0.22, 1.25); pinch = d; }
});
const up = (e) => { touches.delete(e.pointerId); pinch = 0; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); goal = null; view.zoom = clamp(view.zoom * Math.exp(e.deltaY * 0.0012), 0.22, 1.25); hideHint(); }, { passive: false });

// ---- buttons
let playing = true, slow = false;
const $ = (id) => document.getElementById(id), hint = $('hint');
function hideHint() { hint.style.opacity = 0; }
setTimeout(hideHint, 4500);
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; };
$('slow').onclick = () => { slow = !slow; $('slow').classList.toggle('on', slow); $('slow').setAttribute('aria-pressed', slow); };
$('reset').onclick = () => { goal = { ...HOME, az: HOME.az + 360 * Math.round((view.az - HOME.az) / 360) }; };
window.addEventListener('message', (e) => { if (e.data === 'pause') { playing = false; $('play').textContent = 'Play'; } }); // the app pauses it when it scrolls away

// ---- the loop. One rep is 2 s down, a short hold, 2 s up and 1 s rest, like the clip.
let PER = ex.per || 5.44, clock = 0, last = 0, lastT = -1, frames = 0, since = 0, told = false;
// for the picture sheets made by sheet.cjs: hold the move at position p and look from az, el, zoom
const still = !!QS.get('bare'); let dirty = 3;
window.hold = (p, az, el, zoom) => { dirty = 3; playing = false; ex.phase = () => p; if (az != null) Object.assign(view, { az, el, zoom }); goal = null; lastT = -1; };
// show another exercise without loading the page again
window.show = (sp) => { props.traverse((o) => o.geometry?.dispose()); props.clear(); ex = makeDriven(sp, J, () => segOut, meta); mark(); measure(); Object.assign(HOME, { az: ex.shots[0].az, el: Math.atan(ex.shots[0].el) * 180 / Math.PI }); Object.assign(view, HOME); PER = ex.per || 5.44; clock = 0; lastT = -1; goal = null; };
window.look = (j, r) => { centre.copy(segOut.p[j]); radius = r; dirty = 3; };
window.joints = () => Object.fromEntries(Object.entries(segOut.p).map(([k, q]) => [k, [Math.round(q.x), Math.round(q.y), Math.round(q.z)]]));
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now; if (document.hidden || !W) return;
  if (still && !dirty) return; dirty = Math.max(0, dirty - 1); // picture sheets: draw only when asked
  if (playing) clock += dt * (slow ? 0.4 : 1);
  const ph = (clock % PER) / PER, e = (x) => x * x * (3 - 2 * x), t = ex.phase ? ex.phase(ph) : ph < 0.37 ? e(ph / 0.37) : ph < 0.445 ? 1 : ph < 0.815 ? 1 - e((ph - 0.445) / 0.37) : 0;
  const pose = ex.pose(t); solve(pose);
  if (ex.props && t !== lastT) { const g = ex.props(pose); if (g.parent !== props) { props.traverse((o) => o.geometry?.dispose()); props.clear(); props.add(g); } }
  lastT = t;
  pri.copy(DEEP).lerp(HOT, 0.5 - 0.5 * Math.cos(2 * Math.PI * now / 880));
  if (goal) { const k = 1 - Math.exp(-dt * 7); view.az = lerp(view.az, goal.az, k); view.el = lerp(view.el, goal.el, k); view.zoom = lerp(view.zoom, goal.zoom, k); if (Math.abs(view.az - goal.az) < 0.2 && Math.abs(view.zoom - goal.zoom) < 0.004) goal = null; }
  aim(); renderer.render(scene, cam);
  // angle read-outs, drawn on a flat layer above the figure
  g2.setTransform(DPR, 0, 0, DPR, 0, 0); g2.clearRect(0, 0, W, H);
  const U = Math.max(330, Math.min(520, Math.min(W, H) * 1.3)), proj = (v) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H]; }, placed = [];
  if (ex.angles && !QS.get('bare')) for (const [a, b, c, l, base, sub] of ex.angles(segOut.p)) angleLabel(g2, proj, U, placed, a, b, c, l, base, sub);
  if (!told) { told = true; say({ type: 'ready' }); }
  // a phone that cannot keep up gets a coarser picture instead of a stuttering one
  frames++; since += dt; if (since > 2) { const fps = frames / since; frames = 0; since = 0; if (fps < 20 && quality > 0.75) { quality = quality > 1 ? 1 : 0.75; size(); } }
}
requestAnimationFrame(frame);
