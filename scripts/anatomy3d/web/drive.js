// Drives the 3D figure from the app's own movement data (src/data/poses.ts), so every exercise the 2D animation can
// show, the 3D figure can show too, with the same joint angles, timing, pinned hands and feet, and equipment.
// The 2D solver runs here unchanged, with its limb lengths set to the 3D figure's, and gives the joint positions of
// each frame in the drawing plane. Each body segment is then turned to point the way its 2D bone points:
//   side view  = the plane through the body from front to back (turns about the left-right axis)
//   front view = the plane across the body (turns about the front-back axis); `mat` is that, lying on the back.
import * as THREE from 'three';
import { L, R as RAD, base, solve, phase, cycleSeconds, anchorOf, guideOf, NB } from '../../../src/data/poses.ts';
import { Rx, Ry, Rz, mul, I } from './moves.js';

// app muscle names -> the figure's muscle groups
const GROUPS = {
  chest: ['chest'], shoulders: ['delts', 'frontdelt'], triceps: ['triceps'], biceps: ['biceps'], forearms: ['forearms'], lats: ['lats'],
  'middle back': ['rhomboids', 'traps'], 'lower back': ['erectors'], traps: ['traps'], abdominals: ['abs', 'obliques'], quadriceps: ['quads'],
  hamstrings: ['hams'], glutes: ['glutes'], calves: ['calves'], adductors: ['adductors'], abductors: ['glutemed'], neck: ['neck'],
};
const groups = (names) => [...new Set((names || []).flatMap((n) => GROUPS[n] || []))];
const deg = (r) => r * 180 / Math.PI;
const ang = (a, b) => deg(Math.atan2(b[0] - a[0], -(b[1] - a[1]))); // 2D: clockwise from straight up
const JOINT = { kn: 'Knee bend', el: 'Elbow bend', hp: 'Hip bend', sh: 'Arm from body', an: 'Ankle' };

export function makeDriven(spec, J, seg) {
  const pose = spec.pose, front = pose.view === 'front', mat = pose.ground === 'mat';
  const v = (k) => new THREE.Vector3(J[k][0], J[k][1], J[k][2]), len = (a, b) => v(a).distanceTo(v(b));
  // one 2D unit in millimetres, and the 2D skeleton resized to the 3D figure
  const U = len('Lhip', 'Lknee') / 26;
  Object.assign(L, { thigh: 26, shin: len('Lknee', 'Lank') / U, upper: len('Lsh', 'Lel') / U, fore: len('Lel', 'Lwr') / U, torso: (J.Lsh[2] - J.pel[2]) / U + 4 });
  const b = base(pose);
  // where a 2D point sits in the room: forward is -y, up is +z, the figure's left is +x
  const room = (q, x = 0) => (front ? new THREE.Vector3(q[0] * U, 0, -q[1] * U) : new THREE.Vector3(x, -q[0] * U, -q[1] * U));
  // rest direction of every limb segment in the drawing plane
  const rest0 = (a, c) => { const d = v(c).sub(v(a)); return front ? deg(Math.atan2(d.x, d.z)) : deg(Math.atan2(-d.y, d.z)); };
  const turn = (a) => (front ? Ry(a) : Rx(a));
  const LIMB = {};
  for (const [s, n] of [['R', '0'], ['L', '1']]) {
    LIMB[s] = { n, upper: rest0(s + 'sh', s + 'el'), fore: rest0(s + 'el', s + 'wr'), hand: rest0(s + 'wr', s + 'tip'), thigh: rest0(s + 'hip', s + 'knee'), shank: rest0(s + 'knee', s + 'ank') };
  }
  const lie = mat ? Rx(-90) : I; // on the mat the whole figure lies on its back
  const tempo = pose.pace === 'cycle' || pose.pace === 'spin' ? 1.25 : 1.5; // a little slower than the 2D figure, for beginners
  let last = null;
  const ROLL = +(spec.roll ?? 90);
  // front view, sitting on the floor with the legs apart: the 2D figure draws the legs out to the sides, which in 3D
  // means legs forward along the floor, opened as far as the 2D hips open
  const openOf = (o, n) => Math.abs(ang(o['hp' + n], o['kn' + n]) - 180);
  const floorSit = front && !mat && !pose.sit && pose.ground === 'floor' && Math.abs(pose.start.spine) < 30 && openOf(b, '0') > 40 && openOf(b, '1') > 40;

  function pose3(p) {
    const o = solve(pose, b, p), a = {};
    const t = ang(o.pelvis, o.neck), hd = ang(o.neck, o.head);
    const c = front ? 0 : (pose.start.curve + (pose.end.curve - pose.start.curve) * p) * 0.6;
    a.pelvis = turn(t - 0.8 * c); a.lumbar = turn(t - 0.3 * c); a.chest = turn(t + 0.55 * c); a.neck = turn((t + 0.55 * c + hd) / 2); a.head = turn(hd);
    for (const s of ['R', 'L']) {
      const m = LIMB[s], n = m.n, sg = s === 'L' ? 1 : -1;
      const P = (k) => o[k + n];
      const up = ang(P('sh'), P('el')), fo = ang(P('el'), P('wr'));
      a[s + 'upper'] = turn(up - m.upper); a[s + 'fore'] = turn(fo - m.fore);
      // a hand that rests on the floor lies flat, pointing forward; otherwise it follows the forearm (and the wrist curl)
      const flex = pose.flex ? pose.flex[0] + (pose.flex[1] - pose.flex[0]) * p : 0;
      const onFloor = !front && pose.ground !== 'hang' && P('wr')[1] > -7 && Math.abs(((fo % 360) + 360) % 360 - 180) < 60;
      a[s + 'hand'] = onFloor ? Rx(90 - m.hand) : turn(fo + flex - m.hand);
      if (floorSit) {
        const bend = Math.abs(ang(o['kn' + n], o['an' + n]) - ang(o['hp' + n], o['kn' + n])), fold = bend > 60; // knees bent: the legs fold flat on the floor (butterfly)
        const open = Math.min(fold ? 62 : 50, openOf(o, n) * (fold ? 0.8 : 0.5));
        a[s + 'thigh'] = mul(Rz(sg * open), Rx(-88), Rz(fold ? sg * ROLL : 0)); a[s + 'shank'] = fold ? mul(a[s + 'thigh'], Rx(Math.min(bend, 125))) : a[s + 'thigh']; a[s + 'foot'] = fold ? a[s + 'shank'] : Rz(sg * open);
      } else if (front && pose.sit) { // seated facing the camera: thighs point at the viewer, opened as far as the 2D hips open
        const open = Math.abs(ang(P('hp'), P('kn')) - 180);
        a[s + 'thigh'] = mul(Rz(sg * Math.min(60, open)), Rx(-86)); a[s + 'shank'] = Rz(sg * Math.min(60, open)); a[s + 'foot'] = a[s + 'shank'];
      } else {
        const th = ang(P('hp'), P('kn')), sh = ang(P('kn'), P('an'));
        a[s + 'thigh'] = turn(th - m.thigh); a[s + 'shank'] = turn(sh - m.shank);
        a[s + 'foot'] = front ? a[s + 'shank'] : Rx(ang(P('heel'), P('toe')) - 90);
      }
    }
    if (mat) for (const k in a) a[k] = mul(lie, a[k]);
    const at = mat ? new THREE.Vector3(o.pelvis[0] * U, o.pelvis[1] * U, 118) : room(o.pelvis);
    if (floorSit) at.z = 112;
    last = { o, p };
    return { abs: a, plant: false, shift: at.sub(v('pel')) };
  }

  // ---- equipment. Built once, moved every frame.
  const steel = new THREE.MeshStandardMaterial({ color: 0x6d7682, roughness: 0.45, metalness: 0.35 }), dark = new THREE.MeshStandardMaterial({ color: 0x2f343b, roughness: 0.7, metalness: 0.1 });
  const padM = new THREE.MeshStandardMaterial({ color: 0x3f4650, roughness: 0.85 }), soft = new THREE.MeshStandardMaterial({ color: 0x4d7fb8, roughness: 0.6 });
  const wallM = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.9, transparent: true, opacity: 0.35 }), band = new THREE.MeshStandardMaterial({ color: 0xd0a030, roughness: 0.6 });
  const g = new THREE.Group(), UP = new THREE.Vector3(0, 1, 0);
  const stick = (r, m, parent = g) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 18), m); parent.add(s); s.put = (a, c) => { const d = c.clone().sub(a), l = d.length() || 1; s.position.copy(a).add(c).multiplyScalar(0.5); s.quaternion.setFromUnitVectors(UP, d.multiplyScalar(1 / l)); s.scale.set(1, l, 1); }; return s; };
  const ball = (r, m) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m); g.add(s); return s; };
  const slab = (w, d, h, m, x, y, z, rx = 0) => { const s = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), m); s.position.set(x, y, z); s.rotation.x = rx * Math.PI / 180; g.add(s); return s; };
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  // the middle of the closed hand
  const grip = (s) => { const { p, R } = seg(); return v(s + 'tip').sub(v(s + 'wr')).normalize().multiplyScalar(80).applyMatrix4(R[s + 'hand']).add(p[s + 'hand']); };
  const foreDir = (s) => { const { p } = seg(); return p[s + 'hand'].clone().sub(p[s + 'fore']).normalize(); };
  const hands = pose.one ? ['R'] : ['R', 'L'];
  const movers = [];
  const across = front ? Y : X; // the way a handle points: across the body in side view

  if (pose.prop === 'dumbbell') for (const s of hands) {
    const h = stick(14, steel), w1 = stick(46, dark), w2 = stick(46, dark);
    movers.push(() => { const c = grip(s), d = across; h.put(c.clone().addScaledVector(d, -95), c.clone().addScaledVector(d, 95)); w1.put(c.clone().addScaledVector(d, -105), c.clone().addScaledVector(d, -60)); w2.put(c.clone().addScaledVector(d, 60), c.clone().addScaledVector(d, 105)); });
  }
  if (pose.prop === 'kettlebell') for (const s of hands) {
    const k = ball(92, dark), h = stick(13, dark);
    movers.push(() => { const c = grip(s), d = foreDir(s).multiplyScalar(0.45).addScaledVector(Z, -0.9).normalize(); k.position.copy(c).addScaledVector(d, 140); /* the bell hangs under the hand */ h.put(c.clone().addScaledVector(across, -55), c.clone().addScaledVector(across, 55)); });
  }
  if (pose.prop === 'ball') { const k = ball(115, soft); movers.push(() => { const a = grip('R'), c = grip('L'); k.position.copy(a).add(c).multiplyScalar(0.5); if (pose.one) k.position.copy(a); }); }
  if (pose.prop === 'plate') { const d = stick(150, dark); movers.push(() => { const { p, R } = seg(), top = new THREE.Vector3(0, 0, 250).applyMatrix4(R.head).add(p.head), n = new THREE.Vector3(0, 0, 1).applyMatrix4(R.head); d.put(top, top.clone().addScaledVector(n, 30)); }); }
  if (pose.prop === 'barbell') {
    const small = !!pose.flex, half = small ? 420 : 900, pr = small ? 110 : 215;
    const bar = stick(14, steel), p1 = stick(pr, dark), p2 = stick(pr, dark);
    movers.push(() => {
      let c;
      if (pose.rack === 'back') { const { p, R } = seg(); c = new THREE.Vector3(0, 95, 250).applyMatrix4(R.chest).add(p.chest); } // across the upper back
      else c = grip('R').add(grip('L')).multiplyScalar(0.5);
      const d = front && pose.rack !== 'back' ? grip('L').sub(grip('R')).normalize() : X;
      bar.put(c.clone().addScaledVector(d, -half), c.clone().addScaledVector(d, half)); p1.put(c.clone().addScaledVector(d, -half + 20), c.clone().addScaledVector(d, -half + 70)); p2.put(c.clone().addScaledVector(d, half - 70), c.clone().addScaledVector(d, half - 20));
    });
  }
  if (pose.prop === 'band') {
    // band or cable from each hand to its fixed end; with no fixed end it is stretched between the hands
    const anchors = [anchorOf(pose, b, 0), anchorOf(pose, b, 1)];
    if (anchors[0] || anchors[1]) hands.forEach((s) => {
      const n = s === 'R' ? 0 : 1, q = anchors[n] || anchors[0], l = stick(7, band);
      const end = front ? room(q) : room(q, (s === 'R' ? -1 : 1) * 120);
      movers.push(() => l.put(grip(s), end));
    }); else { const l = stick(7, band); movers.push(() => l.put(grip('R'), grip('L'))); }
  }
  if (pose.prop === 'bar') {
    const b0 = [], bars = [];
    if (front || b.wr0[1] <= b.sh0[1]) { const s = stick(17, steel); bars.push(() => { const a = b0[0], c = b0[1]; const m = a.clone().add(c).multiplyScalar(0.5); s.put(m.clone().addScaledVector(X, -520), m.clone().addScaledVector(X, 520)); }); }
    else for (const i of [0, 1]) { const s = stick(17, steel), post = stick(17, steel); bars.push(() => { const a = b0[i]; s.put(a.clone().addScaledVector(Y, -330), a.clone().addScaledVector(Y, 330)); post.put(a.clone().addScaledVector(Y, 300), new THREE.Vector3(a.x, a.y + 300, 0)); }); } // parallel bars
    movers.push(() => { if (!b0.length) { b0.push(grip('R'), pose.one ? grip('R') : grip('L')); bars.forEach((f) => f()); } });
  }
  if (pose.machine === 'sled') { const s = slab(520, 30, 420, steel, 0, 0, 0); movers.push(() => { const { p, R } = seg(), m = p.Rfoot.clone().add(p.Lfoot).multiplyScalar(0.5); s.quaternion.setFromRotationMatrix(mul(R.Rfoot, Rx(90))); s.position.copy(new THREE.Vector3(0, -40, -95).applyMatrix4(R.Rfoot).add(m)); }); }
  if (pose.under) {
    const u = pose.under, k = ball(u.r * U, soft);
    const ux = (o) => (u.mid ? (o[u.at][0] + o[u.mid][0]) / 2 : o[u.at][0]);
    const fixedX = (ux(solve(pose, b, 0)) + ux(solve(pose, b, 1))) / 2;
    movers.push(() => { k.position.copy(room([u.fixed ? fixedX : ux(last.o), -u.r])); });
  }
  // fixed things, placed from the start pose
  const still = [];
  if (pose.ground === 'bench' && !mat) still.push(() => {
    const { p } = seg(), pel = p.pelvis, t = pose.start.spine, lying = !front && Math.abs(t) >= 62;
    if (lying) { // a flat bench under the back
      const mid = pel.clone().add(p.neck).multiplyScalar(0.5), top = Math.min(pel.z, p.neck.z) - 118;
      slab(320, pel.distanceTo(p.neck) + 420, 70, padM, 0, mid.y, top - 35); slab(90, 90, Math.max(10, top - 70), steel, 0, mid.y - 330, (top - 70) / 2); slab(90, 90, Math.max(10, top - 70), steel, 0, mid.y + 330, (top - 70) / 2);
      return;
    }
    const top = pel.z - 122;
    slab(pose.sit || front ? 620 : 420, 400, 70, padM, 0, pel.y - (front ? 60 : 70), top - 35); if (pose.machine !== 'bike') slab(90, 90, Math.max(10, top - 70), steel, 0, pel.y - 40, (top - 70) / 2);
    if (!front && Math.abs(t) >= 25 && pose.pad !== false && pose.machine !== 'bike') { // back pad, or chest pad when leaning onto it
      const r = t * Math.PI / 180, d = new THREE.Vector3(0, -Math.sin(r), Math.cos(r)), back = new THREE.Vector3(0, Math.cos(r), Math.sin(r));
      const n = Math.abs(Math.sin(r)) < 0.3 || back.z < 0 ? back : back.clone().negate();
      const c = pel.clone().addScaledVector(d, 300).addScaledVector(n, n === back ? 165 : 150);
      slab(300, 60, 560, padM, c.x, c.y, c.z, t);
      const foot = c.clone().addScaledVector(d, 240); if (foot.z > 120) slab(70, 70, foot.z, steel, 0, foot.y + (n === back ? 60 : -60), foot.z / 2);
    }
  });
  if (pose.box) still.push(() => { const q = b[pose.box], y = q[1] + (RAD[pose.box] ?? 3); if (y < -1) { const c = room(q), h = -y * U; slab(front ? 380 : 720, front ? 520 : 380, h, padM, front ? c.x : 0, front ? 0 : c.y, h / 2); } });
  if (pose.land && pose.lift) still.push(() => { const e = solve(pose, b, 1), c = room(e.an0), h = pose.lift * U; slab(720, 460, h, padM, 0, c.y, h / 2); });
  if (pose.wall && !front) still.push(() => { const wx = pose.wall === 'front' ? b.wr0[0] + 3.6 : Math.min(b.pelvis[0], b.neck[0]) - 9.5; slab(1100, 30, 1900, wallM, 0, -wx * U + (pose.wall === 'front' ? -75 : 60), 950); });
  if (pose.machine === 'treadmill') still.push(() => { const y = -b.pelvis[0] * U; slab(640, 1500, 60, dark, 0, y - 100, -31); slab(60, 60, 1050, steel, 300, y - 760, 525); slab(60, 60, 1050, steel, -300, y - 760, 525); slab(660, 80, 160, dark, 0, y - 760, 1100); });
  if (pose.machine === 'bike') still.push(() => { const { p } = seg(), c = p.Rfoot.clone().add(p.Lfoot).multiplyScalar(0.5); const s = stick(22, steel); s.put(new THREE.Vector3(0, p.pelvis.y + 40, p.pelvis.z - 150), new THREE.Vector3(0, c.y, c.z)); const s2 = stick(22, steel); s2.put(new THREE.Vector3(0, c.y, c.z), new THREE.Vector3(0, c.y, 0)); slab(120, 900, 40, steel, 0, (c.y + p.pelvis.y) / 2, 20); const ring = stick(95, dark); ring.put(new THREE.Vector3(-25, c.y, c.z), new THREE.Vector3(25, c.y, c.z)); });
  let built = false;

  const gd = guideOf(pose, b), j = gd.label.j, kind = j.slice(0, 2), [na, nb] = NB[j];
  const P3 = { pelvis: 'pelvis', neck: 'neck', hp: 'thigh', kn: 'shank', an: 'foot', sh: 'upper', el: 'fore', wr: 'hand' };
  const pt = (k) => { const { p } = seg(); if (k === 'pelvis') return p.pelvis; if (k === 'neck') return p.neck; if (k.startsWith('toe')) return new THREE.Vector3(0, -150, -60).applyMatrix4(seg().R.Rfoot).add(p.Rfoot); return p['R' + P3[k.slice(0, 2)]]; };
  const tall = !front && !mat && Math.abs(pose.start.spine) < 35 && (pose.ground ?? 'stand') === 'stand' && Math.abs(pose.end.spine - pose.start.spine) > 12;

  return {
    primary: groups(spec.primary), secondary: groups(spec.secondary).filter((x) => !groups(spec.primary).includes(x)),
    per: cycleSeconds(pose) * tempo, phase: (t) => phase(pose, t)[0], keepProps: true,
    pose: pose3,
    props: () => { if (!built) { built = true; still.forEach((f) => f()); } movers.forEach((f) => f()); return g; },
    shots: [{ az: mat ? -20 : front ? -16 : -62, el: mat ? 1.3 : 0.2, zoom: 1, f: 0 }],
    angles: () => {
      const out = [];
      if (kind === 'sh') out.push([pt(nb), pt(j), pt(na).clone().sub(pt(j)), JOINT.sh, true]); // arm against the line of the body
      else out.push([pt(na), pt(j), pt(nb), JOINT[kind], false, 180]);
      if (tall) out.push([seg().p.neck, seg().p.pelvis, Z, 'Back from upright', true]);
      return out;
    },
  };
}
