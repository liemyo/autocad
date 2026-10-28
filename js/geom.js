// Geometri dasar 2D: vektor, matriks affine, busur, perpotongan.
export const TAU = Math.PI * 2, EPS = 1e-9, D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const pt = (x, y) => ({ x, y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const crs = (a, b) => a.x * b.y - a.y * b.x;
export const len = a => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
export const polar = (p, a, d) => ({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d });
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const unit = a => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; };
export const perp = a => ({ x: -a.y, y: a.x });
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const eq = (a, b, t = 1e-7) => Math.abs(a.x - b.x) <= t && Math.abs(a.y - b.y) <= t;
export const cp = p => ({ x: p.x, y: p.y });
export const an = a => { a %= TAU; return a < 0 ? a + TAU : a; };
export const sweepOf = (sa, ea) => { const s = an(ea - sa); return s < 1e-12 ? TAU : s; };
export const onArc = (a, sa, ea, tol = 1e-9) => an(a - sa) <= sweepOf(sa, ea) + tol || an(a - sa) >= TAU - tol;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const rotP = (p, c, r) => { const s = Math.sin(r), k = Math.cos(r), x = p.x - c.x, y = p.y - c.y; return { x: c.x + x * k - y * s, y: c.y + x * s + y * k }; };

// Matriks affine: x' = a x + c y + e, y' = b x + d y + f
export const M = {
  id: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  tr: (dx, dy) => ({ a: 1, b: 0, c: 0, d: 1, e: dx, f: dy }),
  rot(r, o = { x: 0, y: 0 }) {
    const k = Math.cos(r), s = Math.sin(r);
    return { a: k, b: s, c: -s, d: k, e: o.x - k * o.x + s * o.y, f: o.y - s * o.x - k * o.y };
  },
  sc(sx, o = { x: 0, y: 0 }, sy = sx) { return { a: sx, b: 0, c: 0, d: sy, e: o.x - sx * o.x, f: o.y - sy * o.y }; },
  mirror(p1, p2) {
    const t = 2 * ang(p1, p2), k = Math.cos(t), s = Math.sin(t);
    return { a: k, b: s, c: s, d: -k, e: p1.x - (k * p1.x + s * p1.y), f: p1.y - (s * p1.x - k * p1.y) };
  },
  mul: (m, n) => ({ // n dulu, lalu m
    a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f,
  }),
  ap: (m, p) => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }),
  vec: (m, v) => ({ x: m.a * v.x + m.c * v.y, y: m.b * v.x + m.d * v.y }),
  inv(m) {
    const det = m.a * m.d - m.b * m.c;
    const a = m.d / det, b = -m.b / det, c = -m.c / det, d = m.a / det;
    return { a, b, c, d, e: -(a * m.e + c * m.f), f: -(b * m.e + d * m.f) };
  },
  // skala, cermin, sudut rotasi
  dec(m) { const det = m.a * m.d - m.b * m.c; return { s: Math.sqrt(Math.abs(det)), mir: det < 0, phi: Math.atan2(m.b, m.a) }; },
};

// Busur dari bulge
export function bulgeArc(p1, p2, b) {
  const d = dist(p1, p2), u = unit(sub(p2, p1));
  const c = add(mid(p1, p2), mul(perp(u), d * (1 - b * b) / (4 * b)));
  const r = d * (1 + b * b) / (4 * Math.abs(b));
  return b > 0 ? { c, r, sa: ang(c, p1), ea: ang(c, p2) } : { c, r, sa: ang(c, p2), ea: ang(c, p1) };
}
export const bulgeOf = (sweep) => Math.tan(sweep / 4);
export function circ3(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
  const cc = { x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d, y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d };
  return { c: cc, r: dist(cc, a) };
}
export function arc3(p1, p2, p3) {
  const k = circ3(p1, p2, p3); if (!k) return null;
  const ccw = crs(sub(p2, p1), sub(p3, p2)) > 0;
  return ccw ? { c: k.c, r: k.r, sa: ang(k.c, p1), ea: ang(k.c, p3) } : { c: k.c, r: k.r, sa: ang(k.c, p3), ea: ang(k.c, p1) };
}

// Perpotongan. Primitif geometri: {t:'L',a,b,inf:0|1|2} {t:'A',c,r,sa,ea,full} {t:'P',pts,closed}
export function segSeg(a1, a2, b1, b2) {
  const r = sub(a2, a1), s = sub(b2, b1), den = crs(r, s);
  if (Math.abs(den) < 1e-14) return null;
  const q = sub(b1, a1);
  return { t: crs(q, s) / den, u: crs(q, r) / den };
}
export function lineCirc(a, b, c, r) {
  const d = sub(b, a), f = sub(a, c);
  const A = dot(d, d), B = 2 * dot(f, d), C = dot(f, f) - r * r;
  let disc = B * B - 4 * A * C;
  if (disc < -1e-12 * A * r * r || A < 1e-20) return [];
  disc = Math.max(0, disc);
  const sq = Math.sqrt(disc);
  return disc < 1e-18 ? [(-B) / (2 * A)] : [(-B - sq) / (2 * A), (-B + sq) / (2 * A)];
}
export function circCirc(c1, r1, c2, r2) {
  const d = dist(c1, c2);
  if (d < 1e-12 || d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const m = add(c1, mul(sub(c2, c1), a / d)), u = perp(unit(sub(c2, c1)));
  return h < 1e-12 ? [m] : [add(m, mul(u, h)), sub(m, mul(u, h))];
}
const tOk = (t, inf, ext) => ext || inf === 2 || (inf === 1 ? t >= -1e-9 : t >= -1e-9 && t <= 1 + 1e-9);
const aOk = (p, A, ext) => ext || A.full || onArc(Math.atan2(p.y - A.c.y, p.x - A.c.x), A.sa, A.ea, 1e-7);
export function segsOf(P) {
  const out = [], n = P.pts.length;
  for (let i = 0; i < n - 1; i++) out.push({ t: 'L', a: P.pts[i], b: P.pts[i + 1] });
  if (P.closed && n > 2) out.push({ t: 'L', a: P.pts[n - 1], b: P.pts[0] });
  return out;
}
// ext1/ext2: perlakukan primitif sebagai tak terbatas (garis/lingkaran penuh)
export function interPrim(p, q, ext1 = false, ext2 = false) {
  if (p.t === 'P') return segsOf(p).flatMap(s => interPrim(s, q, ext1, ext2));
  if (q.t === 'P') return segsOf(q).flatMap(s => interPrim(p, s, ext1, ext2));
  if (p.t === 'L' && q.t === 'L') {
    const r = segSeg(p.a, p.b, q.a, q.b);
    if (!r || !tOk(r.t, p.inf, ext1) || !tOk(r.u, q.inf, ext2)) return [];
    return [lerp(p.a, p.b, r.t)];
  }
  if (p.t === 'A' && q.t === 'L') return interPrim(q, p, ext2, ext1);
  if (p.t === 'L' && q.t === 'A') {
    return lineCirc(p.a, p.b, q.c, q.r).filter(t => tOk(t, p.inf, ext1)).map(t => lerp(p.a, p.b, t)).filter(x => aOk(x, q, ext2));
  }
  if (p.t === 'A' && q.t === 'A') return circCirc(p.c, p.r, q.c, q.r).filter(x => aOk(x, p, ext1) && aOk(x, q, ext2));
  return [];
}
export function closestPrim(p, q) {
  if (q.t === 'L') {
    const d = sub(q.b, q.a), L2 = dot(d, d);
    let t = L2 < 1e-20 ? 0 : dot(sub(p, q.a), d) / L2;
    if (!q.inf) t = clamp(t, 0, 1); else if (q.inf === 1) t = Math.max(0, t);
    return lerp(q.a, q.b, t);
  }
  if (q.t === 'A') {
    const a = Math.atan2(p.y - q.c.y, p.x - q.c.x);
    if (q.full || onArc(a, q.sa, q.ea)) return polar(q.c, a, q.r);
    const e1 = polar(q.c, q.sa, q.r), e2 = polar(q.c, q.ea, q.r);
    return dist(p, e1) < dist(p, e2) ? e1 : e2;
  }
  if (q.t === 'P') {
    let best = null, bd = Infinity;
    for (const s of segsOf(q)) { const c = closestPrim(p, s), d = dist(p, c); if (d < bd) { bd = d; best = c; } }
    if (q.pts.length === 1) return q.pts[0];
    return best;
  }
  return p;
}
export function polyArea(pts) { let s = 0; for (let i = 0, n = pts.length; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; s += a.x * b.y - b.x * a.y; } return s / 2; }
export function polyCentroid(pts) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0, n = pts.length; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], k = a.x * b.y - b.x * a.y; A += k; cx += (a.x + b.x) * k; cy += (a.y + b.y) * k; }
  if (Math.abs(A) < 1e-12) return pts[0];
  return { x: cx / (3 * A), y: cy / (3 * A) };
}
export function inPoly(p, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
export function segRectHit(a, b, r) { // segmen menyentuh persegi
  if (ptInRect(a, r) || ptInRect(b, r)) return true;
  const c = [{ x: r.x1, y: r.y1 }, { x: r.x2, y: r.y1 }, { x: r.x2, y: r.y2 }, { x: r.x1, y: r.y2 }];
  for (let i = 0; i < 4; i++) { const s = segSeg(a, b, c[i], c[(i + 1) % 4]); if (s && s.t >= 0 && s.t <= 1 && s.u >= 0 && s.u <= 1) return true; }
  return false;
}
export const ptInRect = (p, r) => p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
export function segPolyHit(a, b, pts) {
  if (inPoly(a, pts) || inPoly(b, pts)) return true;
  for (let i = 0, n = pts.length; i < n; i++) { const s = segSeg(a, b, pts[i], pts[(i + 1) % n]); if (s && s.t >= 0 && s.t <= 1 && s.u >= 0 && s.u <= 1) return true; }
  return false;
}
export const bbEmpty = () => ({ x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });
export function bbAdd(b, p) { if (p.x < b.x1) b.x1 = p.x; if (p.y < b.y1) b.y1 = p.y; if (p.x > b.x2) b.x2 = p.x; if (p.y > b.y2) b.y2 = p.y; return b; }
export const bbUnion = (a, b) => ({ x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) });
export const bbOk = b => isFinite(b.x1) && isFinite(b.x2);
export const bbHit = (a, b) => a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;
export const rectOf = (a, b) => ({ x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) });

// Sampel busur ke titik
export function arcPts(c, r, sa, ea, segLen = 0) {
  const sw = sweepOf(sa, ea);
  let n = Math.max(4, Math.ceil(sw / (TAU / 96)));
  if (segLen) n = Math.max(n, Math.min(720, Math.ceil(sw * r / segLen)));
  const out = [];
  for (let i = 0; i <= n; i++) out.push(polar(c, sa + sw * i / n, r));
  return out;
}
// Ellipse: c, u (vektor sumbu mayor), k (rasio), s, e parameter
export function ellPt(c, u, k, t) { const v = mul(perp(u), k); return { x: c.x + u.x * Math.cos(t) + v.x * Math.sin(t), y: c.y + u.y * Math.cos(t) + v.y * Math.sin(t) }; }
export function ellPts(c, u, k, s = 0, e = TAU, n = 96) {
  const sw = sweepOf(s, e), m = Math.max(8, Math.ceil(n * sw / TAU)), out = [];
  for (let i = 0; i <= m; i++) out.push(ellPt(c, u, k, s + sw * i / m));
  return out;
}
export function ellParam(c, u, k, p) { // parameter t dari titik
  const L = len(u), ux = unit(u), q = sub(p, c);
  return an(Math.atan2(dot(q, perp(ux)) / (L * k), dot(q, ux) / L));
}

// Spline fit (Catmull-Rom → Bezier) dan B-spline (de Boor)
export function fitBez(P, closed = false) {
  const n = P.length, out = [];
  if (n < 2) return out;
  const g = i => closed ? P[(i + n) % n] : P[clamp(i, 0, n - 1)];
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const t = 1 / 6;
    out.push([p1, add(p1, mul(sub(p2, p0), t)), sub(p2, mul(sub(p3, p1), t)), p2]);
  }
  return out;
}
export function bezPt(b, t) { const u = 1 - t; return { x: u * u * u * b[0].x + 3 * u * u * t * b[1].x + 3 * u * t * t * b[2].x + t * t * t * b[3].x, y: u * u * u * b[0].y + 3 * u * u * t * b[1].y + 3 * u * t * t * b[2].y + t * t * t * b[3].y }; }
export function bezSample(bz, n = 16) { const out = []; bz.forEach((b, i) => { for (let j = i ? 1 : 0; j <= n; j++) out.push(bezPt(b, j / n)); }); return out; }
export function deBoor(cp, kn, deg, t, w) {
  const n = cp.length - 1;
  let k = deg; while (k < n && t >= kn[k + 1]) k++;
  const d = [];
  for (let j = 0; j <= deg; j++) { const P = cp[j + k - deg], W = w ? w[j + k - deg] : 1; d.push({ x: P.x * W, y: P.y * W, w: W }); }
  for (let r = 1; r <= deg; r++) for (let j = deg; j >= r; j--) {
    const i = j + k - deg, den = kn[i + deg - r + 1] - kn[i], a = den ? (t - kn[i]) / den : 0;
    d[j] = { x: (1 - a) * d[j - 1].x + a * d[j].x, y: (1 - a) * d[j - 1].y + a * d[j].y, w: (1 - a) * d[j - 1].w + a * d[j].w };
  }
  return { x: d[deg].x / d[deg].w, y: d[deg].y / d[deg].w };
}
export function bsplineSample(cp, kn, deg, w, n) {
  const t0 = kn[deg], t1 = kn[kn.length - deg - 1], out = [];
  const m = n || Math.max(24, cp.length * 12);
  for (let i = 0; i <= m; i++) out.push(deBoor(cp, kn, deg, t0 + (t1 - t0) * Math.min(i / m, 1 - 1e-12), w));
  return out;
}

// Evaluasi ekspresi aritmetika aman (untuk input angka): + - * / ^ ( ) sqrt sin cos tan pi
export function evalNum(s) {
  s = String(s).trim().replace(/,/g, '.');
  if (/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return parseFloat(s);
  if (!/^[\d\s+\-*/^().a-z]*$/i.test(s)) return NaN;
  const toks = s.match(/\d*\.?\d+(?:e[-+]?\d+)?|[a-z]+|[+\-*/^()]/gi) || [];
  let i = 0;
  const F = { sqrt: Math.sqrt, sin: x => Math.sin(x * D2R), cos: x => Math.cos(x * D2R), tan: x => Math.tan(x * D2R), abs: Math.abs, round: Math.round };
  const prim = () => {
    const t = toks[i++];
    if (t === '(') { const v = expr(); i++; return v; }
    if (t === '-') return -prim();
    if (t === '+') return prim();
    if (/^[a-z]+$/i.test(t)) { const k = t.toLowerCase(); if (k === 'pi') return Math.PI; if (F[k]) { return F[k](prim()); } return NaN; }
    return parseFloat(t);
  };
  const pow = () => { let v = prim(); while (toks[i] === '^') { i++; v = Math.pow(v, prim()); } return v; };
  const term = () => { let v = pow(); while (toks[i] === '*' || toks[i] === '/') { const o = toks[i++], w = pow(); v = o === '*' ? v * w : v / w; } return v; };
  const expr = () => { let v = term(); while (toks[i] === '+' || toks[i] === '-') { const o = toks[i++], w = term(); v = o === '+' ? v + w : v - w; } return v; };
  try { const v = expr(); return i === toks.length ? v : NaN; } catch { return NaN; }
}
