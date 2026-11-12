# Head, hands and feet for the code-generated anatomy figure.
# Everything here is made from formulas (signed distance fields meshed with a small surface-nets routine);
# no outside mesh data is used. Units: millimetres. X left(+), front is -Y, Z up, ground z=0.
# Public: head(), hand(side), foot(side) -> list of (name, V(n,3) float, F(m,3) int), outward winding.
import numpy as np

# ---------------------------------------------------------------- field helpers
def A3(v): return np.asarray(v, float)
def ss(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def smin(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0) / k; return np.minimum(a, b) - h * h * k * 0.25
def smax(a, b, k): return -smin(-a, -b, k)
def sph(P, c, r): return np.linalg.norm(P - A3(c), axis=1) - r
def ell(P, c, r, R=None):
    q = P - A3(c)
    if R is not None: q = q @ R          # columns of R = local axes
    r = A3(r); k0 = np.linalg.norm(q / r, axis=1); k1 = np.linalg.norm(q / (r * r), axis=1)
    return k0 * (k0 - 1) / np.maximum(k1, 1e-9)
def cone(P, a, b, ra, rb):
    a = A3(a); b = A3(b); ab = b - a; t = np.clip((P - a) @ ab / (ab @ ab), 0, 1)
    return np.linalg.norm(P - a - t[:, None] * ab, axis=1) - (ra + (rb - ra) * t)
def gauss(P, c, s): return np.exp(-(((P - A3(c)) / A3(s)) ** 2).sum(1))
def unit(v): v = A3(v); return v / np.linalg.norm(v)

# ---------------------------------------------------------------- meshing
def axis(lo, hi, coarse, bands=()):
    """1-D sample positions from lo to hi; step = coarse except inside bands (a, b, fine) with soft edges."""
    t = lo; out = [t]
    while t < hi:
        h = coarse
        for a, b, f in bands:
            m = 3 * coarse; w = ss(a - m, a, t) * ss(b + m, b, t); h = min(h, coarse + (f - coarse) * w)
        t += h; out.append(t)
    return np.array(out)

def surface_nets(f, xs, ys, zs, smooth=2, project=3, maxstep=1.5):
    nx, ny, nz = len(xs), len(ys), len(zs)
    G = np.stack(np.meshgrid(xs, ys, zs, indexing='ij'), -1)
    val = f(G.reshape(-1, 3)).reshape(nx, ny, nz)
    acc = np.zeros((nx - 1, ny - 1, nz - 1, 3)); cnt = np.zeros((nx - 1, ny - 1, nz - 1))
    sl = lambda o, n: slice(o, n - 1 + o)
    for ax in range(3):
        for o1 in (0, 1):
            for o2 in (0, 1):
                ia = [None] * 3; ib = [None] * 3; oth = [k for k in range(3) if k != ax]; n = (nx, ny, nz)
                ia[ax] = slice(0, n[ax] - 1); ib[ax] = slice(1, n[ax])
                ia[oth[0]] = ib[oth[0]] = sl(o1, n[oth[0]]); ia[oth[1]] = ib[oth[1]] = sl(o2, n[oth[1]])
                a = val[tuple(ia)]; b = val[tuple(ib)]; m = (a < 0) != (b < 0)
                t = np.where(m, a / np.where(m, a - b, 1), 0)
                p = G[tuple(ia)] + t[..., None] * (G[tuple(ib)] - G[tuple(ia)])
                acc += p * m[..., None]; cnt += m
    act = cnt > 0; idx = -np.ones(cnt.shape, int); idx[act] = np.arange(act.sum())
    V = acc[act] / cnt[act][:, None]
    quads = []
    def emit(a, b, c0, c1, c2, c3):
        m = (a < 0) != (b < 0); fl = (a >= 0)[m]
        q = np.stack([c0[m], c1[m], c2[m], c3[m]], 1); q[fl] = q[fl][:, ::-1]; quads.append(q)
    I = idx
    emit(val[:-1, 1:-1, 1:-1], val[1:, 1:-1, 1:-1], I[:, :-1, :-1], I[:, 1:, :-1], I[:, 1:, 1:], I[:, :-1, 1:])
    emit(val[1:-1, :-1, 1:-1], val[1:-1, 1:, 1:-1], I[:-1, :, :-1], I[:-1, :, 1:], I[1:, :, 1:], I[1:, :, :-1])
    emit(val[1:-1, 1:-1, :-1], val[1:-1, 1:-1, 1:], I[:-1, :-1, :], I[1:, :-1, :], I[1:, 1:, :], I[:-1, 1:, :])
    Q = np.concatenate(quads); Q = Q[(Q >= 0).all(1)]
    E = np.concatenate([Q[:, [0, 1]], Q[:, [1, 2]], Q[:, [2, 3]], Q[:, [3, 0]]])
    def proj(V, n):
        e = 0.25
        for _ in range(n):
            d = f(V); g = np.zeros_like(V)
            for k in range(3):
                o = np.zeros(3); o[k] = e; g[:, k] = (f(V + o) - f(V - o)) / (2 * e)
            st = d[:, None] * g / np.maximum((g * g).sum(1), 0.05)[:, None]
            l = np.linalg.norm(st, axis=1); st *= np.minimum(1, maxstep / np.maximum(l, 1e-9))[:, None]
            V = V - st
        return V
    for _ in range(smooth):
        s = np.zeros_like(V); c = np.zeros(len(V))
        np.add.at(s, E[:, 0], V[E[:, 1]]); np.add.at(c, E[:, 0], 1); np.add.at(s, E[:, 1], V[E[:, 0]]); np.add.at(c, E[:, 1], 1)
        V = proj(0.5 * V + 0.5 * s / np.maximum(c, 1)[:, None], 1)
    V = proj(V, project)
    d02 = np.linalg.norm(V[Q[:, 0]] - V[Q[:, 2]], axis=1); d13 = np.linalg.norm(V[Q[:, 1]] - V[Q[:, 3]], axis=1); m = d02 <= d13
    F = np.concatenate([Q[m][:, [0, 1, 2]], Q[m][:, [0, 2, 3]], Q[~m][:, [0, 1, 3]], Q[~m][:, [1, 2, 3]]])
    F = F[(F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])]
    return V, F

def _mirror(parts):
    return [(n, V * np.array([-1.0, 1, 1]), F[:, ::-1].copy()) for n, V, F in parts]

# ================================================================ HEAD
def _rot_axes(u, v):
    u = unit(u); v = unit(A3(v) - (A3(v) @ u) * u); w = np.cross(u, v); return np.stack([u, v, w], 1)

_EAR_C = A3([78.5, 19, 1707]); _EAR_R = _rot_axes([np.cos(0.42), -np.sin(0.42), 0], [np.sin(0.42), np.cos(0.42) * 0.985, -0.17])

def head_sdf(P):
    Q = P.copy(); Q[:, 0] = np.abs(Q[:, 0]); x, y, z = Q[:, 0], Q[:, 1], Q[:, 2]
    # --- cranium: fuller back, flatter sides
    d = ell(Q, (0, 10, 1731), (83, 84, 87))
    d = smin(d, ell(Q, (0, 32, 1722), (70, 62, 66)), 22)                 # occiput
    d = smin(d, ell(Q, (0, -24, 1741), (69, 71, 74)), 26)                # forehead
    d = smax(d, x - 76.5, 16)
    # --- facial mass, jaw, chin
    d = smin(d, ell(Q, (0, -30, 1682), (65, 66, 70)), 20)
    G = (43, 12, 1634)
    d = smin(d, cone(Q, G, (10, -77, 1614), 13.5, 12), 12)                 # body of the mandible
    d = smin(d, cone(Q, G, (58, 6, 1688), 13.5, 10), 12)                 # ramus
    d = smin(d, ell(Q, (52, -22, 1670), (12, 34, 34)), 18)               # masseter / parotid
    d = smin(d, ell(Q, (54, 26, 1686), (12, 17, 20)), 14)                # mastoid
    d = smin(d, cone(Q, (52, 30, 1682), (35, -8, 1582), 12, 11), 14)     # sternomastoid
    d = smin(d, ell(Q, (0, -78.5, 1613), (25, 15, 16)), 18)               # chin
    d = smin(d, ell(Q, (0, -28, 1643), (44, 56, 36)), 14)                # floor of the mouth
    d = smin(d, ell(Q, (38, -58, 1652), (14, 20, 20)), 18)               # cheek
    # --- neck stub (radius ~57, dives inside the neck cylinder below z=1600)
    m = 1 - 0.3 * np.clip((1600 - z) / 22, 0, 1)
    nk = (np.sqrt((x / (56.6 * m)) ** 2 + (y / (61.2 * m)) ** 2) - 1) * 57 * m
    nk = np.maximum(nk, np.maximum(1579 - z, z - 1700))
    d = smin(d, nk, 16)
    # --- cheekbone and zygomatic arch
    d = smin(d, ell(Q, (47, -60, 1689), (17, 17, 17)), 16)
    d = smin(d, cone(Q, (53, -48, 1696), (64, 0, 1700), 5, 5), 16)
    # --- brow ridge
    d = smin(d, cone(Q, (7, -90, 1724), (30, -86.5, 1729), 6, 5.5), 12)
    d = smin(d, cone(Q, (30, -86.5, 1729), (52, -74, 1725), 5.5, 4), 12)
    # --- eye socket, then the closed eye as a soft dome
    d = smax(d, -ell(Q, (30, -93, 1708), (15, 12, 11)), 12)
    d = smin(d, ell(Q, (32, -73, 1706.5), (14, 12.5, 12)), 5)
    # --- nose
    n = cone(Q, (0, -88, 1715), (0, -112, 1677), 5.5, 7.5)
    n = smin(n, ell(Q, (0, -113.5, 1672), (7.8, 8.5, 8.2)), 7)
    n = smin(n, ell(Q, (12, -101, 1668), (6.5, 9.5, 7.5)), 6)
    n = smin(n, cone(Q, (0, -110, 1665), (0, -98, 1662.5), 3.8, 4.5), 3)  # columella
    d = smin(d, n, 9)
    d = smax(d, -ell(Q, (6.3, -102.5, 1659.5), (3.3, 6, 3.6)), 2)          # nostril
    # --- mouth
    d = smin(d, ell(Q, (0, -62, 1643), (30, 32, 25)), 16)
    d = smin(d, ell(Q, (0, -89, 1645.2), (22, 9, 5.5)), 5)
    d = smin(d, ell(Q, (0, -88, 1635), (18, 9, 6.5)), 5)
    zl = 1640.3 - 2.0 * (x / 24) ** 2 + 1.0 * np.exp(-(x / 5) ** 2) - 0.6
    fr = ss(-78, -86, y)
    d = d + 2.2 * np.exp(-((z - zl) / 1.6) ** 2) * ss(26.5, 21.5, x) * fr     # lip line
    d = d + 1.3 * gauss(Q, (25.5, -84, 1638.5), (4.5, 6, 4.5))              # mouth corner
    d = d + 1.0 * np.exp(-(x / 3.2) ** 2) * np.exp(-((z - 1655) / 5.5) ** 2) * fr   # philtrum
    d = d + 2.2 * np.exp(-((z - 1625.5) / 7) ** 2) * np.exp(-(x / 17) ** 2) * fr    # sulcus under the lip
    # --- eyelid lines
    xe = (x - 32) / 15; fe = ss(1.15, 0.85, np.abs(xe)) * ss(-66, -72, y)
    d = d + 1.5 * np.exp(-((z - (1701.6 + 3.0 * xe * xe)) / 1.5) ** 2) * fe          # closed lash line
    d = d + 1.2 * np.exp(-((z - (1715.5 - 3.5 * xe * xe)) / 1.8) ** 2) * fe          # upper lid crease
    # --- soft hollows
    d = d + 1.0 * gauss(Q, (66, -56, 1738), (14, 22, 18))                 # temple
    d = d + 1.4 * gauss(Q, (20, -92, 1666), (5, 8, 12))                   # beside the nose wing
    # --- ear
    q = (Q - _EAR_C) @ _EAR_R; u, v, w = q[:, 0], q[:, 1], q[:, 2]
    e = ell(q, (0, 1, 7), (4.2, 16.5, 23))
    e = smin(e, ell(q, (0, -5, -19), (4.2, 9, 11.5)), 6)
    rho = np.sqrt((v / 15.5) ** 2 + ((w - 7) / 22) ** 2)
    rim = np.sqrt(((rho - 1) * 17) ** 2 + (u - 2.2) ** 2) - 2.7
    rim = np.maximum(rim, -(v + 9) - 0.25 * (w - 7))                      # only top and back
    e = smin(e, rim, 2.5)
    e = smax(e, -ell(q, (5.5, -2, 4), (5, 8, 11.5)), 2.5)                 # concha
    e = smin(e, sph(q, (2.5, -14, 0), 3.6), 2.5)                          # tragus
    d = smin(d, e, 5)
    return np.maximum(d, 1578 - z)                                         # flat underside, hidden in the neck

def head():
    xs = axis(-94, 94, 4.4, [(-50, 50, 3.0), (-92, -68, 3.0), (68, 92, 3.0)])
    ys = axis(-130, 104, 5.2, [(-126, -66, 2.8)])
    zs = axis(1572, 1826, 5.2, [(1630, 1732, 2.8)])
    V, F = surface_nets(head_sdf, xs, ys, zs)
    return [('head', V, F)]

# ================================================================ HAND (left, local frame)
# local: origin wrist joint, +x thumb side, -y palm side, -z towards the fingertips
_FING = [  # name, MCP (x, z), splay deg, lengths, radii (4), flex deg (MCP, PIP, DIP)
    ('index', (29, -96), 3.5, (45, 27, 24), (10.2, 9.5, 8.5, 7.4), (10, 20, 11)),
    ('middle', (7.5, -101), 0.0, (49, 31, 25), (10.4, 9.7, 8.7, 7.6), (13, 23, 12)),
    ('ring', (-13.5, -96), -3.5, (45, 29, 24), (9.8, 9.1, 8.2, 7.2), (17, 27, 14)),
    ('little', (-32.5, -86), -8.0, (35, 21, 21), (8.6, 8.0, 7.2, 6.4), (21, 31, 16)),
]
def _finger(P, mcp, splay, L, R, flex):
    s = np.radians(splay); d0 = A3([np.sin(s), 0, -np.cos(s)]); pal = A3([0, -1, 0])
    p = A3([mcp[0], 1.0, mcp[1]]); phi = 0; pts = [p]; dirs = []; dors = []
    for l, fl in zip(L, flex):
        phi += np.radians(fl); dr = np.cos(phi) * d0 + np.sin(phi) * pal
        dirs.append(dr); dors.append(np.cos(phi) * (-pal) + np.sin(phi) * d0); p = p + l * dr; pts.append(p)
    tip = pts[3] - dirs[2] * R[3]                                          # so that the cap ends at the length
    d = cone(P, pts[0], pts[1], R[0], R[1])
    d = smin(d, cone(P, pts[1], pts[2], R[1], R[2]), 2.5)
    dd = cone(P, pts[2], tip, R[2], R[3])
    dd = smin(dd, sph(P, pts[2] + dirs[2] * (L[2] * 0.5) - dors[2] * 1.0, R[3] + 0.5), 4)   # finger pad
    # nail: a slightly flattened, slightly sunken plate on the back of the last segment
    nc = pts[2] + dirs[2] * (L[2] * 0.62)
    q = P - nc; a = q @ dirs[2]; h = q @ dors[2]; lat = q @ np.cross(dirs[2], dors[2])
    plate = np.maximum(np.abs(a) - L[2] * 0.30, np.abs(lat) - R[3] * 0.78)
    dd = smax(dd, np.where(plate < 0, h - (R[3] - 0.9), -1e3), 1.2)
    dd = dd + 0.7 * np.exp(-(plate / 0.9) ** 2) * (h > 0)                   # nail fold
    d = smin(d, dd, 2.5)
    for j, r in ((1, R[1]), (2, R[2])):                                     # knuckles and flexion creases
        dj = unit(dirs[j - 1] + dirs[j]); nj = unit(dors[j - 1] + dors[j])
        d = smin(d, sph(P, pts[j] + nj * 0.9, r + 0.25), 5)
        q = P - pts[j]; a = q @ dj; h = q @ nj; near = np.exp(-(q * q).sum(1) / (r * 1.7) ** 2)
        d = d + 0.7 * np.exp(-(a / 1.3) ** 2) * ss(0, -r * 0.6, h) * near       # palm-side crease
        d = d + 0.3 * (np.exp(-((a - 2.2) / 1.0) ** 2) + np.exp(-((a + 2.2) / 1.0) ** 2)) * (h > r * 0.5) * near  # skin folds on the back
    return d

def hand_sdf(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    # --- palm: four metacarpal rays
    rays = [((15, 1, -20), (29.5, 1, -102), 13.5, 11.6), ((5.5, 1.5, -20), (7.5, 1.5, -108), 13.5, 11.8),
            ((-5, 1, -20), (-14, 1, -102), 13.5, 11.4), ((-14, 0, -20), (-32.5, 0, -91), 13, 10.6)]
    pm = None
    for a, b, ra, rb in rays:
        c = cone(P, a, b, ra, rb); pm = c if pm is None else smin(pm, c, 9)
    pm = smin(pm, ell(P, (-26, -5.5, -52), (13, 11, 34)), 7)               # hypothenar pad
    pm = smin(pm, ell(P, (-2, -5, -92), (38, 8, 14)), 11)                 # pad under the finger bases
    pm = pm + 1.6 * gauss(P, (4, -12, -60), (14, 6, 20))                   # hollow of the palm
    for (_, mcp, *_r) in _FING:                                            # knuckles on the back
        pm = smin(pm, sph(P, (mcp[0], 5.0, mcp[1] - 1), 9.3), 6)
    # wrist: round at the joint (r 27), dives into the forearm above it
    wr = smin(cone(P, (0, 0, 0), (0, 0.5, -42), 27.3, 15), cone(P, (0, 0, 0), (0, 0, 13), 27.3, 19), 2)
    wr = smin(wr, sph(P, (-20.5, 4, -9), 8.5), 8)          # ulnar head hint
    pm = smin(pm, wr, 16)
    # --- thumb
    c0 = A3([22, -6, -24]); d1 = unit([0.52, -0.24, -0.82]); d2 = unit([0.38, -0.24, -0.89]); d3 = unit([0.29, -0.33, -0.90])
    m1 = c0 + 42 * d1; m2 = m1 + 32 * d2; m3 = m2 + (28 - 7.6) * d3
    th = cone(P, c0, m1, 15.5, 11.5)
    th = smin(th, ell(P, c0 + 22 * d1 + A3([-3, -5, 0]), (15, 12, 26), _rot_axes(np.cross(d1, [0, 1, 0]), [0, 1, 0])), 6)   # thenar pad
    tf = cone(P, m1, m2, 10.8, 9.6)
    td = cone(P, m2, m3, 9.8, 7.6)
    nrm = unit(np.cross(d3, np.cross([0.75, 0.55, 0.3], d3)))               # back of the thumb faces out and backwards
    td = smin(td, sph(P, m2 + d3 * 12 - nrm * 1.2, 8.3), 5)
    nc = m2 + d3 * 16; q = P - nc; a = q @ d3; h = q @ nrm; lat = q @ np.cross(d3, nrm)
    plate = np.maximum(np.abs(a) - 8.5, np.abs(lat) - 6.4)
    td = smax(td, np.where(plate < 0, h - 6.6, -1e3), 1.2); td = td + 0.7 * np.exp(-(plate / 0.9) ** 2) * (h > 0)
    tf = smin(tf, td, 2.5)
    tf = smin(tf, sph(P, m2 + nrm * 1.2, 10.2), 3); tf = smin(tf, sph(P, m1 + nrm * 1.5, 12.2), 4)
    q = P - m2; a = q @ unit(d2 + d3); h = q @ nrm
    tf = tf + 0.9 * np.exp(-(a / 1.3) ** 2) * (h < -3) * np.exp(-(q * q).sum(1) / 17 ** 2)
    th = smin(th, tf, 5)
    d = smin(pm, th, 11)
    # --- fingers: each blends with the palm, but not with its neighbours
    for (_, mcp, sp, L, R, fl) in _FING:
        d = np.minimum(d, smin(pm, _finger(P, mcp, sp, L, R, fl), 6))
    # palm creases
    t = (x + 34) / 62; zc = -80 + 9 * t * t; d = d + 0.45 * np.exp(-((z - zc) / 2.0) ** 2) * ss(-4, -8, y) * ss(-36, -30, x) * ss(24, 14, x)
    return d

def _hand_frame():
    w = unit([18, -12, -255]); u = unit(A3([1, 0, 0]) - w[0] * w); v = np.cross(-w, u)
    return np.stack([u, v, -w], 1), A3([244, -12, 885])

def hand(side='L'):
    xs = axis(-52, 80, 2.5, [(-50, 78, 2.2)]); ys = axis(-60, 31, 2.3); zs = axis(-208, 36, 3.0, [(-204, -92, 2.15)])
    V, F = surface_nets(hand_sdf, xs, ys, zs, maxstep=0.9)
    R, o = _hand_frame(); V = V @ R.T + o
    out = [('Lhand', V, F)]
    return out if side == 'L' else [('Rhand', *_mirror(out)[0][1:])]

# ================================================================ FOOT (left, world frame)
_CX = 84.0
_TOES = [  # MTP, joints..., radii
    ([(-30, -122, 16), (-29.5, -160, 13.2), (-28, -181.5, 12.4)], (15, 13.4, 12.4)),
    ([(-10, -130, 14.5), (-9.5, -158, 14.5), (-9, -174, 10.2), (-8.6, -182.5, 8.4)], (10.5, 9.2, 8.4, 8.0)),
    ([(8, -126, 14), (9.2, -151, 13.6), (9.9, -165.5, 9.6), (10.3, -173.5, 8)], (10.2, 8.8, 8.0, 7.6)),
    ([(24.5, -118, 13.5), (27, -140, 12.8), (28.2, -153, 9.2), (28.8, -160.5, 7.6)], (10, 8.4, 7.6, 7.2)),
    ([(39, -105, 13), (43, -124, 12), (44.6, -135.5, 8.8), (45.2, -142, 7.4)], (10, 8.2, 7.4, 7.0)),
]
def foot_sdf(P):
    Q = P - A3([_CX, 0, 0]); x, y, z = Q[:, 0], Q[:, 1], Q[:, 2]
    d = ell(Q, (2, 31, 34), (30, 35, 42))                                   # heel
    d = smin(d, cone(Q, (0, 0, 52), (0, 0, 106), 36.3, 36.3), 14)           # ankle column (r ~36)
    d = np.maximum(smin(d, cone(Q, (0, 0, 106), (0, 0, 122), 36.3, 22), 2), z - 119)
    d = smin(d, cone(Q, (2, 33, 48), (1, 27, 104), 11, 10), 12)             # Achilles tendon
    # metatarsal rays: high on the inner side (arch), low on the outer side
    st = [(-13, -34, 49, 29), (-5, -36, 47, 28), (5, -32, 43, 27), (13, -24, 37, 27), (17, -12, 31, 28)]
    for (a0, a1, a2, ra), (pts, rr) in zip(st, _TOES):
        m = pts[0]; rb = (16, 13.5, 13, 12.5, 12)[_TOES.index((pts, rr))]
        d = smin(d, cone(Q, (a0, a1, a2), (m[0], m[1] + 6, m[2] + 0.5), ra, rb), 13)
    d = smin(d, cone(Q, (14, 24, 17), (38, -104, 13), 19, 13), 12)          # outer border resting on the ground
    d = smin(d, ell(Q, (-28, -124, 14), (19, 22, 15)), 8)                   # ball of the big toe
    d = d + 5.0 * gauss(Q, (-34, -50, 4), (22, 42, 16))                     # deepen the arch
    d = smin(d, ell(Q, (-31, -1, 85), (10, 15, 18)), 11)                   # inner ankle bone
    d = smin(d, ell(Q, (31, 9, 74), (9.5, 13, 17)), 11)                   # outer ankle bone (lower, further back)
    d = d + 2.0 * gauss(Q, (26, 30, 62), (10, 9, 20)) + 2.0 * gauss(Q, (-25, 28, 66), (10, 9, 20))   # hollows beside the tendon
    body = d
    for pts, rr in _TOES:
        t = None
        for i in range(len(pts) - 1):
            c = cone(Q, pts[i], pts[i + 1], rr[i], rr[i + 1]); t = c if t is None else smin(t, c, 3)
        big = len(pts) == 3
        if not big: t = smin(t, sph(Q, A3(pts[1]) + A3([0, 0, 1.5]), rr[1] + 0.6), 3)   # toe knuckle
        tip = A3(pts[-1]); r = rr[-1]                                        # toenail
        q = Q - (tip + A3([0, 1.5, 0])); plate = np.maximum(np.abs(q[:, 1]) - r * (0.75 if big else 0.6), np.abs(q[:, 0]) - r * 0.72)
        t = smax(t, np.where(plate < 0, q[:, 2] - (r - 1.0) - 0.12 * q[:, 1], -1e3), 1.2)
        t = t + 0.7 * np.exp(-(plate / 1.0) ** 2) * (q[:, 2] > 0)
        d = np.minimum(d, smin(body, t, 9))
    d = smax(d, -z, 5)                                                      # flat sole on the ground
    return d

def foot(side='L'):
    xs = axis(_CX - 58, _CX + 62, 3.3, [(_CX - 56, _CX + 60, 3.1)])
    ys = axis(-204, 76, 4.4, [(-200, -112, 2.6)])
    zs = axis(-6, 128, 4.4, [(-4, 28, 2.7)])
    V, F = surface_nets(foot_sdf, xs, ys, zs)
    out = [('Lfoot', V, F)]
    return out if side == 'L' else [('Rfoot', *_mirror(out)[0][1:])]

if __name__ == '__main__':
    import time
    for nm, fn in (('head', head), ('hand', lambda: hand('L')), ('foot', lambda: foot('L'))):
        t = time.time(); (n, V, F), = fn()
        a = V[F[:, 0]]; b = V[F[:, 1]]; c = V[F[:, 2]]; vol = (a * np.cross(b, c)).sum() / 6
        print(nm, len(V), len(F), 'bbox', V.min(0).round(1), V.max(0).round(1), 'vol', round(vol / 1e3), 'cm3', round(time.time() - t, 1), 's')
