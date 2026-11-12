#!/usr/bin/env python3
"""Coarse anatomical measurements (no mesh copied) from the prepared BodyParts3D arrays.
Run: python3 -I measure.py   -> reference.json, reference.md next to this file."""
import json, os, sys
import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
V = np.load(os.path.join(D, 'V.npy')).astype(np.float64)
P = json.load(open(os.path.join(D, 'parts.json')))
J = {k: np.array(v, float) for k, v in json.load(open(os.path.join(D, 'web', 'meta.json')))['joints'].items()}

LIMBS = {'arm': ('Lsh', 'Lel'), 'forearm': ('Lel', 'Lwr'), 'thigh': ('Lhip', 'Lknee'), 'shank': ('Lknee', 'Lank')}
TRUNK_AXIS = np.array([0.0, -60.0])

# key: (frame, [exact part names])
L = 'Left '
MUSCLES = {
    'pec_major_clavicular': ('trunk', ['Clavicular part of left pectoralis major']),
    'pec_major_sternocostal': ('trunk', ['Sternocostal part of left pectoralis major']),
    'pec_major_abdominal': ('trunk', ['Abdominal part of left pectoralis major']),
    'deltoid_clavicular': ('arm', ['Clavicular part of left deltoid']),
    'deltoid_acromial': ('arm', ['Acromial part of left deltoid']),
    'deltoid_spinal': ('arm', ['Spinal part of left deltoid']),
    'trapezius_descending': ('trunk', ['Descending part of left trapezius']),
    'trapezius_transverse': ('trunk', ['Transverse part of left trapezius']),
    'trapezius_ascending': ('trunk', ['Ascending part of left trapezius']),
    'biceps_long_head': ('arm', ['Long head of left biceps brachii']),
    'biceps_short_head': ('arm', ['Short head of left biceps brachii']),
    'brachialis': ('arm', [L + 'brachialis']),
    'triceps_long_head': ('arm', ['Long head of left triceps brachii']),
    'triceps_lateral_head': ('arm', ['Lateral head of left triceps brachii']),
    'triceps_medial_head': ('arm', ['Medial head of left triceps brachii']),
    'brachioradialis': ('forearm', [L + 'brachioradialis']),
    'ext_carpi_radialis_longus': ('forearm', [L + 'extensor carpi radialis longus']),
    'ext_carpi_radialis_brevis': ('forearm', [L + 'extensor carpi radialis brevis']),
    'ext_digitorum': ('forearm', [L + 'extensor digitorum']),
    'ext_carpi_ulnaris': ('forearm', [L + 'extensor carpi ulnaris']),
    'flex_carpi_radialis': ('forearm', [L + 'flexor carpi radialis']),
    'flex_carpi_ulnaris': ('forearm', ['Humeral head of left flexor carpi ulnaris', 'Ulnar head of left flexor carpi ulnaris']),
    'palmaris_longus': ('forearm', [L + 'palmaris longus']),
    'flex_digitorum_superficialis': ('forearm', [L + 'flexor digitorum superficialis']),
    'pronator_teres': ('forearm', ['Humeral head of left pronator teres']),
    'serratus_anterior': ('trunk', [L + 'serratus anterior']),
    'external_oblique': ('trunk', [L + 'external oblique']),
    'erector_iliocostalis_lumborum': ('trunk', [L + 'iliocostalis lumborum']),
    'erector_iliocostalis_thoracis': ('trunk', [L + 'iliocostalis thoracis']),
    'erector_longissimus_thoracis': ('trunk', [L + 'longissimus thoracis']),
    'erector_spinalis_thoracis': ('trunk', [L + 'spinalis thoracis']),
    'infraspinatus': ('trunk', [L + 'infraspinatus muscle']),
    'teres_major': ('trunk', [L + 'teres major']),
    'teres_minor': ('trunk', [L + 'teres minor']),
    'gluteus_maximus': ('trunk', [L + 'gluteus maximus']),
    'gluteus_medius': ('trunk', [L + 'gluteus medius']),
    'tensor_fasciae_latae': ('thigh', [L + 'tensor fasciae latae']),
    'rectus_femoris': ('thigh', [L + 'rectus femoris']),
    'vastus_lateralis': ('thigh', [L + 'vastus lateralis']),
    'vastus_medialis': ('thigh', [L + 'vastus medialis']),
    'sartorius': ('thigh', [L + 'sartorius']),
    'adductor_longus': ('thigh', [L + 'adductor longus']),
    'adductor_magnus': ('thigh', [L + 'adductor magnus']),
    'gracilis': ('thigh', [L + 'gracilis']),
    'biceps_femoris_long_head': ('thigh', ['Long head of left biceps femoris']),
    'biceps_femoris_short_head': ('thigh', ['Short head of left biceps femoris']),
    'semitendinosus': ('thigh', [L + 'semitendinosus']),
    'semimembranosus': ('thigh', [L + 'semimembranosus']),
    'gastrocnemius_lateral': ('shank', ['Lateral head of left gastrocnemius']),
    'gastrocnemius_medial': ('shank', ['Medial head of left gastrocnemius']),
    'soleus': ('shank', [L + 'soleus']),
    'tibialis_anterior': ('shank', [L + 'tibialis anterior']),
    'fibularis_longus': ('shank', [L + 'fibularis longus']),
    'ext_digitorum_longus': ('shank', [L + 'extensor digitorum longus']),
    'sternocleidomastoid': ('trunk', [L + 'sternocleidomastoid']),
}
STATIONS = [0.05, 0.25, 0.5, 0.75, 0.95]


def unit(v):
    return v / np.linalg.norm(v)


def limb_frame(name):
    a, b = (J[k] for k in LIMBS[name])
    ax = b - a
    ln = np.linalg.norm(ax)
    ax = ax / ln
    f = np.array([0.0, -1.0, 0.0])
    f = unit(f - ax * f.dot(ax))
    l = np.cross(f, ax)
    if l[0] < 0:
        l = -l
    return a, ax, ln, f, l


FR = {k: limb_frame(k) for k in LIMBS}


def limb_coords(name, pts):
    """returns t, angle(deg), radius, outward unit vectors"""
    a, ax, ln, f, l = FR[name]
    d = np.atleast_2d(pts) - a
    s = d.dot(ax)
    perp = d - np.outer(s, ax)
    r = np.linalg.norm(perp, axis=1)
    ang = np.degrees(np.arctan2(perp.dot(l), perp.dot(f))) % 360
    out = perp / np.maximum(r, 1e-9)[:, None]
    return s / ln, ang, r, out


def trunk_coords(pts):
    pts = np.atleast_2d(pts)
    dx = pts[:, 0] - TRUNK_AXIS[0]
    dy = pts[:, 1] - TRUNK_AXIS[1]
    r = np.hypot(dx, dy)
    ang = np.degrees(np.arctan2(dx, -dy)) % 360
    out = np.stack([dx, dy, np.zeros_like(dx)], 1) / np.maximum(r, 1e-9)[:, None]
    return pts[:, 2], ang, r, out


def surf(frame, pts):
    if frame == 'trunk':
        z, ang, r, out = trunk_coords(pts)
        return [{'z': int(round(a)), 'ang': int(round(b)) % 360, 'r': int(round(c))} for a, b, c in zip(z, ang, r)], r, out
    t, ang, r, out = limb_coords(frame, pts)
    return [{'t': round(float(a), 2), 'ang': int(round(b)) % 360, 'r': int(round(c))} for a, b, c in zip(t, ang, r)], r, out


skin_part = [p for p in P if p['kind'] == 'skin'][0]
SK = V[skin_part['v0']:skin_part['v0'] + skin_part['nv']]


def skin_depth(pts, n=400):
    """10th percentile / median distance from muscle vertices to nearest skin vertex."""
    rng = np.random.default_rng(0)
    if len(pts) > n:
        pts = pts[rng.choice(len(pts), n, replace=False)]
    lo, hi = pts.min(0) - 80, pts.max(0) + 80
    S = SK[np.all((SK >= lo) & (SK <= hi), 1)]
    if len(S) == 0:
        return None, None
    d = np.sqrt(((pts[:, None, :] - S[None, :, :]) ** 2).sum(2)).min(1)
    return int(round(np.percentile(d, 10))), int(round(np.median(d)))


def measure(key, frame, names):
    parts = [p for p in P if p['kind'] == 'muscle' and p['name'] in names and p['c'][0] > 0]
    if not parts:
        return None
    X = np.concatenate([V[p['v0']:p['v0'] + p['nv']] for p in parts])
    c = X.mean(0)
    w, vec = np.linalg.eigh(np.cov((X - c).T))
    ax = vec[:, 2]
    # orient: start = upper end; if mostly horizontal, start = end nearer the midline
    if abs(ax[2]) > 0.5:
        if ax[2] > 0:
            ax = -ax
    else:
        if ax[0] < 0:
            ax = -ax
    s = (X - c).dot(ax)
    s0, s1 = s.min(), s.max()
    length = s1 - s0
    u = (s - s0) / length
    stations = []
    for q in STATIONS:
        m = np.abs(u - q) <= 0.05
        if m.sum() < 5:
            m = np.abs(u - q) <= 0.1
        S = X[m]
        cen = S.mean(0)
        sc, _, out = surf(frame, cen)
        o = out[0]
        o = unit(o - ax * o.dot(ax)) if np.linalg.norm(o - ax * o.dot(ax)) > 1e-6 else o
        tng = unit(np.cross(ax, o))
        d = S - cen
        th = np.ptp(d.dot(o))
        wd = np.ptp(d.dot(tng))
        stations.append({'pct': int(q * 100), 'c': [int(round(v)) for v in cen], 'w': int(round(wd)), 'th': int(round(th)), 's': sc[0]})
    belly = X[(u >= 0.25) & (u <= 0.75)]
    _, rb, _ = surf(frame, belly)
    d10, d50 = skin_depth(belly)
    return {
        'key': key, 'frame': frame, 'parts': [p['name'] for p in parts], 'len': int(round(length)),
        'axis': [round(float(v), 2) for v in ax],
        'max_w': max(s_['w'] for s_ in stations), 'max_th': max(s_['th'] for s_ in stations),
        'stations': stations,
        'belly_r_med': int(round(np.median(rb))), 'belly_r_out': int(round(np.percentile(rb, 95))),
        'skin_depth_p10': d10, 'skin_depth_med': d50,
    }


def torso_envelope():
    rows = []
    for z in range(780, 1451, 50):
        S = SK[np.abs(SK[:, 2] - z) <= 8]
        xs = np.sort(np.abs(S[:, 0]))
        # walk outwards from the midline until the first gap (torso/arm separation)
        gaps = np.diff(xs)
        cut = np.where(gaps > 9)[0]
        hw_gap = xs[cut[0]] if len(cut) else xs[-1]
        lim = 190 if z < 1300 else 1e9
        hw = min(hw_gap, xs[xs < lim].max())
        if z < 1300 and (len(cut) == 0 or hw_gap > lim):
            # arm touches the trunk: use the armpit crease = x of minimum front-back depth (left side)
            best = None
            for x0 in range(110, 196, 6):
                B = S[(S[:, 0] >= x0) & (S[:, 0] < x0 + 6)]
                if len(B) > 3:
                    dpt = np.ptp(B[:, 1])
                    if best is None or dpt < best[0]:
                        best = (dpt, x0 + 3)
            if best:
                hw = best[1]
        T = S[np.abs(S[:, 0]) <= hw + 0.5]
        yf, yb = T[:, 1].min(), T[:, 1].max()
        mid = T[np.abs(T[:, 0]) < 15]
        rows.append({'z': z, 'half_w': int(round(hw)), 'y_front': int(round(yf)), 'y_back': int(round(yb)),
                     'y_centre': int(round((yf + yb) / 2)), 'half_d': int(round((yb - yf) / 2)),
                     'y_front_mid': int(round(mid[:, 1].min())) if len(mid) else None,
                     'y_back_mid': int(round(mid[:, 1].max())) if len(mid) else None,
                     'arm_merged': bool(len(cut) == 0 or hw_gap > lim)})
    return rows


def limb_envelope():
    lim = {'arm': 85, 'forearm': 70, 'thigh': 150, 'shank': 95}
    res = {}
    for name in LIMBS:
        a, ax, ln, f, l = FR[name]
        near = SK[(np.linalg.norm(SK - (a + ax * ln / 2), axis=1) < ln) & (SK[:, 0] > 3)]
        t, ang, r, _ = limb_coords(name, near)
        rows = []
        for q in (0, 0.25, 0.5, 0.75, 1.0):
            m = (np.abs(t - q) * ln <= 10) & (r < lim[name])
            row = {'t': q, 'r_med': int(round(np.median(r[m]))) if m.sum() > 5 else None}
            for lab, a0 in (('front', 0), ('outer', 90), ('back', 180), ('inner', 270)):
                mm = m & (np.abs((ang - a0 + 180) % 360 - 180) < 25)
                row['r_' + lab] = int(round(np.median(r[mm]))) if mm.sum() > 2 else None
            rows.append(row)
        res[name] = {'len': int(round(ln)), 'from': LIMBS[name][0], 'to': LIMBS[name][1], 'sections': rows}
    return res


def fmt_s(s):
    if 'z' in s:
        return 'z%d a%d r%d' % (s['z'], s['ang'], s['r'])
    return 't%.2f a%d r%d' % (s['t'], s['ang'], s['r'])


def main():
    muscles = []
    missing = []
    for key, (frame, names) in MUSCLES.items():
        m = measure(key, frame, names)
        (muscles if m else missing).append(m or key)
    torso = torso_envelope()
    limbs = limb_envelope()
    ref = {
        'units': 'mm', 'source': 'BodyParts3D 4.0 (coarse measurements only, no geometry)',
        'conventions': {
            'axes': 'X left+, Y front negative, Z up',
            'limb': 't = fraction along bone axis; ang 0 front, 90 outer, 180 back, 270 inner; r = distance from axis',
            'trunk': 'vertical axis x=0,y=-60; z height; ang 0 front midline, 90 left, 180 back midline; r = distance from axis',
            'station': 'pct along PCA axis (start = upper end, or medial end if horizontal); c = centre xyz; w = width tangential to surface; th = thickness along outward',
            'layering': 'belly_r_med/out = median / 95th pct radial distance of the 25-75% belly; skin_depth_p10 = distance from belly outer face to skin (small = superficial)',
        },
        'joints': {k: [int(round(x)) for x in v] for k, v in J.items()},
        'muscles': muscles, 'missing': missing, 'torso_envelope': torso, 'limb_envelope': limbs,
    }
    json.dump(ref, open(os.path.join(D, 'reference.json'), 'w'), separators=(',', ':'))
    o = ['# Reference anatomy measurements (mm, left side)', '',
         'Coarse measurements only. Limb coords: t along bone axis, a = angle (0 front, 90 outer, 180 back, 270 inner), r = radius.',
         'Trunk coords: z height, a = angle about vertical axis x=0,y=-60 (0 front, 90 left, 180 back), r = radius.',
         'depth = distance from belly outer face to skin (small = superficial).', '',
         '| muscle | frame | len | maxW | maxTh | start (5%) | end (95%) | belly (50%) | belly W/Th | r med | depth |',
         '|---|---|---|---|---|---|---|---|---|---|---|']
    for m in muscles:
        st = m['stations']
        o.append('| %s | %s | %d | %d | %d | %s | %s | %s | %d/%d | %d | %s |' % (
            m['key'], m['frame'], m['len'], m['max_w'], m['max_th'], fmt_s(st[0]['s']), fmt_s(st[4]['s']),
            fmt_s(st[2]['s']), st[2]['w'], st[2]['th'], m['belly_r_med'], m['skin_depth_p10']))
    o += ['', '## Torso envelope (skin)', '', '| z | half-width | half-depth | y front | y back | y centre | front@midline | back@midline | arm merged |', '|---|---|---|---|---|---|---|---|---|']
    for r in torso:
        o.append('| %d | %d | %d | %d | %d | %d | %s | %s | %s |' % (r['z'], r['half_w'], r['half_d'], r['y_front'], r['y_back'], r['y_centre'], r['y_front_mid'], r['y_back_mid'], 'yes' if r['arm_merged'] else ''))
    o += ['', '## Limb envelope (skin radius about bone axis)', '', '| limb | len | t | r median | front | outer | back | inner |', '|---|---|---|---|---|---|---|---|']
    for k, v in limbs.items():
        for r in v['sections']:
            o.append('| %s | %d | %.2f | %s | %s | %s | %s | %s |' % (k, v['len'], r['t'], r['r_med'], r['r_front'], r['r_outer'], r['r_back'], r['r_inner']))
    o += ['', '## Joints', '']
    for k, v in ref['joints'].items():
        if not k.startswith('R'):
            o.append('- %s: %s' % (k, v))
    if missing:
        o += ['', 'Missing: ' + ', '.join(missing)]
    open(os.path.join(D, 'reference.md'), 'w').write('\n'.join(o) + '\n')
    print(len(muscles), 'muscles; missing:', missing)


if __name__ == '__main__':
    main()
