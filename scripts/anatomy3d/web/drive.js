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

export function makeDriven(spec, J, seg, meta = {}) {
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
  // ---- hands. A hand that holds something closes around it, and turns about its own long axis until the fingers
  // wrap the way the handle runs (a barbell runs across the body, parallel bars run front to back).
  const hasFing = !!meta.curl, X0 = new THREE.Vector3(1, 0, 0), Y0 = new THREE.Vector3(0, 1, 0);
  const holds = (s) => (['dumbbell', 'barbell', 'kettlebell', 'bar', 'band'].includes(pose.prop) || pose.kit === 'wheel' || pose.kit === 'stick') && (s === 'R' || !pose.one);
  const oneBell = pose.prop === 'kettlebell' && !pose.one && pose.view !== 'front' && !/two|double|alternating|seesaw|arnold|renegade|plyo|floor press/i.test(spec.name || '');
  const together = (oneBell || pose.clasp) && !front; // both hands on one handle: the arms close in to the middle
  const dipBars = pose.prop === 'bar' && !front && b.wr0[1] > b.sh0[1];
  // how each hand holds, decided once from the two ends of the move so the wrist never flips half way:
  // curls are held palm up, a weight hanging at the side is held palm in, everything else overhand
  const fromDown = (f) => Math.abs(((f % 360) + 360) % 360 - 180); // 0 = pointing straight down, 180 = straight up
  const HOLD = {};
  {
    const e0 = solve(pose, b, 0), e1 = solve(pose, b, 1);
    for (const [s, n] of [['R', '0'], ['L', '1']]) {
      const sg = s === 'L' ? 1 : -1, q = (o) => ({ up: ang(o['sh' + n], o['el' + n]), fo: ang(o['el' + n], o['wr' + n]) });
      const A0 = q(e0), A1 = q(e1), bend = (A) => Math.abs((((A.fo - A.up) % 360) + 540) % 360 - 180);
      const flexed = bend(A0) > bend(A1) ? A0 : A1;
      const isCurl = !front && Math.abs(bend(A0) - bend(A1)) > 60 && Math.abs((((A0.up - A1.up) % 360) + 540) % 360 - 180) < 40 && fromDown(flexed.fo) > 110;
      const down = fromDown(A0.fo) < 50 && fromDown(A1.fo) < 50, upAny = fromDown(A0.fo) > 140 || fromDown(A1.fo) > 140;
      const inward = new THREE.Vector3(-sg, 0, -1).normalize();
      let way = null, pref = 'far';
      if (together) { way = X0; pref = 'far'; }
      else if (pose.prop === 'barbell' || (pose.prop === 'bar' && !dipBars)) {  way = X0; pref = front ? new THREE.Vector3(0, upAny ? -1 : 1, 0) : isCurl ? 'near' : 'far'; }
      else if (dipBars) { way = Y0; pref = new THREE.Vector3(-sg, 0, 0); }
      else if (pose.prop === 'dumbbell' || pose.prop === 'kettlebell') {
        if (front) { way = upAny ? X0 : Y0; pref = upAny ? new THREE.Vector3(0, -1, 0) : inward; }
        else if (down && !isCurl) { way = Y0; pref = inward; }
        else { way = X0; pref = isCurl ? 'near' : 'far'; }
      }
      HOLD[s] = { way, pref };
    }
  }
  const twistTo = (Rb, s) => {
    const { way, pref } = HOLD[s];
    if (!hasFing || !way) return Rb;
    const d = v(s + 'tip').sub(v(s + 'wr')).normalize().applyMatrix4(Rb), c = new THREE.Vector3(...meta.curl[s]).applyMatrix4(Rb);
    const hp = way.clone().addScaledVector(d, -way.dot(d)); if (hp.lengthSq() < 0.04) return Rb; hp.normalize();
    const turned = (h) => mul(new THREE.Matrix4().makeRotationAxis(d, Math.atan2(new THREE.Vector3().crossVectors(c, h).dot(d), c.dot(h))), Rb);
    const A = turned(hp), B = turned(hp.clone().negate());
    if (pref === 'near' || pref === 'far') { const near = hp.dot(c) >= 0; return (pref === 'near') === near ? A : B; }
    const palm = (M) => new THREE.Vector3(0, -1, 0).applyMatrix4(M).dot(pref);
    return palm(A) >= palm(B) ? A : B;
  };
  const ROLL = +(spec.roll ?? 90);
  // front view, sitting on the floor with the legs apart: the 2D figure draws the legs out to the sides, which in 3D
  // means legs forward along the floor, opened as far as the 2D hips open
  const openOf = (o, n) => Math.abs(ang(o['hp' + n], o['kn' + n]) - 180);
  const floorSit = front && !mat && !pose.sit && pose.ground === 'floor' && Math.abs(pose.start.spine) < 30 && openOf(b, '0') > 40 && openOf(b, '1') > 40;

  // ---- extra turns only the 3D figure can make (pose.turn): which segments a named part moves, and about which line
  const Z0 = new THREE.Vector3(0, 0, 1);
  const CH = { arm: ['upper', 'fore', 'hand'], fore: ['fore', 'hand'], hand: ['hand'], leg: ['thigh', 'shank', 'foot'], shank: ['shank', 'foot'], foot: ['foot'] };
  const NEXT = { upper: ['sh', 'el'], fore: ['el', 'wr'], hand: ['wr', 'tip'], thigh: ['hip', 'knee'], shank: ['knee', 'ank'] }, UPOF = { fore: 'upper', hand: 'fore', shank: 'thigh', foot: 'shank' };
  const chainOf = (part, a) => {
    if (part === 'body') return [[Object.keys(a).map((k) => [k, 1]), 'pelvis', 1]];
    if (part === 'trunk') return [[[['lumbar', 0.4], ['chest', 1], ['neck', 1], ['head', 1], ...['R', 'L'].flatMap((s) => CH.arm.map((k) => [s + k, 1]))], 'lumbar', 1]];
    if (part === 'head') return [[[['neck', 0.5], ['head', 1]], 'head', 1]];
    const m = /^([RL]?)(arm|fore|hand|leg|shank|foot)$/.exec(part);
    if (!m) return [[[[part, 1]], part, 1]];
    return (m[1] ? [m[1]] : ['R', 'L']).map((s) => [CH[m[2]].map((k) => [s + k, 1]), s + CH[m[2]][0], !m[1] && s === 'L' ? -1 : 1]); // a pair turns as a mirror image; a named side turns as written
  };
  const boneDir = (k, a) => {
    const s = k[0], n = NEXT[k.slice(1)];
    return (n && (s === 'R' || s === 'L') ? v(s + n[1]).sub(v(s + n[0])) : v('neck').sub(v('pel'))).normalize().applyMatrix4(a[n ? k : 'chest'] || I);
  };
  const axisOf = (axis, pivot, a) => {
    if (axis === 'x') return X0.clone(); if (axis === 'y') return Y0.clone(); if (axis === 'z') return Z0.clone();
    if (axis === 'px' || axis === 'py' || axis === 'pz') return (axis === 'px' ? X0 : axis === 'py' ? Y0 : Z0).clone().applyMatrix4(a.pelvis);
    if (axis === 'spine') return v('neck').sub(v('pel')).normalize().applyMatrix4(a.lumbar);
    if (axis === 'up') { const u = UPOF[pivot.slice(1)]; return u ? boneDir(pivot[0] + u, a) : axisOf('spine', pivot, a); }
    return boneDir(pivot, a); // 'bone': the part's own long line
  };

  function pose3(p) {
    const o = solve(pose, b, p), a = {}, curl = {};
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
      if (together) {
        const w = room(P('wr')).sub(room(P('sh'))), n = new THREE.Vector3().crossVectors(w, X0);
        if (n.lengthSq() > 1) { const Q = new THREE.Matrix4().makeRotationAxis(n.normalize(), -sg * Math.asin(Math.min(0.9, (Math.abs(J[s + 'sh'][0]) - 48) / Math.max(w.length(), 1)))); for (const k of ['upper', 'fore', 'hand']) a[s + k] = mul(Q, a[s + k]); }
      }
      if (!onFloor && holds(s)) a[s + 'hand'] = twistTo(a[s + 'hand'], s);
      curl[s] = onFloor ? 0 : holds(s) ? 1 : pose.prop === 'ball' ? 0.3 : 0.22;
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
    // ---- what only the 3D figure can show
    const lerp = (r) => r[0] + (r[1] - r[0]) * p;
    if (front && !mat) { // an arm that reaches across the body goes in front of the chest, not through it
      let c = 0; const mid = o.neck[0];
      for (const n of ['0', '1']) c = Math.max(c, (mid - o['wr' + n][0]) * Math.sign(o['sh' + n][0] - mid));
      const phi = 42 * Math.max(0, Math.min(1, (c - 1) / 7));
      if (phi > 0) for (const s of ['R', 'L']) {
        const n = LIMB[s].n, d = room(o['wr' + n]).sub(room(o['sh' + n])); const l = d.length() || 1;
        const Q = Rz(-Math.sign(d.x) * phi * Math.min(1, Math.abs(d.x) / l * 1.6));
        for (const k of ['upper', 'fore', 'hand']) a[s + k] = mul(Q, a[s + k]);
      }
    }
    if (pose.splay && !front) { // near thigh opens out to the side, about the line of the trunk
      const ax = room(o.neck).sub(room(o.pelvis)).normalize(), Q = new THREE.Matrix4().makeRotationAxis(ax, -lerp(pose.splay) * Math.PI / 180);
      for (const k of ['thigh', 'shank', 'foot']) a['R' + k] = mul(Q, a['R' + k]);
    }
    if (pose.swing && !front) { // near forearm turns about the upper arm (shoulder rotation)
      const ax = room(o.el0).sub(room(o.sh0)).normalize(), Q = new THREE.Matrix4().makeRotationAxis(ax, lerp(pose.swing) * Math.PI / 180);
      for (const k of ['fore', 'hand']) a['R' + k] = mul(Q, a['R' + k]);
    }
    if (pose.twist && !front) { // the upper body turns about the spine
      const ax = room(o.neck).sub(room(o.pelvis)).normalize(), th = lerp(pose.twist) * Math.PI / 180, Q = (f) => new THREE.Matrix4().makeRotationAxis(ax, th * f);
      a.lumbar = mul(Q(0.4), a.lumbar);
      for (const k of ['chest', 'neck', 'Rupper', 'Rfore', 'Rhand', 'Lupper', 'Lfore', 'Lhand']) a[k] = mul(Q(1), a[k]);
      a.head = mul(Q(0.75), a.head);
    }
    if (pose.turn) for (const [parts, axis, a0, a1] of pose.turn) for (const part of parts.split(',')) for (const [keys, pivot, sg] of chainOf(part, a)) {
      const val = axis === 'cone' ? a0 : a0 + (a1 - a0) * p; let ax;
      if (axis === 'cone') { // the part leans `a0` degrees off its own line and that lean goes round once per repeat
        const d = boneDir(pivot, a), e1 = new THREE.Vector3().crossVectors(d, Math.abs(d.z) < 0.9 ? Z0 : X0).normalize(), e2 = new THREE.Vector3().crossVectors(d, e1), f = (360 * p + a1) * Math.PI / 180 * sg;
        ax = e1.multiplyScalar(Math.cos(f)).addScaledVector(e2, Math.sin(f));
      } else ax = axisOf(axis, pivot, a);
      const mir = axis === 'x' || axis === 'px' || axis === 'cone' ? 1 : sg;
      for (const [k, w] of keys) if (a[k]) a[k] = mul(new THREE.Matrix4().makeRotationAxis(ax, val * w * mir * Math.PI / 180), a[k]);
    }
    const tl = pose.tilt2 != null ? pose.tilt + (pose.tilt2 - pose.tilt) * p : pose.tilt;
    const lean = front && pose.tilt ? Rx(tl) : null, whole = lean && !pose.sit && (pose.ground === 'bench' || pose.ground === 'floor');
    if (lean) for (const k in a) if (whole || !/thigh|shank|foot/.test(k)) a[k] = mul(lean, a[k]);
    if (mat) for (const k in a) a[k] = mul(lie, a[k]);
    const at = mat ? new THREE.Vector3(o.pelvis[0] * U, o.pelvis[1] * U, 118) : room(o.pelvis);
    if (floorSit) at.z = 112;
    if (pose.rise) at.z = lerp(pose.rise) * U;
    if (pose.slide) at.y -= lerp(pose.slide) * U;
    if (pose.orbit) { // the hips draw a level circle while the feet stay where they are
      const f = 2 * Math.PI * p, dx = pose.orbit * U * Math.cos(f), dy = pose.orbit * U * Math.sin(f); at.x += dx; at.y += dy;
      for (const s of ['R', 'L']) { const d = v(s + 'ank').sub(v(s + 'hip')).applyMatrix4(a[s + 'thigh']), d2 = d.clone().sub(new THREE.Vector3(dx, dy, 0)), Q = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(d.clone().normalize(), d2.normalize())); for (const k of ['thigh', 'shank']) a[s + k] = mul(Q, a[s + k]); }
    }
    if (whole) { // lying or leaning chest down: flat on the floor or a flat bench, or on an incline with the feet on the floor
      if (pose.rise) { /* placed by hand */ } else if (pose.tilt >= 80) at.set(at.x, 0, pose.ground === 'floor' ? 112 : 560);
      else { const an = v('Lank'), up = v('pel').sub(new THREE.Vector3(0, an.y, an.z)); up.x = 0; at.copy(up.applyMatrix4(lean)).add(new THREE.Vector3(at.x, an.y, an.z)); }
    }
    if (pose.sway) at.x += lerp(pose.sway) * U;
    last = { o, p };
    return { abs: a, curl, plant: false, shift: at.sub(v('pel')), hang: pose.prop === 'bar' };
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
  // the middle of the closed hand, and the way a handle held in it runs
  const grip = (s) => { const { p, R } = seg(); return (meta.palm ? new THREE.Vector3(...meta.palm[s]) : v(s + 'tip').sub(v(s + 'wr')).normalize().multiplyScalar(80)).applyMatrix4(R[s + 'hand']).add(p[s + 'hand']); };
  const handle = (s) => (meta.curl ? new THREE.Vector3(...meta.curl[s]).applyMatrix4(seg().R[s + 'hand']).normalize() : across.clone());
  const foreDir = (s) => { const { p } = seg(); return p[s + 'hand'].clone().sub(p[s + 'fore']).normalize(); };
  const hands = pose.one ? ['R'] : ['R', 'L'];
  const movers = [];
  const across = front ? Y : X; // the way a handle points: across the body in side view

  if (pose.prop === 'dumbbell') for (const s of hands) {
    const h = stick(14, steel), w1 = stick(46, dark), w2 = stick(46, dark);
    movers.push(() => { const c = grip(s), d = handle(s); h.put(c.clone().addScaledVector(d, -95), c.clone().addScaledVector(d, 95)); w1.put(c.clone().addScaledVector(d, -105), c.clone().addScaledVector(d, -60)); w2.put(c.clone().addScaledVector(d, 60), c.clone().addScaledVector(d, 105)); });
  }
  // one bell held in both hands by the same handle (swings, goblet squat), unless the name says there are two
  if (pose.prop === 'kettlebell') for (const s0 of oneBell || pose.pass ? ['R'] : hands) {
    const k = ball(92, dark), h = stick(13, dark);
    movers.push(() => {
      const s = pose.pass && last.p > 0.5 ? 'L' : s0; // handed from one hand to the other half way
      const c = oneBell ? grip('R').add(grip('L')).multiplyScalar(0.5) : grip(s), d = foreDir(s).multiplyScalar(0.45).addScaledVector(Z, -0.9).normalize();
      const upF = Math.max(0, foreDir(s).z); k.position.copy(c).addScaledVector(d, 140 + 70 * upF); if (!oneBell) k.position.x += (s === 'L' ? 1 : -1) * 75 * upF; /* the bell hangs under the hand; with the forearm upright it rests against the outside of the wrist */
      const hd = oneBell ? grip('L').sub(grip('R')).normalize() : handle(s), w = oneBell ? Math.max(55, grip('L').distanceTo(grip('R')) / 2 + 45) : 55;
      h.put(c.clone().addScaledVector(hd, -w), c.clone().addScaledVector(hd, w));
    });
  }
  if (pose.prop === 'ball') { const k = ball(115, soft); movers.push(() => { const a = grip('R'), c = grip('L'); k.position.copy(a).add(c).multiplyScalar(0.5); if (pose.one) k.position.copy(a); }); }
  if (pose.prop === 'plate') { const d = stick(150, dark); movers.push(() => { const { p, R } = seg(), top = new THREE.Vector3(0, 0, 250).applyMatrix4(R.head).add(p.head), n = new THREE.Vector3(0, 0, 1).applyMatrix4(R.head); d.put(top, top.clone().addScaledVector(n, 30)); }); }
  if (pose.prop === 'barbell') {
    const overHips = !front && !pose.rack && pose.start.spine < -55 && Math.abs(pose.start.shoulder[0]) < 40 && Math.abs(pose.end.shoulder[0]) < 40;
    const small = !!pose.flex, half = small ? 420 : 900, pr = small ? 110 : 215;
    const bar = stick(14, steel), p1 = stick(pr, dark), p2 = stick(pr, dark);
    movers.push(() => {
      let c;
      if (pose.rack === 'back') { const { p, R } = seg(); c = new THREE.Vector3(0, 95, 250).applyMatrix4(R.chest).add(p.chest); } // across the upper back
      else if (overHips) { const { p, R } = seg(); c = new THREE.Vector3(0, -150, 30).applyMatrix4(R.pelvis).add(p.pelvis); } // resting in the crease of the hips
      else c = grip('R').add(grip('L')).multiplyScalar(0.5);
      const d = front ? (pose.rack === 'back' ? X.clone().applyMatrix4(seg().R.chest) : grip('L').sub(grip('R')).normalize()) : X; // across the shoulders it leans with them
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
    const u = pose.under, k = u.fixed ? stick(u.r * U, soft) : ball(u.r * U, soft);
    const ux = (o) => (u.mid ? (o[u.at][0] + o[u.mid][0]) / 2 : o[u.at][0]);
    const fixedX = (ux(solve(pose, b, 0)) + ux(solve(pose, b, 1))) / 2;
    movers.push(() => { const c = room([u.fixed ? fixedX : ux(last.o), -u.r]); if (u.fixed) k.put(c.clone().addScaledVector(across, -230), c.clone().addScaledVector(across, 230)); else k.position.copy(c); });
  }
  if (pose.rest) { // a ball or foam roller under a part of the body, wherever the 3D figure has put it
    const u = pose.rest, k = u.roller ? stick(u.r * U, soft) : ball(u.r * U, soft); let c0 = null;
    movers.push(() => {
      const { p } = seg(), c = new THREE.Vector3(); u.on.forEach((n) => c.add(p[n])); c.multiplyScalar(1 / u.on.length); c.z = u.r * U; if (u.dx) c.x += u.dx * U; if (u.dy) c.y -= u.dy * U;
      if (u.fixed) c0 = c0 || c.clone();
      const q = c0 || c; if (u.roller) { const d = u.along ? Y : X; k.put(q.clone().addScaledVector(d, -230), q.clone().addScaledVector(d, 230)); } else k.position.copy(q);
    });
  }
  if (pose.kit === 'wheel') { const d = stick(1, dark); movers.push(() => { const a = grip('R'), e = grip('L'), c = a.clone().add(e).multiplyScalar(0.5), n = foreDir('R').add(foreDir('L')).normalize(), r = a.distanceTo(e) / 2 + 12; d.put(c.clone().addScaledVector(n, -14), c.clone().addScaledVector(n, 14)); d.scale.x = d.scale.z = r; }); }
  if (pose.kit === 'stick') { const d = stick(30, soft); movers.push(() => { const a = grip('R'), c = grip('L'), n = c.clone().sub(a).normalize(); d.put(a.addScaledVector(n, -70), c.addScaledVector(n, 70)); }); }
  if (pose.kit === 'footbar') { // a machine's bar pushed by the soles of the feet
    const bar = stick(14, steel), p1 = stick(215, dark), p2 = stick(215, dark);
    movers.push(() => { const { p, R } = seg(), c = new THREE.Vector3(0, -60, -70).applyMatrix4(R.Rfoot).add(p.Rfoot.clone().add(p.Lfoot).multiplyScalar(0.5)); c.x = 0; bar.put(c.clone().addScaledVector(X, -900), c.clone().addScaledVector(X, 900)); p1.put(c.clone().addScaledVector(X, -880), c.clone().addScaledVector(X, -830)); p2.put(c.clone().addScaledVector(X, 830), c.clone().addScaledVector(X, 880)); });
  }
  if (pose.kit === 'rollbars') { // two short bars on the floor that roll apart under the hands
    for (const sd of ['R', 'L']) { const bar = stick(13, steel), p1 = stick(70, dark), p2 = stick(70, dark); movers.push(() => { const c = grip(sd); c.z = 70; bar.put(c.clone().addScaledVector(Y, -330), c.clone().addScaledVector(Y, 330)); p1.put(c.clone().addScaledVector(Y, -320), c.clone().addScaledVector(Y, -280)); p2.put(c.clone().addScaledVector(Y, 280), c.clone().addScaledVector(Y, 320)); }); }
  }
  if (pose.kit === 'midbox') slab(24 * U, 420, 6.5 * U, padM, 0, 0, 3.25 * U); // a low box in the middle, stepped over from side to side
  if (pose.kit === 'door') { // the two sides of a doorway, where the hands are at the start
    const l = stick(45, wallM), r = stick(45, wallM); let done = false;
    movers.push(() => { if (done) return; done = true; for (const [s, m] of [['R', r], ['L', l]]) { const c = grip(s); m.put(new THREE.Vector3(c.x, c.y - 30, 0), new THREE.Vector3(c.x, c.y - 30, 2050)); } });
  }
  // fixed things, placed from the start pose
  const still = [];
  if (pose.ground === 'bench' && !mat) still.push(() => {
    const { p } = seg(), pel = p.pelvis, t = pose.start.spine, lying = !front && Math.abs(t) >= 62;
    if (front && pose.tilt && !pose.sit) { // chest down: a flat bench under the trunk, or an incline pad under the chest
      const r = pose.tilt * Math.PI / 180, d = new THREE.Vector3(0, -Math.sin(r), Math.cos(r)), n = new THREE.Vector3(0, -Math.cos(r), -Math.sin(r));
      if (pose.tilt >= 80) { const top = pel.z - 112; slab(300, 1150, 70, padM, 0, pel.y - 120, top - 35); slab(90, 90, top - 70, steel, 0, pel.y - 560, (top - 70) / 2); slab(90, 90, top - 70, steel, 0, pel.y + 330, (top - 70) / 2); }
      else { const c = pel.clone().addScaledVector(d, 250).addScaledVector(n, 150); slab(300, 60, 760, padM, 0, c.y, c.z, pose.tilt); const foot = c.clone().addScaledVector(d, 300); slab(70, 70, foot.z, steel, 0, foot.y - 60, foot.z / 2); slab(70, 70, Math.max(10, c.z - 330), steel, 0, c.y + 230, Math.max(10, c.z - 330) / 2); }
      return;
    }
    if (lying) { // a flat bench under the back
      if (pose.rise) { const top = pel.z - 165; slab(420, 1950, 70, padM, 0, pel.y + 150, top - 35); slab(90, 90, Math.max(10, top - 70), steel, 0, pel.y - 500, (top - 70) / 2); slab(90, 90, Math.max(10, top - 70), steel, 0, pel.y + 800, (top - 70) / 2); return; } // lying on the side along a bench
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

  // ---- what is measured. No number sits on the figure: live.js draws a thin arc at each joint and shows the moving
  // numbers in a strip beside it. Three at most: the joint that does the work, the joint or limb that goes with it,
  // and the posture of the trunk against the upright or the floor.
  const gd = guideOf(pose, b), j = gd.label.j, kind = j.slice(0, 2);
  const P3 = { pelvis: 'pelvis', neck: 'neck', hp: 'thigh', kn: 'shank', an: 'foot', sh: 'upper', el: 'fore', wr: 'hand' };
  const pt = (k) => { const { p } = seg(); if (k === 'pelvis') return p.pelvis; if (k === 'neck') return p.neck; if (k.startsWith('toe')) return new THREE.Vector3(0, -150, -60).applyMatrix4(seg().R.Rfoot).add(p.Rfoot); return p['R' + P3[k.slice(0, 2)]]; };
  const level = (d) => { const f = new THREE.Vector3(d.x, d.y, 0); return f.lengthSq() > 1 ? f : across.clone().cross(Z); }; // the same line laid flat on the floor
  const READ = {
    kn: { label: 'Knee bend', pts: () => [pt('hp0'), pt('kn0'), pt('an0')], sub: 180 },
    el: { label: 'Elbow bend', pts: () => [pt('sh0'), pt('el0'), pt('wr0')], sub: 180 },
    hp: { label: 'Hip bend', pts: () => [pt('kn0'), pt('hp0'), pt('neck')], sub: 180 },
    sh: { label: 'Arm from body', pts: () => [pt('el0'), pt('sh0'), seg().p.pelvis.clone().sub(seg().p.neck)], base: true }, // against the line of the trunk
    an: { label: 'Ankle', pts: () => [pt('kn0'), pt('an0'), pt('toe0')], sub: 180 },
    thigh: { label: 'Thigh to floor', pts: () => [pt('hp0'), pt('kn0'), level(pt('hp0').clone().sub(pt('kn0')))], base: true },
    fore: { label: 'Forearm tilt', pts: () => [pt('wr0'), pt('el0'), Z.clone().multiplyScalar(pt('wr0').z >= pt('el0').z ? 1 : -1)], base: true },
    upright: { label: front ? 'Side lean' : 'Back lean', pts: () => [seg().p.neck, seg().p.pelvis, Z], base: true },
    floor: { label: 'Body to floor', pts: () => [seg().p.neck, seg().p.pelvis, level(seg().p.neck.clone().sub(seg().p.pelvis))], base: true, flat: true },
  };
  const JK = { hp: 'hip', kn: 'knee', an: 'ankle', sh: 'shoulder', el: 'elbow' }, moves = (k) => Math.abs(pose.end[JK[k]][0] - pose.start[JK[k]][0]);
  // called by live.js once, with the figure standing in the key position of the move
  const reads = () => {
    const out = [READ[kind]], d = seg().p.neck.clone().sub(seg().p.pelvis).normalize(), standing = (pose.ground ?? 'stand') === 'stand';
    const squat = kind === 'kn' && standing && d.z > 0.5 && moves('kn') > 40;
    const other = Object.keys(JK).filter((k) => k !== kind && k !== 'an').sort((x, y) => moves(y) - moves(x))[0];
    out.push(squat ? READ.thigh : READ[moves(other) > 12 ? other : { kn: 'hp', hp: 'kn', el: 'sh', sh: 'el', an: 'kn' }[kind]]);
    if (!mat && d.z > 0.5) out.push(READ.upright); else if (!mat && d.z > -0.5) out.push(READ.floor);
    if (kind === 'el' && d.z <= 0.5) out.push(READ.fore); // lying presses: the forearm stays upright under the weight
    return out;
  };

  return {
    primary: groups(spec.primary), secondary: groups(spec.secondary).filter((x) => !groups(spec.primary).includes(x)),
    per: cycleSeconds(pose) * tempo, phase: (t) => phase(pose, t)[0], keepProps: true,
    pose: pose3,
    props: () => { if (!built) { built = true; still.forEach((f) => f()); } movers.forEach((f) => f()); return g; },
    shots: [{ az: pose.az != null ? pose.az : mat ? -20 : front ? (pose.tilt ? -52 : -16) : pose.twist || pose.splay || pose.swing ? -40 : -62, el: pose.el != null ? pose.el : mat ? 1.3 : 0.2, zoom: 1, f: 0 }],
    reads, key: gd.label.key, level: across.clone().cross(Z), // the level line in the plane the body moves in
  };
}
