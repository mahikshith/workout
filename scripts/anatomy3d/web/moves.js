// The moves the 3D figure can do, shared by the clip renderer (main.js) and the live viewer (live.js).
// Each move has a pose(t) for t = 0 (start) to 1 (end), the muscle groups it works, the props around the figure,
// the camera shots of the guided clip and the angles it reads out against a baseline.
import * as THREE from 'three';
export const Rx = (d) => new THREE.Matrix4().makeRotationX(d * Math.PI / 180), Ry = (d) => new THREE.Matrix4().makeRotationY(d * Math.PI / 180), Rz = (d) => new THREE.Matrix4().makeRotationZ(d * Math.PI / 180);
export const mul = (...m) => m.reduce((a, b) => a.clone().multiply(b));
export const I = new THREE.Matrix4();
export const lerp = (a, b, t) => a + (b - a) * t, ease = (t) => t * t * (3 - 2 * t);
export function angleLabel(g2, proj, SIZE, placed, a, b, c, label, base, sub) {
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
// seg() returns { p, R } of the pose solved last: the joint positions and segment rotations
export function makeMoves(seg) {
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
        loc: { Lfore: Rx(-22), Rfore: Rx(-22), Lhand: Rx(-10), Rhand: Rx(-10) }, curl: { L: 0.9, R: 0.9 }, phi };
    },
    props: (pose) => {
      const { p, R } = seg(), g = new THREE.Group(), pel = p.pelvis, ch = p.chest;
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
const flat = (v) => new THREE.Vector3(v.x, v.y, 0);
// measured against baselines: the floor (horizontal) and upright (vertical)
EX.squat.angles = (p) => [[p.Lthigh, p.Lshank, flat(p.Lthigh.clone().sub(p.Lshank)), 'Thigh to floor', true], [p.Lupper, p.Lthigh, new THREE.Vector3(0, 0, 1), 'Back from upright', true]];
EX.fly.angles = (p) => [[p.Lfore, p.Lupper, p.Lupper.clone().sub(p.Rupper), 'Arm from shoulder line', true], [p.Lupper, p.Lfore, p.Lhand, 'Elbow bend', false, 180]];
EX.squat.shots = [{ az: 49, el: 0.22, zoom: 1, f: 0 }, { az: 88, el: 0.1, zoom: 0.96, f: 0 }, { az: 30, el: 0.3, zoom: 0.62, f: 0.8 }];
EX.fly.shots = [{ az: 32, el: 0.26, zoom: 1, f: 0 }, { az: 0, el: 0.16, zoom: 0.94, f: 0 }, { az: 24, el: 0.42, zoom: 0.56, f: 0.9 }];
return EX;
}
