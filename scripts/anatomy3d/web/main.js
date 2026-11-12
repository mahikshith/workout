import * as THREE from 'three';
const SIZE = +(new URLSearchParams(location.search).get('size') || 720);
const bin = async (u, T) => new T(await (await fetch(u)).arrayBuffer());
const [V0, F, BI, BW, meta] = await Promise.all([bin('/web/V.bin', Float32Array), bin('/web/F.bin', Uint32Array), bin('/web/bi.bin', Uint8Array), bin('/web/bw.bin', Float32Array), (await fetch('/web/meta.json')).json()]);
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
{
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(rest, 3));
  g.setIndex(new THREE.BufferAttribute(F.subarray(skin.f0 * 3, (skin.f0 + skin.nf) * 3), 1)); g.computeVertexNormals();
  const n = g.attributes.normal.array;
  // class per skin vertex: 1 head, 2 hand, 3 foot, 4 abs, 5 lats, 0 dropped
  var skinClass = new Uint8Array(N);
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
const PAL = { muscle: C('#a89a94'), bone: C('#e9e3d6'), cart: C('#d9d6cf'), lig: C('#dcd6cc'), skin: C('#9b9896'), primary: C('#d2322a'), secondary: C('#e58a78') };
function paint(primary, secondary) {
  meta.parts.forEach((p, pi) => {
    let c = PAL[p.kind];
    if (p.groups.some((g) => secondary.includes(g))) c = PAL.secondary;
    if (p.groups.some((g) => primary.includes(g))) c = PAL.primary;
    for (let i = p.v0; i < p.v0 + p.nv; i++) {
      let cc = c;
      if (pi === skinI) { const k = skinClass[i]; cc = k === 4 ? (primary.includes('abs') ? PAL.primary : PAL.muscle) : k === 5 ? (primary.includes('lats') ? PAL.primary : PAL.muscle) : PAL.skin; }
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
  shadow.position.set(c.x, c.y + 20, -70); shadow.scale.set(1100, 900, 1);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
};
window.ready = true;
