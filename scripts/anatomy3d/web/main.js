import * as THREE from 'three';
const QS = new URLSearchParams(location.search), SIZE = +(QS.get('size') || 720), D = '/' + (QS.get('data') || 'web') + '/';
const bin = async (u, T) => new T(await (await fetch(u)).arrayBuffer());
const [V0, F, BI, BW, meta] = await Promise.all([bin(D + 'V.bin', Float32Array), bin(D + 'F.bin', Uint32Array), bin(D + 'bi.bin', Uint8Array), bin(D + 'bw.bin', Float32Array), (await fetch(D + 'meta.json')).json()]);
const FIBRAW = meta.own ? await bin(D + 'fib.bin', Float32Array) : null;
const FIBU = FIBRAW && !meta.fib3 ? FIBRAW : null;
const N = meta.n, J = meta.joints, SEG = meta.seg, si = Object.fromEntries(SEG.map((s, i) => [s, i]));
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const PIV = { pelvis: 'pel', lumbar: 'lum', chest: 'chest', neck: 'neck', head: 'head', Lupper: 'Lsh', Lfore: 'Lel', Lhand: 'Lwr', Rupper: 'Rsh', Rfore: 'Rel', Rhand: 'Rwr', Lthigh: 'Lhip', Lshank: 'Lknee', Lfoot: 'Lank', Rthigh: 'Rhip', Rshank: 'Rknee', Rfoot: 'Rank' };
const PARENT = { lumbar: 'pelvis', chest: 'lumbar', neck: 'chest', head: 'neck', Lupper: 'chest', Lfore: 'Lupper', Lhand: 'Lfore', Rupper: 'chest', Rfore: 'Rupper', Rhand: 'Rfore', Lthigh: 'pelvis', Lshank: 'Lthigh', Lfoot: 'Lshank', Rthigh: 'pelvis', Rshank: 'Rthigh', Rfoot: 'Rshank' };
const ORDER = ['pelvis', 'lumbar', 'chest', 'neck', 'head', 'Lupper', 'Lfore', 'Lhand', 'Rupper', 'Rfore', 'Rhand', 'Lthigh', 'Lshank', 'Lfoot', 'Rthigh', 'Rshank', 'Rfoot'];

// ---- part classes, colours, triangle selection
const partOf = new Uint16Array(N); meta.parts.forEach((p, i) => partOf.fill(i, p.v0, p.v0 + p.nv));
const skinI = meta.parts.findIndex((p) => p.kind === 'skin'), skin = meta.parts[skinI];
// rest normals (for the skin filler patches)
const rest = new Float32Array(V0);
var skinClass = new Uint8Array(N);
if (skinI >= 0) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(rest, 3));
  g.setIndex(new THREE.BufferAttribute(F.subarray(skin.f0 * 3, (skin.f0 + skin.nf) * 3), 1)); g.computeVertexNormals();
  const n = g.attributes.normal.array;
  // class per skin vertex: 1 head, 2 hand, 3 foot, 4 abs, 5 lats, 0 dropped
  const fa = (k) => { const a = v3(J[k + 'el']), b = v3(J[k + 'wr']); return [b, b.clone().sub(a).normalize()]; };
  const FA = { L: fa('L'), R: fa('R') };
  for (let i = skin.v0; i < skin.v0 + skin.nv; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2], ny = n[i * 3 + 1], ax = Math.abs(x);
    const k = x > 0 ? 'L' : 'R', [w, d] = FA[k]; const t = (x - w.x) * d.x + (y - w.y) * d.y + (z - w.z) * d.z;
    let c = 0;
    if (z > 1436) c = 1; else if (z < 6) c = 3; else if (ax > 190 && z < 840 && t > -4) c = 2;
    else if (ax < 70 && ny < -0.25 && z > 835 && z < 1135) c = 4;
    else if (ax > 30 && ax < 165 && ny > 0.15 && z > 965 && z < 1255 && y > -70) c = 5;
    skinClass[i] = c;
    if (c >= 4) { const o = c === 4 ? 10 : 9; rest[i * 3] -= n[i * 3] * o; rest[i * 3 + 1] -= n[i * 3 + 1] * o; rest[i * 3 + 2] -= n[i * 3 + 2] * o; }
  }
}
const keep = [];
meta.parts.forEach((p, pi) => {
  for (let f = p.f0; f < p.f0 + p.nf; f++) {
    const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
    if (pi === skinI) { const k = skinClass[a]; if (!k || skinClass[b] !== k || skinClass[c] !== k) continue; }
    else if (meta.own) { /* our own figure keeps everything */ }
    else if (p.kind !== 'muscle' && rest[a * 3 + 2] > 1436 && rest[b * 3 + 2] > 1436) continue; // skull sits under the head skin
    else if (rest[a * 3 + 2] > 1470) continue;
    keep.push(a, b, c);
  }
});
const geo = new THREE.BufferGeometry();
const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
geo.setIndex(new THREE.BufferAttribute(new Uint32Array(keep), 1));
const C = (h) => new THREE.Color(h);
const PAL = { muscle3: C('#a8736a'), body3: C('#d8cfc4'),  muscle: C('#a89a94'), bone: C('#e9e3d6'), cart: C('#d9d6cf'), lig: C('#dcd6cc'), skin: C('#9b9896'), body: C('#cfcbc6'), tendon: C('#ece7dd'), core: C('#855f58'), joint: C('#9a6b62'), fascia: C('#e4dccf'), bone: C('#e9e3d6'), primary: C('#d2322a'), secondary: C('#e58a78') };
const HOT = C('#ff4a2e'), DEEP = C('#a81c16');
function paint(primary, secondary, pulse) {
  if (pulse != null) PAL.primary = DEEP.clone().lerp(HOT, pulse);
  meta.parts.forEach((p, pi) => {
    let c = PAL[p.kind]; if (meta.fib3 && p.kind === 'muscle') c = PAL.muscle3; if (meta.fib3 && p.kind === 'body') c = PAL.body3;
    if (p.groups.some((g) => secondary.includes(g))) c = PAL.secondary;
    if (p.groups.some((g) => primary.includes(g))) c = PAL.primary;
    for (let i = p.v0; i < p.v0 + p.nv; i++) {
      let cc = c;
      if (pi === skinI) { const k = skinClass[i]; cc = k === 4 ? (primary.includes('abs') ? PAL.primary : PAL.muscle) : k === 5 ? (primary.includes('lats') ? PAL.primary : PAL.muscle) : PAL.skin; }
      if (FIBU && FIBU[i] >= 0) { const u = FIBU[i], e = Math.min(u, 1 - u), k = e < 0.1 ? 1 - e / 0.1 : 0; cc = cc.clone().lerp(PAL.tendon, k * 0.85); }
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    }
  });
  geo.attributes.color.needsUpdate = true;
}

// ---- scene
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(SIZE, SIZE); renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0); document.body.appendChild(renderer.domElement);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(22, 1, 100, 20000); cam.up.set(0, 0, 1);
scene.add(new THREE.HemisphereLight(0xffffff, 0x6f7480, 0.8));
const key = new THREE.DirectionalLight(0xfff4e8, 2.6); scene.add(key);
const rim = new THREE.DirectionalLight(0xcfe0ff, 1.2); scene.add(rim);
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.0, side: THREE.DoubleSide });
if (meta.fib3) {
  // fibre look for our own sheets: fine striations along the muscle, a groove at each sheet edge, pale tendon ends
  geo.setAttribute('fib', new THREE.BufferAttribute(FIBRAW, 3));
  mat.roughness = 0.5;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 fib; varying vec3 vFib;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFib = fib;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFib;').replace('#include <color_fragment>', `#include <color_fragment>
      if (vFib.x >= 0.0) {
        float f = vFib.y * vFib.z, w = fwidth(f);
        float fine = sin(f * 6.2832) * clamp(1.0 - w * 1.4, 0.0, 1.0);
        float coarse = sin(f * 0.23 * 6.2832);
        diffuseColor.rgb *= 1.0 + 0.13 * fine + 0.07 * coarse - 0.04;
        diffuseColor.rgb *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 2.6, (1.0 - abs(vFib.y)) * vFib.z * 1.2));
        float tend = vFib.x;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.89, 0.81) * (0.92 + 0.08 * fine), tend * 0.92);
      }`);
  };
}
const body = new THREE.Mesh(geo, mat); body.frustumCulled = false; scene.add(body);
const props = new THREE.Group(); scene.add(props);
const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(0,0,0,0.38)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); scene.add(shadow);

// ---- pose
const Rx = (d) => new THREE.Matrix4().makeRotationX(d * Math.PI / 180), Ry = (d) => new THREE.Matrix4().makeRotationY(d * Math.PI / 180), Rz = (d) => new THREE.Matrix4().makeRotationZ(d * Math.PI / 180);
const mul = (...m) => m.reduce((a, b) => a.clone().multiply(b));
const I = new THREE.Matrix4();
const M = new Float32Array(SEG.length * 12);
let segOut = {};
function solve(pose) {
  // pose.abs[seg] = absolute rotation, pose.loc[seg] = rotation relative to the parent; pose.plant keeps the ankles where they are
  const R = {}, p = {};
  for (const s of ORDER) {
    const par = PARENT[s];
    R[s] = pose.abs?.[s] ? pose.abs[s].clone() : mul(par ? R[par] : I, pose.loc?.[s] || I);
    p[s] = par ? v3(J[PIV[s]]).sub(v3(J[PIV[par]])).applyMatrix4(R[par]).add(p[par]) : v3(J.pel);
  }
  const off = new THREE.Vector3();
  if (pose.plant !== false) off.copy(v3(J.Lank)).add(v3(J.Rank)).sub(p.Lfoot).sub(p.Rfoot).multiplyScalar(0.5);
  if (pose.shift) off.add(pose.shift);
  SEG.forEach((s, i) => {
    p[s].add(off); const e = R[s].elements, j = J[PIV[s]];
    // v' = R v + (p - R j)
    const t = new THREE.Vector3(j[0], j[1], j[2]).applyMatrix4(R[s]).negate().add(p[s]);
    M.set([e[0], e[4], e[8], t.x, e[1], e[5], e[9], t.y, e[2], e[6], e[10], t.z], i * 12);
  });
  segOut = { R, p };
}
function skin_() {
  for (let i = 0; i < N; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
    const a = BI[i * 2] * 12, b = BI[i * 2 + 1] * 12, wa = BW[i * 2], wb = BW[i * 2 + 1];
    let px = (M[a] * x + M[a + 1] * y + M[a + 2] * z + M[a + 3]) * wa, py = (M[a + 4] * x + M[a + 5] * y + M[a + 6] * z + M[a + 7]) * wa, pz = (M[a + 8] * x + M[a + 9] * y + M[a + 10] * z + M[a + 11]) * wa;
    if (wb > 0.001) { px += (M[b] * x + M[b + 1] * y + M[b + 2] * z + M[b + 3]) * wb; py += (M[b + 4] * x + M[b + 5] * y + M[b + 6] * z + M[b + 7]) * wb; pz += (M[b + 8] * x + M[b + 9] * y + M[b + 10] * z + M[b + 11]) * wb; }
    pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;
  }
  geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
}
const lerp = (a, b, t) => a + (b - a) * t, ease = (t) => t * t * (3 - 2 * t);
const grey = new THREE.MeshStandardMaterial({ color: 0x6d7682, roughness: 0.5, metalness: 0.25 }), pad = new THREE.MeshStandardMaterial({ color: 0x3f4650, roughness: 0.85 });
const box = (w, d, h, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), m); b.position.set(x, y, z); return b; };
const rod = (a, b, r, m) => { const d = b.clone().sub(a), g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 20), m); g.position.copy(a).add(b).multiplyScalar(0.5); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return g; };

const EX = {
  rest: { primary: [], secondary: [], view: [0.7, -1, 0.18], pose: () => ({}) },
  squat: {
    primary: ['quads', 'glutes'], secondary: ['hams', 'adductors', 'erectors'], view: [1.15, -1, 0.22],
    pose: (t) => {
      const s = ease(t), tr = Rx(40 * s);
      const arm = (sg) => mul(Rx(lerp(-8, -86, s)), Ry(sg * lerp(0, 8, s)));
      const leg = (sg, a) => mul(Rz(sg * 16), Ry(-sg * 5), Rx(a));
      return { abs: { pelvis: tr, lumbar: Rx(38 * s), chest: Rx(34 * s), neck: Rx(20 * s), head: Rx(8 * s), Lthigh: leg(1, -86 * s), Rthigh: leg(-1, -86 * s), Lshank: leg(1, 30 * s), Rshank: leg(-1, 30 * s), Lfoot: Rz(16), Rfoot: Rz(-16), Lupper: arm(1), Rupper: arm(-1) },
        loc: { Lfore: Rx(-6), Rfore: Rx(-6) } };
    },
  },
  fly: {
    primary: ['chest'], secondary: ['frontdelt', 'biceps'], view: [0.62, -1, 0.26],
    pose: (t) => {
      const s = ease(t), phi = lerp(-14, 66, s), back = Rx(-7);
      const arm = (sg) => mul(Rz(-sg * phi), Ry(-sg * 72), Rx(-4));
      return { abs: { pelvis: back, lumbar: back, chest: Rx(-7), neck: Rx(-2), head: I, Lthigh: mul(Rx(-86), Ry(-12)), Rthigh: mul(Rx(-86), Ry(12)), Lshank: Rx(4), Rshank: Rx(4), Lfoot: I, Rfoot: I, Lupper: arm(1), Rupper: arm(-1) },
        loc: { Lfore: Rx(-22), Rfore: Rx(-22), Lhand: Rx(-10), Rhand: Rx(-10) }, phi };
    },
    props: (pose) => {
      const { p, R } = segOut, g = new THREE.Group(), pel = p.pelvis, ch = p.chest;
      g.add(box(380, 400, 60, pad, 0, pel.y - 60, pel.z - 125));
      g.add(box(300, 60, 620, pad, 0, pel.y + 215, pel.z + 330));
      g.add(box(90, 90, 440, grey, 0, pel.y - 20, pel.z - 375)); g.add(box(460, 520, 30, grey, 0, pel.y + 20, -62));
      g.add(box(90, 90, 1500, grey, 0, pel.y + 300, pel.z - 20)); g.add(box(520, 90, 70, grey, 0, pel.y + 300, pel.z + 760));
      for (const sg of [1, -1]) {
        const k = sg > 0 ? 'L' : 'R', sh = p[k + 'upper'], hand = p[k + 'hand'].clone().add(new THREE.Vector3(0, 0, -30).applyMatrix4(R[k + 'hand']));
        const top = new THREE.Vector3(sh.x, sh.y, pel.z + 760), out = new THREE.Vector3(hand.x, hand.y, pel.z + 760);
        g.add(rod(top, out, 20, grey)); g.add(rod(out, new THREE.Vector3(hand.x, hand.y, hand.z - 130), 16, grey)); g.add(rod(new THREE.Vector3(sh.x, sh.y, pel.z + 795), new THREE.Vector3(sh.x, pel.y + 300, pel.z + 795), 20, grey));
        g.add(rod(new THREE.Vector3(hand.x, hand.y, hand.z + 70), new THREE.Vector3(hand.x, hand.y, hand.z - 70), 21, pad));
      }
      return g;
    },
  },
};
let current = null;
window.draw = (name, t, az) => {
  const ex = EX[name]; if (current !== name) { paint(ex.primary, ex.secondary); current = name; }
  const pose = ex.pose(t); solve(pose); skin_();
  props.clear(); if (ex.props) props.add(ex.props(pose));
  // frame: fixed box around the whole movement so the figure does not jump
  geo.computeBoundingBox(); const bb = ex.box || (ex.box = (() => { const b = new THREE.Box3(); for (const tt of [0, 0.5, 1]) { solve(ex.pose(tt)); skin_(); geo.computeBoundingBox(); b.union(geo.boundingBox); } solve(pose); skin_(); return b; })());
  const c = bb.getCenter(new THREE.Vector3()), r = bb.getSize(new THREE.Vector3()).length() / 2;
  const v = ex.view, dir = new THREE.Vector3(v[0], v[1], v[2]); if (az != null) dir.set(Math.sin(az), -Math.cos(az), v[2]); dir.normalize();
  const dist = r / Math.sin(cam.fov * Math.PI / 360) * (ex.zoom || 1.0);
  cam.position.copy(c).addScaledVector(dir, dist); cam.lookAt(c); cam.updateProjectionMatrix();
  key.position.copy(cam.position).add(new THREE.Vector3(-900, -300, 1600)); key.target = body;
  rim.position.set(-dir.x * 1000 + 600, 1500, 900);
  shadow.position.set(c.x, c.y + 20, (meta.ground ?? -70) + 1); shadow.scale.set(1100, 900, 1);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
};
window.ready = true;

// ---- version 2: camera moves, pulsing targets, joint angle labels
const ov = document.createElement('canvas'); ov.width = ov.height = SIZE; const g2 = ov.getContext('2d');
const proj = (v) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * SIZE, (-p.y * 0.5 + 0.5) * SIZE]; };
let placed = [];
function angleLabel(a, b, c, label, base, sub) {
  // base: c is a direction (not a point); the baseline is drawn through b as a long dashed reference line
  if (base) c = b.clone().add(c.clone().normalize().multiplyScalar(120));
  // angle at b between b->a and b->c, drawn where it appears on screen
  const u = a.clone().sub(b).normalize(), w = c.clone().sub(b).normalize(); let deg = Math.round(Math.acos(Math.max(-1, Math.min(1, u.dot(w)))) * 180 / Math.PI);
  if (sub) deg = Math.abs(sub - deg);
  if (base) { const [x0, y0] = proj(b.clone().addScaledVector(w, -330)), [x1, y1] = proj(b.clone().addScaledVector(w, 330)); g2.strokeStyle = 'rgba(31,111,235,0.55)'; g2.lineWidth = SIZE / 300; g2.setLineDash([SIZE / 60, SIZE / 90]); g2.beginPath(); g2.moveTo(x0, y0); g2.lineTo(x1, y1); g2.stroke(); g2.setLineDash([]); }
  const [bx, by] = proj(b), [ax, ay] = proj(b.clone().addScaledVector(u, 120)), [cx, cy] = proj(b.clone().addScaledVector(w, 120));
  const a0 = Math.atan2(ay - by, ax - bx), a1 = Math.atan2(cy - by, cx - bx); let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const R = SIZE * 0.05;
  g2.lineWidth = SIZE / 240; g2.strokeStyle = '#1f6feb'; g2.fillStyle = 'rgba(31,111,235,0.16)';
  g2.beginPath(); g2.moveTo(bx, by); g2.arc(bx, by, R, a0, a0 + d, d < 0); g2.closePath(); g2.fill();
  g2.beginPath(); g2.arc(bx, by, R, a0, a0 + d, d < 0); g2.stroke();
  g2.beginPath(); g2.moveTo(ax, ay); g2.lineTo(bx, by); g2.lineTo(cx, cy); g2.setLineDash([SIZE / 120, SIZE / 120]); g2.stroke(); g2.setLineDash([]);
  g2.beginPath(); g2.arc(bx, by, SIZE / 160, 0, 7); g2.fillStyle = '#1f6feb'; g2.fill();
  const mid = a0 + d / 2, tx = bx + Math.cos(mid) * R * 2.1; let ty = by + Math.sin(mid) * R * 2.1; for (const q of placed) if (Math.abs(q[0] - tx) < SIZE * 0.2 && Math.abs(q[1] - ty) < SIZE / 18) ty = q[1] + SIZE / 17; placed.push([tx, ty]); const txt = `${label} ${deg}°`;
  g2.font = `600 ${Math.round(SIZE / 34)}px system-ui, sans-serif`; const tw = g2.measureText(txt).width, th = SIZE / 26;
  g2.fillStyle = 'rgba(255,255,255,0.94)'; g2.strokeStyle = 'rgba(31,111,235,0.5)'; g2.lineWidth = 1; g2.beginPath(); g2.roundRect(tx - tw / 2 - 7, ty - th / 2 - 3, tw + 14, th + 6, 8); g2.fill(); g2.stroke();
  g2.fillStyle = '#0b2a5c'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(txt, tx, ty + 1);
}
const flat = (v) => new THREE.Vector3(v.x, v.y, 0);
// measured against baselines: the floor (horizontal) and upright (vertical)
EX.squat.angles = (p) => [[p.Lthigh, p.Lshank, flat(p.Lthigh.clone().sub(p.Lshank)), 'Thigh to floor', true], [p.Lupper, p.Lthigh, new THREE.Vector3(0, 0, 1), 'Back from upright', true]];
EX.fly.angles = (p) => [[p.Lfore, p.Lupper, p.Lupper.clone().sub(p.Rupper), 'Arm from shoulder line', true], [p.Lupper, p.Lfore, p.Lhand, 'Elbow bend', false, 180]];
EX.squat.shots = [{ az: 49, el: 0.22, zoom: 1, f: 0 }, { az: 88, el: 0.1, zoom: 0.96, f: 0 }, { az: 30, el: 0.3, zoom: 0.62, f: 0.8 }];
EX.fly.shots = [{ az: 32, el: 0.26, zoom: 1, f: 0 }, { az: 0, el: 0.16, zoom: 0.94, f: 0 }, { az: 24, el: 0.42, zoom: 0.56, f: 0.9 }];
// g = progress through the whole clip (0..1); t = movement position; pulse 0..1
window.draw2 = (name, t, g, pulse) => {
  const ex = EX[name]; paint(ex.primary, ex.secondary, pulse); current = null;
  const pose = ex.pose(t); solve(pose); skin_(); props.clear(); if (ex.props) props.add(ex.props(pose));
  const bb = ex.box || (ex.box = (() => { const b = new THREE.Box3(); for (const tt of [0, 0.5, 1]) { solve(ex.pose(tt)); skin_(); geo.computeBoundingBox(); b.union(geo.boundingBox); } solve(pose); skin_(); return b; })());
  const c = bb.getCenter(new THREE.Vector3()), r = bb.getSize(new THREE.Vector3()).length() / 2;
  const foc = new THREE.Vector3(); let n = 0; // the middle of the target muscles
  meta.parts.forEach((p) => { if (p.groups.some((x) => ex.primary.includes(x))) for (let i = p.v0; i < p.v0 + p.nv; i += 7) { foc.x += pos[i * 3]; foc.y += pos[i * 3 + 1]; foc.z += pos[i * 3 + 2]; n++; } });
  if (n) foc.multiplyScalar(1 / n); else foc.copy(c);
  const S = ex.shots, x = g * S.length, i = Math.floor(x) % S.length, fr = x - Math.floor(x), k = fr < 0.83 ? 0 : ease((fr - 0.83) / 0.17), A = S[i], B = S[(i + 1) % S.length];
  const az = lerp(A.az, B.az, k) * Math.PI / 180, el = lerp(A.el, B.el, k), zoom = lerp(A.zoom, B.zoom, k), f = lerp(A.f, B.f, k);
  const dir = new THREE.Vector3(Math.sin(az), -Math.cos(az), el).normalize(), tgt = c.clone().lerp(foc, f);
  cam.position.copy(tgt).addScaledVector(dir, r / Math.sin(cam.fov * Math.PI / 360) * zoom); cam.lookAt(tgt); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  key.position.copy(cam.position).add(new THREE.Vector3(-900, -300, 1600)); rim.position.set(-dir.x * 1000 + 600, 1500, 900);
  shadow.position.set(c.x, c.y + 20, (meta.ground ?? -70) + 1); shadow.scale.set(1100, 900, 1);
  renderer.render(scene, cam);
  g2.clearRect(0, 0, SIZE, SIZE); g2.drawImage(renderer.domElement, 0, 0);
  placed = []; if (ex.angles) for (const [a, b, cc, l, base, sub] of ex.angles(segOut.p)) angleLabel(a, b, cc, l, base, sub);
  return ov.toDataURL('image/png');
};

// free camera on the rest pose, for checking the model: az degrees (0 front, 90 the figure's left, 180 back), el = height of the eye, dist mm, target xyz
window.view = (az, el, dist, tx, ty, tz, name = 'rest', t = 0) => {
  const ex = EX[name]; paint(ex.primary, ex.secondary); current = null; solve(ex.pose(t)); skin_(); props.clear();
  const a = az * Math.PI / 180, dir = new THREE.Vector3(Math.sin(a), -Math.cos(a), el).normalize(), tgt = new THREE.Vector3(tx, ty, tz);
  cam.position.copy(tgt).addScaledVector(dir, dist); cam.lookAt(tgt); cam.updateProjectionMatrix();
  key.position.copy(cam.position).add(new THREE.Vector3(-900, -300, 1600)); rim.position.set(-dir.x * 1000 + 600, 1500, 900);
  shadow.position.set(0, 20, (meta.ground ?? -70) + 1); shadow.scale.set(1100, 900, 1);
  renderer.render(scene, cam); return renderer.domElement.toDataURL('image/png');
};
