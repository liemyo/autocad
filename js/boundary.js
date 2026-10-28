// Deteksi batas tertutup dari titik dalam (HATCH / BOUNDARY): graf planar + penelusuran muka.
import { TAU, dist, ang, polar, an, sweepOf, segSeg, lerp, polyArea, inPoly, bbEmpty, bbAdd, bbHit, eq } from './geom.js';
import { gprims, bbox, loopPts, prims } from './ent.js';

export function findBoundary(ed, p) {
  const v = ed.view, doc = ed.doc;
  const vb = { x1: (0 - v.ox) / v.scale, x2: (v.w - v.ox) / v.scale, y1: (v.oy - v.h) / v.scale, y2: v.oy / v.scale };
  const span = Math.max(vb.x2 - vb.x1, vb.y2 - vb.y1), tol = span * 1e-7;
  const S = []; // segmen: {a,b,src,a0,a1}
  let srcId = 0;
  const closedEnts = [];
  for (const e of ed.ents) {
    const L = doc.layers[e.layer]; if (L && (!L.on || L.frz)) continue;
    if (['hatch', 'text', 'mtext', 'point', 'dim', 'leader', 'image', 'wipeout'].includes(e.type)) continue;
    if (e.type !== 'xline' && e.type !== 'ray' && !bbHit(bbox(e, doc), vb)) continue;
    if ((e.type === 'pline' && e.closed) || e.type === 'circle' || (e.type === 'ellipse' && sweepOf(e.sp ?? 0, e.ep ?? TAU) >= TAU - 1e-9) || (e.type === 'spline' && e.closed)) closedEnts.push(e);
    const G = e.type === 'insert' ? prims(e, doc).filter(q => q.t === 'L' || q.t === 'A' || q.t === 'P') : gprims(e, doc);
    for (const q of G) {
      const id = srcId++;
      if (q.t === 'L') {
        let a = q.a, b = q.b;
        if (q.inf) { const d = { x: b.x - a.x, y: b.y - a.y }, l = Math.hypot(d.x, d.y), B = span * 4; a = q.inf === 2 ? { x: a.x - d.x / l * B, y: a.y - d.y / l * B } : a; b = { x: q.a.x + d.x / l * B, y: q.a.y + d.y / l * B }; }
        S.push({ a, b, src: id });
      } else if (q.t === 'A') {
        const sa = q.full ? 0 : q.sa, sw = q.full ? TAU : sweepOf(q.sa, q.ea), n = Math.max(8, Math.ceil(sw / (TAU / 128)));
        for (let i = 0; i < n; i++) { const a0 = sa + sw * i / n, a1 = sa + sw * (i + 1) / n; S.push({ a: polar(q.c, a0, q.r), b: polar(q.c, a1, q.r), src: id, arc: q, a0, a1 }); }
      } else if (q.t === 'P') {
        const P = q.pts, m = q.closed ? P.length : P.length - 1;
        for (let i = 0; i < m; i++) S.push({ a: P[i], b: P[(i + 1) % P.length], src: id });
      }
    }
  }
  if (S.length < 2 || S.length > 60000) return null;
  // grid spasial
  let bb = bbEmpty(); S.forEach(s => { bbAdd(bb, s.a); bbAdd(bb, s.b); });
  const cs = Math.max(bb.x2 - bb.x1, bb.y2 - bb.y1) / 96 || 1, grid = new Map();
  const cells = s => { const out = []; const x1 = Math.floor(Math.min(s.a.x, s.b.x) / cs), x2 = Math.floor(Math.max(s.a.x, s.b.x) / cs), y1 = Math.floor(Math.min(s.a.y, s.b.y) / cs), y2 = Math.floor(Math.max(s.a.y, s.b.y) / cs); for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) out.push(x + ',' + y); return out; };
  S.forEach((s, i) => { s.t = [0, 1]; for (const k of cells(s)) { let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(i); } });
  const seen = new Set();
  for (const c of grid.values()) for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
    const A = c[i], B = c[j], key = A < B ? A * 100003 + B : B * 100003 + A;
    if (seen.has(key)) continue; seen.add(key);
    const s1 = S[A], s2 = S[B];
    const r = segSeg(s1.a, s1.b, s2.a, s2.b);
    if (!r) continue;
    const e1 = 1e-9;
    if (r.t < -e1 || r.t > 1 + e1 || r.u < -e1 || r.u > 1 + e1) continue;
    s1.t.push(Math.min(1, Math.max(0, r.t))); s2.t.push(Math.min(1, Math.max(0, r.u)));
  }
  // simpul & sisi
  const V = [], key = new Map(), q = Math.max(tol, 1e-9);
  const vid = pt => { const k = Math.round(pt.x / q) + ',' + Math.round(pt.y / q); let i = key.get(k); if (i === undefined) { i = V.length; V.push({ x: pt.x, y: pt.y, out: [] }); key.set(k, i); } return i; };
  const E = new Map();
  for (const s of S) {
    const ts = [...new Set(s.t.map(t => Math.round(t * 1e9) / 1e9))].sort((a, b) => a - b);
    for (let i = 0; i < ts.length - 1; i++) {
      const pa = lerp(s.a, s.b, ts[i]), pb = lerp(s.a, s.b, ts[i + 1]);
      const ia = vid(pa), ib = vid(pb); if (ia === ib) continue;
      const k = ia < ib ? ia + '_' + ib : ib + '_' + ia; if (E.has(k)) continue;
      const info = s.arc ? { arc: s.arc, src: s.src, a0: s.a0 + (s.a1 - s.a0) * ts[i], a1: s.a0 + (s.a1 - s.a0) * ts[i + 1], from: ia } : { src: s.src };
      E.set(k, info);
      V[ia].out.push({ to: ib, info }); V[ib].out.push({ to: ia, info });
    }
  }
  for (const vx of V) { vx.out.forEach(o => o.a = Math.atan2(V[o.to].y - vx.y, V[o.to].x - vx.x)); vx.out.sort((x, y) => x.a - y.a); }
  // sinar ke kanan → sisi terdekat
  let best = null, bx = Infinity;
  for (const [k, info] of E) {
    const [ia, ib] = k.split('_').map(Number), A = V[ia], B = V[ib];
    if ((A.y > p.y) === (B.y > p.y)) continue;
    const x = A.x + (p.y - A.y) * (B.x - A.x) / (B.y - A.y);
    if (x > p.x && x < bx) { bx = x; best = A.y < B.y ? [ia, ib] : [ib, ia]; }
    void info;
  }
  if (!best) return null;
  const loop = trace(V, best[0], best[1]);
  if (!loop) return null;
  const pts = loop.map(i => V[i]);
  if (polyArea(pts) <= 0 || !inPoly(p, pts)) return null;
  const outer = simplify(loop, V, E);
  const loops = [outer];
  // pulau: entitas tertutup di dalam batas yang tidak memuat titik
  for (const e of closedEnts) {
    const lp = e.type === 'pline' ? loopPts(e.pts) : prims(e, doc)[0].t === 'A' ? null : prims(e, doc)[0].pts;
    const samp = e.type === 'circle' ? Array.from({ length: 16 }, (_, i) => polar(e.c, i * TAU / 16, e.r)) : lp;
    if (!samp || !samp.length) continue;
    if (!samp.every(s => inPoly(s, pts))) continue;
    if (inPoly(p, samp)) continue;
    if (samp.some(s => pts.some(o => eq(o, s, q * 10)))) continue; // bagian dari batas luar
    loops.push(e.type === 'circle' ? [{ x: e.c.x - e.r, y: e.c.y, b: 1 }, { x: e.c.x + e.r, y: e.c.y, b: 1 }] : e.type === 'pline' ? e.pts.map(v => ({ ...v })) : samp.slice(0, -1).map(v => ({ x: v.x, y: v.y, b: 0 })));
  }
  return loops;
}
function trace(V, a, b) {
  const loop = [a]; let u = a, w = b, guard = 0;
  while (guard++ < 200000) {
    const L = V[w].out, n = L.length;
    const idx = L.findIndex(o => o.to === u);
    const nx = L[(idx - 1 + n) % n];
    u = w; w = nx.to;
    if (u === a && w === b) return loop;
    loop.push(u);
  }
  return null;
}
// gabungkan potongan busur jadi bulge & hapus titik kolinear/duri
function simplify(loop, V, E) {
  const n = loop.length, info = [];
  for (let i = 0; i < n; i++) { const a = loop[i], b = loop[(i + 1) % n], k = a < b ? a + '_' + b : b + '_' + a; info.push(E.get(k)); }
  const out = [];
  let i = 0;
  // mulai dari batas run
  let start = 0;
  for (let k = 0; k < n; k++) { const pi = info[(k - 1 + n) % n], ci = info[k]; if (!(pi && ci && pi.arc && ci.arc && pi.src === ci.src)) { start = k; break; } }
  while (i < n) {
    const k = (start + i) % n, inf = info[k], A = V[loop[k]];
    if (inf && inf.arc) {
      let sw = 0, j = i;
      while (j < n) {
        const kk = (start + j) % n, f = info[kk]; if (!f || !f.arc || f.src !== inf.src) break;
        const fwd = f.from === loop[kk]; sw += fwd ? (f.a1 - f.a0) : (f.a0 - f.a1); j++;
      }
      out.push({ x: A.x, y: A.y, b: Math.abs(sw) >= TAU - 1e-6 ? 0 : Math.tan(sw / 4) });
      if (Math.abs(sw) >= TAU - 1e-6) { const c = inf.arc.c, r = inf.arc.r; return [{ x: c.x - r, y: c.y, b: 1 }, { x: c.x + r, y: c.y, b: 1 }]; }
      i = j;
    } else { out.push({ x: A.x, y: A.y, b: 0 }); i++; }
  }
  // hapus kolinear
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let k = 0; k < out.length; k++) {
      const a = out[(k - 1 + out.length) % out.length], b = out[k], c = out[(k + 1) % out.length];
      if (a.b || b.b) continue;
      const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), d = dist(a, b) * dist(b, c);
      if (Math.abs(cr) <= 1e-9 * (d || 1) || eq(a, c)) { out.splice(k, 1); changed = true; break; }
    }
  }
  return out;
}
void ang; void an;
