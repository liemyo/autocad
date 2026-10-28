// DXF: ekspor per versi AutoCAD (R12 … 2018 format, untuk AutoCAD 2018–2027) dan impor.
import { TAU, D2R, R2D, an, sweepOf, polar, dist, ang, add, sub, mul, dot, perp, unit, M, bbOk, fitBez, eq } from './geom.js';
import { prims, dimGeom, LTYPES, PATTERNS, plSegs, loopPts, textW, decodeText, insMatrix, xform, splinePts, primsToEnts, mtextLines } from './ent.js';
import { titleBlockEnts, fitVp, layoutFrame, UNIT_MM } from './doc.js';

export const DXF_VERSIONS = [
  { key: 'R2018', acad: 'AC1032', label: 'AutoCAD 2018 – 2027 DXF', years: '2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027' },
  { key: 'R2013', acad: 'AC1027', label: 'AutoCAD 2013 – 2017 DXF', years: '2013, 2014, 2015, 2016, 2017' },
  { key: 'R2010', acad: 'AC1024', label: 'AutoCAD 2010 – 2012 DXF', years: '2010, 2011, 2012' },
  { key: 'R2007', acad: 'AC1021', label: 'AutoCAD 2007 – 2009 DXF', years: '2007, 2008, 2009' },
  { key: 'R2004', acad: 'AC1018', label: 'AutoCAD 2004 – 2006 DXF', years: '2004, 2005, 2006' },
  { key: 'R2000', acad: 'AC1015', label: 'AutoCAD 2000 – 2002 DXF', years: '2000, 2000i, 2002' },
  { key: 'R12', acad: 'AC1009', label: 'AutoCAD R12 / LT2 DXF', years: 'R11, R12, LT2' },
];
const INSUNITS = { mm: 4, cm: 5, m: 6, in: 1, ft: 2 };

const tplCache = {};
async function template(ver) {
  if (!tplCache[ver]) { const r = await fetch(`tpl/${ver}.dxf`); if (!r.ok) throw new Error('Template DXF tidak ditemukan: ' + ver); tplCache[ver] = await r.text(); }
  return tplCache[ver];
}
function toTags(text) {
  const L = text.split(/\r?\n/), T = [];
  for (let i = 0; i + 1 < L.length; i += 2) T.push([L[i].trim(), L[i + 1]]);
  return T;
}
const num = v => { if (!isFinite(v)) v = 0; const s = (Math.abs(v) < 1e-12 ? 0 : v).toPrecision(15); return String(parseFloat(s)); };
const safeName = s => String(s || '0').replace(/[<>/\\":;?*|,=`]/g, '_').slice(0, 255) || '0';

export async function exportDXF(doc, opt = {}) {
  const ver = opt.ver || 'R2018', r12 = ver === 'R12', utf = !['R12', 'R2000', 'R2004'].includes(ver);
  const T = toTags(await template(ver));
  let seed = 1;
  const hi = T.findIndex(t => t[0] === '9' && t[1] === '$HANDSEED');
  seed = parseInt(T[hi + 1][1], 16) + 16;
  const H = () => (seed++).toString(16).toUpperCase();
  const enc = s => {
    s = String(s ?? '').replace(/Ø/g, '%%c').replace(/°/g, '%%d').replace(/±/g, '%%p');
    if (!utf) s = s.replace(/[^\x00-\x7F]/g, c => '\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
    return s.replace(/[\r\n]/g, ' ');
  };
  // cari handle penting
  const findEntry = (type, name) => { for (let i = 0; i < T.length; i++) if (T[i][0] === '0' && T[i][1] === type) { for (let j = i + 1; j < T.length && T[j][0] !== '0'; j++) if (T[j][0] === '2' && T[j][1] === name) { const h = T.slice(i + 1, j).find(t => t[0] === '5' || t[0] === '105'); return { i, h: h ? h[1] : null }; } } return null; };
  const tableHandle = name => { for (let i = 0; i < T.length - 1; i++) if (T[i][0] === '0' && T[i][1] === 'TABLE' && T[i + 1][1] === name) { const h = T.slice(i + 2, i + 6).find(t => t[0] === '5'); return h ? h[1] : '0'; } return '0'; };
  const MS = r12 ? null : findEntry('BLOCK_RECORD', '*Model_Space')?.h;
  const layTab = tableHandle('LAYER'), ltTab = tableHandle('LTYPE'), brTab = tableHandle('BLOCK_RECORD');
  let ps390 = null, mat347 = null;
  { const L0 = findEntry('LAYER', '0'); if (L0) { for (let j = L0.i + 1; j < T.length && T[j][0] !== '0'; j++) { if (T[j][0] === '390') ps390 = T[j][1]; if (T[j][0] === '347') mat347 = T[j][1]; } } }

  // ---------- kumpulkan entitas ----------
  let list = (opt.ents || doc.model).filter(e => { const L = doc.layers[e.layer]; return !opt.visibleOnly || !L || (L.on && !L.frz); });
  if (opt.sheet) { // kop layout → ruang model (skala viewport)
    const L = opt.sheet, vp = fitVp(L, doc);
    const m = M.mul(M.tr(vp.cx, vp.cy), M.mul(M.sc(1 / vp.s), M.tr(-(vp.x + vp.w / 2), -(vp.y + vp.h / 2))));
    doc.addLayer('KOP', { color: 7 });
    list = list.concat([...titleBlockEnts(L, doc), ...L.ents].map(e => { const n = xform(JSON.parse(JSON.stringify(e)), m); n.layer = n.layer || 'KOP'; if (n.lw > 0) n.lw = Math.max(0, n.lw); return n; }));
  }
  const usedBlocks = new Set();
  const scanB = l => l.forEach(e => { if (e.type === 'insert' && !usedBlocks.has(e.name) && doc.blocks[e.name]) { usedBlocks.add(e.name); scanB(doc.blocks[e.name].ents); } });
  scanB(list);
  const blockNames = {}; for (const b of usedBlocks) blockNames[b] = safeName(b);
  const ltUsed = new Set(['Continuous']);
  const allLists = [list, ...[...usedBlocks].map(b => doc.blocks[b].ents)];
  allLists.flat().forEach(e => { if (e.lt && !['ByLayer', 'ByBlock'].includes(e.lt)) ltUsed.add(e.lt); });
  Object.values(doc.layers).forEach(l => ltUsed.add(l.lt));
  doc.ltypes?.forEach(l => ltUsed.add(l));

  // ---------- penulis entitas ----------
  const dimBlocks = []; let dimN = 1;
  const style = (out, e, owner, type) => {
    out.push(['0', type], ['5', H()]);
    if (!r12) out.push(['330', owner], ['100', 'AcDbEntity']);
    out.push(['8', safeName(e.layer || '0')]);
    if (e.lt && e.lt !== 'ByLayer' && LTYPES[e.lt]) out.push(['6', e.lt]); else if (e.lt === 'ByBlock') out.push(['6', 'BYBLOCK']);
    if (e.color !== undefined && e.color !== 256) out.push(['62', String(e.color)]);
    if (!r12 && e.lw !== undefined && e.lw !== -1) out.push(['370', String(e.lw)]);
    if (!r12 && e.rgb) out.push(['420', String(parseInt(e.rgb.slice(1), 16))]);
  };
  const P = (out, c, p) => out.push([String(c), num(p.x)], [String(c + 10), num(p.y)], [String(c + 20), '0']);
  const sub_ = (out, s) => { if (!r12) out.push(['100', s]); };
  const plineOut = (out, e, owner, pts, closed, w = 0) => {
    if (!r12) {
      style(out, e, owner, 'LWPOLYLINE'); out.push(['100', 'AcDbPolyline'], ['90', String(pts.length)], ['70', closed ? '1' : '0'], ['43', num(w)]);
      for (const p of pts) { out.push(['10', num(p.x)], ['20', num(p.y)]); if (p.b) out.push(['42', num(p.b)]); }
    } else {
      style(out, e, owner, 'POLYLINE'); out.push(['66', '1'], ['10', '0'], ['20', '0'], ['30', '0'], ['70', closed ? '1' : '0']); if (w) out.push(['40', num(w)], ['41', num(w)]);
      for (const p of pts) { out.push(['0', 'VERTEX'], ['5', H()], ['8', safeName(e.layer)], ['10', num(p.x)], ['20', num(p.y)], ['30', '0']); if (p.b) out.push(['42', num(p.b)]); out.push(['70', '0']); }
      out.push(['0', 'SEQEND'], ['5', H()], ['8', safeName(e.layer)]);
    }
  };
  const textOut = (out, e, owner, t) => {
    style(out, e, owner, 'TEXT'); sub_(out, 'AcDbText');
    const w = textW(t.s, t.h, t.wf || 1), by = [0, 0.3 * t.h, -t.h / 2, -t.h][t.va || 0];
    const first = add(t.p, { x: Math.cos(t.rot || 0) * (-(t.ha || 0) * w / 2) - Math.sin(t.rot || 0) * by, y: Math.sin(t.rot || 0) * (-(t.ha || 0) * w / 2) + Math.cos(t.rot || 0) * by });
    P(out, 10, (t.ha || t.va) ? first : t.p); out.push(['40', num(t.h)], ['1', enc(t.s)]);
    if (t.rot) out.push(['50', num(an(t.rot) * R2D)]);
    if (t.wf && t.wf !== 1) out.push(['41', num(t.wf)]);
    if (t.ha) out.push(['72', String(t.ha)]);
    if (t.ha || t.va) P(out, 11, t.p);
    sub_(out, 'AcDbText'); if (t.va) out.push(['73', String(t.va)]);
  };
  const primOut = (out, base, owner, q) => { // primitif → entitas DXF sederhana
    if (q.t === 'L') { style(out, base, owner, 'LINE'); sub_(out, 'AcDbLine'); P(out, 10, q.a); P(out, 11, q.b); }
    else if (q.t === 'A') { if (q.full) { style(out, base, owner, 'CIRCLE'); sub_(out, 'AcDbCircle'); P(out, 10, q.c); out.push(['40', num(q.r)]); } else { style(out, base, owner, 'ARC'); sub_(out, 'AcDbCircle'); P(out, 10, q.c); out.push(['40', num(q.r)]); sub_(out, 'AcDbArc'); out.push(['50', num(an(q.sa) * R2D)], ['51', num(an(q.ea) * R2D)]); } }
    else if (q.t === 'P') plineOut(out, base, owner, q.pts.map(p => ({ x: p.x, y: p.y })), q.closed);
    else if (q.t === 'F') { for (const l of q.loops) { if (l.length >= 3 && l.length <= 4) { style(out, base, owner, 'SOLID'); sub_(out, 'AcDbTrace'); P(out, 10, l[0]); P(out, 11, l[1]); P(out, 12, l[3] || l[2]); P(out, 13, l[2]); if (!r12) out.push(['210', '0'], ['220', '0'], ['230', '1']); } else hatchOut(out, base, owner, { loops: [l.map(p => ({ ...p, b: 0 }))], pat: 'SOLID' }); } }
    else if (q.t === 'T') textOut(out, base, owner, q);
    else if (q.t === 'D') { style(out, base, owner, 'POINT'); sub_(out, 'AcDbPoint'); P(out, 10, q.p); }
  };
  const hatchOut = (out, e, owner, h) => {
    if (r12) { for (const l of h.loops) plineOut(out, e, owner, l, true); if (h.pat !== 'SOLID') prims({ ...h, type: 'hatch' }, doc).forEach(q => primOut(out, e, owner, q)); return; }
    const solid = h.pat === 'SOLID', def = h.patDef ? { f: h.patDef } : PATTERNS[h.pat] || PATTERNS.ANSI31;
    style(out, e, owner, 'HATCH'); out.push(['100', 'AcDbHatch'], ['10', '0'], ['20', '0'], ['30', '0'], ['210', '0'], ['220', '0'], ['230', '1'], ['2', solid ? 'SOLID' : (PATTERNS[h.pat] ? h.pat : 'ANSI31')], ['70', solid ? '1' : '0'], ['71', '0'], ['91', String(h.loops.length)]);
    h.loops.forEach((l, i) => {
      const hasB = l.some(p => p.b);
      out.push(['92', i === 0 ? '3' : '2'], ['72', hasB ? '1' : '0'], ['73', '1'], ['93', String(l.length)]);
      for (const p of l) { out.push(['10', num(p.x)], ['20', num(p.y)]); if (hasB) out.push(['42', num(p.b || 0)]); }
      out.push(['97', '0']);
    });
    out.push(['75', '0'], ['76', '1']);
    if (!solid) {
      const sc = h.patDef ? 1 : (h.sc || 1), rot = h.patDef ? 0 : (h.ang || 0), o = h.org || { x: 0, y: 0 };
      out.push(['52', num((h.ang || 0) * R2D)], ['41', num(h.sc || 1)], ['77', '0'], ['78', String(def.f.length)]);
      for (const f of def.f) {
        const th = f[0] * D2R + rot, u = { x: Math.cos(th), y: Math.sin(th) }, v = perp(u);
        const b = add(o, { x: (f[1] * Math.cos(rot) - f[2] * Math.sin(rot)) * sc, y: (f[1] * Math.sin(rot) + f[2] * Math.cos(rot)) * sc });
        const off = add(mul(u, f[3] * sc), mul(v, f[4] * sc)), dash = f.slice(5);
        out.push(['53', num(an(th) * R2D)], ['43', num(b.x)], ['44', num(b.y)], ['45', num(off.x)], ['46', num(off.y)], ['79', String(dash.length)]);
        dash.forEach(d => out.push(['49', num(d * sc)]));
      }
    }
    out.push(['98', '0']);
  };
  const splineOut = (out, e, owner) => {
    let cp, kn, deg = 3, w = null;
    if (e.cp && e.kn) { cp = e.cp; kn = e.kn; deg = e.deg || 3; w = e.w; }
    else {
      const bz = fitBez(e.fit, e.closed); if (!bz.length) return;
      cp = [bz[0][0]]; kn = [0, 0, 0, 0];
      bz.forEach((b, i) => { cp.push(b[1], b[2], b[3]); if (i < bz.length - 1) kn.push(i + 1, i + 1, i + 1); });
      kn.push(bz.length, bz.length, bz.length, bz.length);
    }
    style(out, e, owner, 'SPLINE'); out.push(['100', 'AcDbSpline'], ['210', '0'], ['220', '0'], ['230', '1'], ['70', String(8 + (w ? 4 : 0))], ['71', String(deg)], ['72', String(kn.length)], ['73', String(cp.length)], ['74', '0'], ['42', '0.0000001'], ['43', '0.0000001']);
    kn.forEach(k => out.push(['40', num(k)]));
    if (w) w.forEach(x => out.push(['41', num(x)]));
    cp.forEach(p => out.push(['10', num(p.x)], ['20', num(p.y)], ['30', '0']));
  };
  const dimOut = (out, e, owner) => {
    const G = dimGeom(e, doc.dim);
    if (r12) { G.forEach(q => primOut(out, e, owner, q)); return; }
    const name = '*D' + (dimN++), brh = H();
    const bl = []; const bEnt = { layer: '0', color: 0, lt: 'ByBlock', lw: -2 };
    dimBlocks.push({ name, brh, ents: G, base: bEnt });
    void bl;
    style(out, e, owner, 'DIMENSION');
    const tq = G.find(q => q.t === 'T');
    const types = { lin: 0, ali: 1, ang: 5, dia: 3, rad: 4, ord: 6, arc: 5 };
    let flag = types[e.kind] ?? 0; flag |= 32; if (e.kind === 'ord' && e.axis === 'x') flag |= 64;
    out.push(['100', 'AcDbDimension'], ['280', '0'], ['2', name], ['3', 'Standard']);
    const d10 = e.kind === 'rad' ? e.c : e.kind === 'dia' ? polar(e.c, ang(e.c, e.dl), e.r) : e.kind === 'ord' ? { x: 0, y: 0 } : e.dl;
    P(out, 10, d10); P(out, 11, tq ? tq.p : e.dl);
    out.push(['70', String(flag)], ['71', '5'], ['1', e.txt ? enc(e.txt) : '']);
    if (e.kind === 'lin' || e.kind === 'ali') { out.push(['100', 'AcDbAlignedDimension']); P(out, 13, e.p1); P(out, 14, e.p2); if (e.kind === 'lin') { out.push(['50', num(an(e.rot || 0) * R2D)], ['100', 'AcDbRotatedDimension']); } }
    else if (e.kind === 'rad' || e.kind === 'dia') { out.push(['100', e.kind === 'rad' ? 'AcDbRadialDimension' : 'AcDbDiametricDimension']); P(out, 15, e.kind === 'rad' ? polar(e.c, ang(e.c, e.dl), e.r) : polar(e.c, ang(e.c, e.dl) + Math.PI, e.r)); out.push(['40', '0']); }
    else if (e.kind === 'ang' || e.kind === 'arc') { out.push(['100', 'AcDb3PointAngularDimension']); const p1 = e.kind === 'arc' ? polar(e.c, e.sa, e.r) : e.p1, p2 = e.kind === 'arc' ? polar(e.c, e.ea, e.r) : e.p2; P(out, 13, p1); P(out, 14, p2); P(out, 15, e.c); }
    else if (e.kind === 'ord') { out.push(['100', 'AcDbOrdinateDimension']); P(out, 13, e.p1); P(out, 14, e.dl); }
  };
  const entOut = (out, e, owner) => {
    switch (e.type) {
      case 'line': style(out, e, owner, 'LINE'); sub_(out, 'AcDbLine'); P(out, 10, e.p1); P(out, 11, e.p2); return;
      case 'circle': style(out, e, owner, 'CIRCLE'); sub_(out, 'AcDbCircle'); P(out, 10, e.c); out.push(['40', num(e.r)]); return;
      case 'arc': style(out, e, owner, 'ARC'); sub_(out, 'AcDbCircle'); P(out, 10, e.c); out.push(['40', num(e.r)]); sub_(out, 'AcDbArc'); out.push(['50', num(an(e.sa) * R2D)], ['51', num(an(e.ea) * R2D)]); return;
      case 'point': style(out, e, owner, 'POINT'); sub_(out, 'AcDbPoint'); P(out, 10, e.p); return;
      case 'pline': plineOut(out, e, owner, e.pts, e.closed, e.w || 0); return;
      case 'ellipse':
        if (r12) { primOut(out, e, owner, prims(e, doc)[0]); return; }
        {
          let u = e.u, k = e.k, sp = e.sp ?? 0, ep = e.ep ?? TAU;
          if (k > 1) { u = mul(perp(u), k); k = 1 / k; if (sweepOf(sp, ep) < TAU - 1e-9) { sp = an(sp - Math.PI / 2); ep = an(ep - Math.PI / 2); } }
          style(out, e, owner, 'ELLIPSE'); out.push(['100', 'AcDbEllipse']); P(out, 10, e.c); P(out, 11, u); out.push(['210', '0'], ['220', '0'], ['230', '1'], ['40', num(k)], ['41', num(sp)], ['42', num(ep)]);
        }
        return;
      case 'spline': if (r12) { plineOut(out, e, owner, splinePts(e).map(p => ({ x: p.x, y: p.y })), false); return; } splineOut(out, e, owner); return;
      case 'text': textOut(out, e, owner, { ...e, s: decodeText(e.s) === e.s ? e.s : e.s }); return;
      case 'mtext':
        if (r12) { prims(e, doc).forEach(q => textOut(out, e, owner, q)); return; }
        {
          style(out, e, owner, 'MTEXT'); out.push(['100', 'AcDbMText']); P(out, 10, e.p); out.push(['40', num(e.h)], ['41', num(e.w || 0)], ['71', String(e.at || 1)], ['72', '1']); P(out, 11, { x: Math.cos(e.rot || 0), y: Math.sin(e.rot || 0) });
          const s = String(e.s).split('\n').map(x => enc(x.replace(/\\/g, '\\\\').replace(/[{}]/g, c => '\\' + c))).join('\\P');
          for (let i = 0; i < s.length; i += 250) out.push([i + 250 >= s.length ? '1' : '3', s.slice(i, i + 250)]);
          if (!s.length) out.push(['1', '']);
        }
        return;
      case 'solid': primOut(out, e, owner, { t: 'F', loops: [e.pts] }); return;
      case 'hatch': hatchOut(out, e, owner, e); return;
      case 'insert':
        style(out, e, owner, 'INSERT'); sub_(out, 'AcDbBlockReference'); out.push(['2', blockNames[e.name] || safeName(e.name)]); P(out, 10, e.p);
        if ((e.sx ?? 1) !== 1) out.push(['41', num(e.sx ?? 1)]); if ((e.sy ?? e.sx ?? 1) !== 1) out.push(['42', num(e.sy ?? e.sx ?? 1)]); if (e.rot) out.push(['50', num(an(e.rot) * R2D)]);
        return;
      case 'xline': case 'ray':
        if (r12) { const d = e.dir, B = 1e6; style(out, e, owner, 'LINE'); P(out, 10, e.type === 'xline' ? sub(e.p, mul(d, B)) : e.p); P(out, 11, add(e.p, mul(d, B))); return; }
        style(out, e, owner, e.type === 'xline' ? 'XLINE' : 'RAY'); out.push(['100', e.type === 'xline' ? 'AcDbXline' : 'AcDbRay']); P(out, 10, e.p); P(out, 11, e.dir); return;
      case 'dim': dimOut(out, e, owner); return;
      case 'wipeout': plineOut(out, e, owner, e.pts.map(p => ({ x: p.x, y: p.y })), true); return;
      default: prims(e, doc).forEach(q => primOut(out, e, owner, q));
    }
  };

  // ---------- susun konten ----------
  const ents = []; list.forEach(e => entOut(ents, e, MS));
  const brOut = [], blkOut = [];
  for (const b of usedBlocks) {
    const B = doc.blocks[b], name = blockNames[b], brh = r12 ? null : H();
    if (!r12) brOut.push(['0', 'BLOCK_RECORD'], ['5', brh], ['330', brTab], ['100', 'AcDbSymbolTableRecord'], ['100', 'AcDbBlockTableRecord'], ['2', name], ['340', '0'], ['70', '0'], ['280', '1'], ['281', '0']);
    blkOut.push(['0', 'BLOCK'], ['5', H()]); if (!r12) blkOut.push(['330', brh], ['100', 'AcDbEntity']); blkOut.push(['8', '0']); if (!r12) blkOut.push(['100', 'AcDbBlockBegin']);
    blkOut.push(['2', name], ['70', '0']); P(blkOut, 10, B.base); blkOut.push(['3', name], ['1', '']);
    B.ents.forEach(e => entOut(blkOut, e, brh));
    blkOut.push(['0', 'ENDBLK'], ['5', H()]); if (!r12) blkOut.push(['330', brh], ['100', 'AcDbEntity']); blkOut.push(['8', '0']); if (!r12) blkOut.push(['100', 'AcDbBlockEnd']);
  }
  for (const d of dimBlocks) {
    brOut.push(['0', 'BLOCK_RECORD'], ['5', d.brh], ['330', brTab], ['100', 'AcDbSymbolTableRecord'], ['100', 'AcDbBlockTableRecord'], ['2', d.name], ['340', '0'], ['70', '0'], ['280', '1'], ['281', '0']);
    blkOut.push(['0', 'BLOCK'], ['5', H()], ['330', d.brh], ['100', 'AcDbEntity'], ['8', '0'], ['100', 'AcDbBlockBegin'], ['2', d.name], ['70', '1'], ['10', '0'], ['20', '0'], ['30', '0'], ['3', d.name], ['1', '']);
    d.ents.forEach(q => primOut(blkOut, d.base, d.brh, q));
    blkOut.push(['0', 'ENDBLK'], ['5', H()], ['330', d.brh], ['100', 'AcDbEntity'], ['8', '0'], ['100', 'AcDbBlockEnd']);
  }
  // layer
  const layOut = [];
  for (const [name, L] of Object.entries(doc.layers)) {
    const col = String((L.on ? 1 : -1) * (L.color || 7)), flags = String((L.frz ? 1 : 0) | (L.lck ? 4 : 0));
    const lt = LTYPES[L.lt] ? L.lt : 'Continuous';
    if (r12) layOut.push(['0', 'LAYER'], ['5', H()], ['2', safeName(name)], ['70', flags], ['62', col], ['6', lt]);
    else { layOut.push(['0', 'LAYER'], ['5', H()], ['330', layTab], ['100', 'AcDbSymbolTableRecord'], ['100', 'AcDbLayerTableRecord'], ['2', safeName(name)], ['70', flags], ['62', col], ['6', lt]); if (!L.plot || name === 'Defpoints') layOut.push(['290', '0']); layOut.push(['370', String(L.lw ?? -3)]); if (ps390) layOut.push(['390', ps390]); if (mat347) layOut.push(['347', mat347]); }
  }
  // linetype
  const ltOut = [];
  for (const name of ltUsed) {
    if (name === 'Continuous' || !LTYPES[name]) continue;
    const p = LTYPES[name].p, tot = p.reduce((s, x) => s + Math.abs(x), 0);
    ltOut.push(['0', 'LTYPE'], ['5', H()]); if (!r12) ltOut.push(['330', ltTab], ['100', 'AcDbSymbolTableRecord'], ['100', 'AcDbLinetypeTableRecord']);
    ltOut.push(['2', name], ['70', '0'], ['3', LTYPES[name].d], ['72', '65'], ['73', String(p.length)], ['40', num(tot)]);
    p.forEach(x => { ltOut.push(['49', num(x)]); if (!r12) ltOut.push(['74', '0']); });
  }

  // ---------- sisipkan ke template ----------
  const ops = [];
  const tableRange = name => { let s = -1; for (let i = 0; i < T.length - 1; i++) { if (T[i][0] === '0' && T[i][1] === 'TABLE' && T[i + 1][0] === '2' && T[i + 1][1] === name) s = i; if (s >= 0 && T[i][0] === '0' && T[i][1] === 'ENDTAB') return [s, i]; } return null; };
  const entryRanges = (s, e, type, keep) => { const r = []; for (let i = s; i < e; i++) if (T[i][0] === '0' && T[i][1] === type) { let j = i + 1; while (j < e && T[j][0] !== '0') j++; const nm = T.slice(i, j).find(t => t[0] === '2'); if (!keep(nm ? nm[1] : '')) r.push([i, j]); } return r; };
  { const [s, e] = tableRange('LAYER'); entryRanges(s, e, 'LAYER', () => false).forEach(([a, b]) => ops.push({ at: a, del: b - a })); ops.push({ at: e, ins: layOut }); }
  { const [s, e] = tableRange('LTYPE'); entryRanges(s, e, 'LTYPE', n => ['ByBlock', 'ByLayer', 'Continuous', 'BYBLOCK', 'BYLAYER', 'CONTINUOUS'].includes(n)).forEach(([a, b]) => ops.push({ at: a, del: b - a })); ops.push({ at: e, ins: ltOut }); }
  if (!r12) { const [, e] = tableRange('BLOCK_RECORD'); ops.push({ at: e, ins: brOut }); }
  const secEnd = name => { let s = -1; for (let i = 0; i < T.length - 1; i++) { if (T[i][0] === '0' && T[i][1] === 'SECTION' && T[i + 1][1] === name) s = i; if (s >= 0 && T[i][0] === '0' && T[i][1] === 'ENDSEC') return i; } return -1; };
  ops.push({ at: secEnd('BLOCKS'), ins: blkOut });
  ops.push({ at: secEnd('ENTITIES'), ins: ents });
  ops.sort((a, b) => b.at - a.at || (a.del ? -1 : 1));
  for (const o of ops) { if (o.del) T.splice(o.at, o.del); else T.splice(o.at, 0, ...o.ins); }
  // header
  const setH = (name, vals) => { const i = T.findIndex(t => t[0] === '9' && t[1] === name); if (i < 0) return; vals.forEach((v, k) => { if (T[i + 1 + k]) T[i + 1 + k][1] = String(v); }); };
  const ext = doc.extents(list);
  if (bbOk(ext)) { setH('$EXTMIN', [num(ext.x1), num(ext.y1), 0]); setH('$EXTMAX', [num(ext.x2), num(ext.y2), 0]); setH('$LIMMAX', [num(ext.x2), num(ext.y2)]); }
  setH('$INSUNITS', [INSUNITS[doc.set.units] ?? 4]);
  setH('$LTSCALE', [num(doc.set.ltscale || 1)]);
  setH('$DIMSCALE', [num(doc.dim.scale || 1)]);
  setH('$CLAYER', [safeName(doc.clayer)]);
  setH('$HANDSEED', [(seed + 1).toString(16).toUpperCase()]);
  return T.map(([c, v]) => c.padStart(3, ' ') + '\n' + v).join('\n') + '\n';
}

// ================= IMPOR =================
const CW = { CONTINUOUS: 'Continuous', BYLAYER: 'ByLayer', BYBLOCK: 'ByBlock' };
export function stripMText(s) {
  return s.replace(/\\P/g, '\n').replace(/\\[ACcFfHhQTWp][^;]*;/g, '').replace(/\\S([^;]*);/g, (m, a) => a.replace(/[#^]/g, '/')).replace(/\\[LlOoKkNX]/g, '').replace(/\\~/g, ' ').replace(/\\U\+([0-9A-Fa-f]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\([\\{}])/g, '$1').replace(/[{}]/g, '');
}
const uesc = s => String(s ?? '').replace(/\\U\+([0-9A-Fa-f]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
export function parseDXF(text) {
  const L = text.split(/\r?\n/), T = [];
  for (let i = 0; i + 1 < L.length; i += 2) T.push([parseInt(L[i].trim(), 10), L[i + 1].replace(/\r$/, '')]);
  const out = { header: {}, layers: {}, ltypes: {}, blocks: {}, ents: [], paper: [], warn: new Set() };
  const f = (G, c, d = 0) => { const t = G.find(t => t[0] === c); return t ? parseFloat(t[1]) : d; };
  const pt = (G, c) => ({ x: f(G, c), y: f(G, c + 10) });
  const ocs = G => f(G, 230, 1) < 0;
  let i = 0;
  const nextEntity = () => { const start = i; i++; while (i < T.length && T[i][0] !== 0) i++; return T.slice(start, i); };
  while (i < T.length) {
    if (T[i][0] === 0 && T[i][1] === 'SECTION') {
      const name = T[i + 1][1]; i += 2;
      if (name === 'HEADER') {
        let v = null;
        while (i < T.length && !(T[i][0] === 0 && T[i][1] === 'ENDSEC')) { if (T[i][0] === 9) { v = T[i][1]; out.header[v] = []; } else if (v) out.header[v].push(T[i][1]); i++; }
      } else if (name === 'TABLES') {
        while (i < T.length && !(T[i][0] === 0 && T[i][1] === 'ENDSEC')) {
          if (T[i][0] === 0 && (T[i][1] === 'LAYER' || T[i][1] === 'LTYPE')) {
            const typ = T[i][1], G = nextEntity(), g = c => G.find(t => t[0] === c)?.[1];
            if (typ === 'LAYER') { const c = parseInt(g(62) ?? '7', 10), f = parseInt(g(70) ?? '0', 10); out.layers[uesc(g(2))] = { color: Math.abs(c) || 7, on: c >= 0, frz: !!(f & 1), lck: !!(f & 4), lt: CW[(g(6) || 'Continuous').toUpperCase()] || g(6) || 'Continuous', lw: parseInt(g(370) ?? '-3', 10), plot: g(290) !== '0', desc: '' }; }
            else { const nm = g(2); if (nm && !CW[nm.toUpperCase()]) out.ltypes[nm] = { d: g(3) || nm, p: G.filter(t => t[0] === 49).map(t => parseFloat(t[1])) }; }
            continue;
          }
          i++;
        }
      } else if (name === 'BLOCKS') {
        while (i < T.length && !(T[i][0] === 0 && T[i][1] === 'ENDSEC')) {
          if (T[i][0] === 0 && T[i][1] === 'BLOCK') {
            const G = nextEntity(), g = c => G.find(t => t[0] === c)?.[1];
            const nm = uesc(g(2)), base = { x: parseFloat(g(10) || 0), y: parseFloat(g(20) || 0) }, ents = [];
            const stop = () => T[i][0] === 0 && T[i][1] === 'ENDBLK';
            readEnts(stop, ents);
            nextEntity();
            if (!/^\*(Model|Paper)_Space/i.test(nm) && !/^\$(Model|Paper)_Space/i.test(nm)) out.blocks[nm] = { base, ents, rev: 1 };
            continue;
          }
          i++;
        }
      } else if (name === 'ENTITIES') {
        const all = [];
        readEnts(() => T[i][0] === 0 && T[i][1] === 'ENDSEC', all);
        all.forEach(e => (e._ps ? out.paper : out.ents).push(e));
      } else { while (i < T.length && !(T[i][0] === 0 && T[i][1] === 'ENDSEC')) i++; }
    }
    i++;
  }
  function readEnts(stop, arr) {
    while (i < T.length && !stop()) {
      if (T[i][0] !== 0) { i++; continue; }
      const type = T[i][1];
      const G = nextEntity();
      if (type === 'POLYLINE') {
        const verts = [];
        while (i < T.length && T[i][0] === 0 && T[i][1] === 'VERTEX') verts.push(nextEntity());
        if (T[i] && T[i][1] === 'SEQEND') nextEntity();
        const e = convPolyline(G, verts); if (e) arr.push(e); continue;
      }
      if (type === 'INSERT' && G.find(t => t[0] === 66 && t[1].trim() === '1')) {
        const e = conv(type, G); if (e) arr.push(e);
        while (i < T.length && T[i][0] === 0 && T[i][1] === 'ATTRIB') { const A = nextEntity(), a = conv('TEXT', A); if (a && !(parseInt(A.find(t => t[0] === 70)?.[1] || '0', 10) & 1)) arr.push(a); }
        if (T[i] && T[i][1] === 'SEQEND') nextEntity();
        continue;
      }
      const e = conv(type, G); if (e) { if (Array.isArray(e)) arr.push(...e); else arr.push(e); }
    }
  }
  function common(G) {
    const g = c => G.find(t => t[0] === c)?.[1];
    const e = { layer: uesc(g(8) ?? '0'), color: g(62) !== undefined ? Math.abs(parseInt(g(62), 10)) : 256, lt: g(6) ? (CW[g(6).toUpperCase()] || g(6)) : 'ByLayer', lw: g(370) !== undefined ? parseInt(g(370), 10) : -1 };
    if (g(420)) e.rgb = '#' + parseInt(g(420), 10).toString(16).padStart(6, '0').toUpperCase();
    if (g(48)) e.lts = parseFloat(g(48));
    if (g(67) && g(67).trim() === '1') e._ps = 1;
    return e;
  }
  function conv(type, G) {
    const e = common(G), g = c => G.find(t => t[0] === c)?.[1];
    switch (type) {
      case 'LINE': return { ...e, type: 'line', p1: pt(G, 10), p2: pt(G, 11) };
      case 'CIRCLE': { const c = pt(G, 10); if (ocs(G)) c.x = -c.x; return { ...e, type: 'circle', c, r: f(G, 40) }; }
      case 'ARC': { const c = pt(G, 10); let sa = f(G, 50) * D2R, ea = f(G, 51) * D2R; if (ocs(G)) { c.x = -c.x; [sa, ea] = [Math.PI - ea, Math.PI - sa]; } return { ...e, type: 'arc', c, r: f(G, 40), sa: an(sa), ea: an(ea) }; }
      case 'POINT': return { ...e, type: 'point', p: pt(G, 10) };
      case 'LWPOLYLINE': {
        const pts = []; let cur = null; const flip = ocs(G);
        for (const [c, v] of G) { if (c === 10) { cur = { x: parseFloat(v) * (flip ? -1 : 1), y: 0, b: 0 }; pts.push(cur); } else if (c === 20 && cur) cur.y = parseFloat(v); else if (c === 42 && cur) cur.b = parseFloat(v) * (flip ? -1 : 1); }
        return { ...e, type: 'pline', pts, closed: !!(parseInt(g(70) || '0', 10) & 1), w: f(G, 43) || 0 };
      }
      case 'ELLIPSE': return { ...e, type: 'ellipse', c: pt(G, 10), u: pt(G, 11), k: f(G, 40, 1), sp: f(G, 41, 0), ep: f(G, 42, TAU) };
      case 'SPLINE': {
        const cp = [], fit = [], kn = G.filter(t => t[0] === 40).map(t => parseFloat(t[1])), w = G.filter(t => t[0] === 41).map(t => parseFloat(t[1]));
        let cur = null; for (const [c, v] of G) { if (c === 10) { cur = { x: +v, y: 0 }; cp.push(cur); } else if (c === 20 && cur) cur.y = +v; }
        cur = null; for (const [c, v] of G) { if (c === 11) { cur = { x: +v, y: 0 }; fit.push(cur); } else if (c === 21 && cur) cur.y = +v; }
        const deg = parseInt(g(71) || '3', 10);
        if (cp.length > deg && kn.length === cp.length + deg + 1) return { ...e, type: 'spline', cp, kn, deg, w: w.length === cp.length && w.some(x => x !== 1) ? w : undefined };
        if (fit.length >= 2) return { ...e, type: 'spline', fit, closed: !!(parseInt(g(70) || '0', 10) & 1) };
        return null;
      }
      case 'TEXT': case 'ATTRIB': {
        const ha = parseInt(g(72) || '0', 10), va = parseInt(g(type === 'ATTRIB' ? 74 : 73) || '0', 10), al = (ha || va) && G.some(t => t[0] === 11);
        let p = al ? pt(G, 11) : pt(G, 10); if (ocs(G)) p.x = -p.x;
        const H = ha === 4 ? 1 : ha > 2 ? 0 : ha, V = ha === 4 ? 2 : va;
        return { ...e, type: 'text', p, h: f(G, 40, 2.5), s: uesc(g(1) || ''), rot: f(G, 50) * D2R, ha: H, va: V, wf: f(G, 41, 1) };
      }
      case 'MTEXT': {
        let s = G.filter(t => t[0] === 3).map(t => t[1]).join('') + (g(1) || '');
        const dir = G.some(t => t[0] === 11) ? pt(G, 11) : null;
        return { ...e, type: 'mtext', p: pt(G, 10), h: f(G, 40, 2.5), w: f(G, 41, 0), at: parseInt(g(71) || '1', 10), s: stripMText(s), rot: dir ? Math.atan2(dir.y, dir.x) : f(G, 50) };
      }
      case 'SOLID': case 'TRACE': { const a = pt(G, 10), b = pt(G, 11), c = pt(G, 12), d = pt(G, 13); return { ...e, type: 'solid', pts: eq(c, d) ? [a, b, c] : [a, b, d, c] }; }
      case 'INSERT': { const sx = f(G, 41, 1); return { ...e, type: 'insert', name: uesc(g(2)), p: pt(G, 10), sx, sy: f(G, 42, 1), rot: f(G, 50) * D2R }; }
      case 'XLINE': return { ...e, type: 'xline', p: pt(G, 10), dir: unit(pt(G, 11)) };
      case 'RAY': return { ...e, type: 'ray', p: pt(G, 10), dir: unit(pt(G, 11)) };
      case 'LEADER': { const pts = []; let cur = null; for (const [c, v] of G) { if (c === 10) { cur = { x: +v, y: 0 }; pts.push(cur); } else if (c === 20 && cur) cur.y = +v; } return pts.length >= 2 ? { ...e, type: 'leader', pts, s: '' } : null; }
      case 'DIMENSION': return convDim(e, G);
      case 'HATCH': return convHatch(e, G);
      case '3DFACE': { const P4 = [pt(G, 10), pt(G, 11), pt(G, 12), pt(G, 13)]; return P4.map((p, k) => ({ ...e, type: 'line', p1: p, p2: P4[(k + 1) % 4] })).filter(l => !eq(l.p1, l.p2)); }
      case 'VIEWPORT': case 'ATTDEF': case 'SEQEND': case 'ENDBLK': return null;
      default: out.warn.add(type); return null;
    }
  }
  function convPolyline(G, verts) {
    const e = common(G), fl = parseInt(G.find(t => t[0] === 70)?.[1] || '0', 10);
    if (fl & (16 | 64)) { out.warn.add('POLYFACE/MESH'); return null; }
    const pts = verts.filter(V => !(parseInt(V.find(t => t[0] === 70)?.[1] || '0', 10) & 16)).map(V => ({ x: f(V, 10), y: f(V, 20), b: f(V, 42) }));
    return { ...e, type: 'pline', pts, closed: !!(fl & 1), w: f(G, 40) || 0 };
  }
  function convDim(e, G) {
    const g = c => G.find(t => t[0] === c)?.[1];
    const t = parseInt(g(70) || '0', 10) & 7, txt = g(1) || '';
    const d = { ...e, type: 'dim' }; if (txt && txt !== '<>') d.txt = uesc(txt);
    const p10 = pt(G, 10), p11 = pt(G, 11);
    if (t === 0 || t === 1) Object.assign(d, { kind: t === 0 ? 'lin' : 'ali', p1: pt(G, 13), p2: pt(G, 14), dl: p10, rot: f(G, 50) * D2R });
    else if (t === 4) Object.assign(d, { kind: 'rad', c: p10, r: dist(p10, pt(G, 15)), dl: p11 });
    else if (t === 3) { const a = pt(G, 15), c = { x: (a.x + p10.x) / 2, y: (a.y + p10.y) / 2 }; Object.assign(d, { kind: 'dia', c, r: dist(a, p10) / 2, dl: p11 }); }
    else if (t === 5) Object.assign(d, { kind: 'ang', c: pt(G, 15), p1: pt(G, 13), p2: pt(G, 14), dl: p10 });
    else { const bn = g(2); return bn ? { ...e, type: 'insert', name: bn, p: { x: 0, y: 0 }, sx: 1, sy: 1, rot: 0 } : null; }
    if (t !== 0 && t !== 1) d.tp = undefined;
    return d;
  }
  function convHatch(e, G) {
    const g = c => G.find(t => t[0] === c)?.[1];
    const name = g(2) || 'SOLID', solid = (g(70) || '').trim() === '1';
    let k = G.findIndex(t => t[0] === 91), nLoops = k >= 0 ? parseInt(G[k][1], 10) : 0; k++;
    const loops = [];
    const rd = c => { while (k < G.length && G[k][0] !== c) k++; return k < G.length ? G[k++][1] : null; };
    for (let n = 0; n < nLoops; n++) {
      const flags = parseInt(rd(92), 10), loop = [];
      if (flags & 2) {
        const hasB = parseInt(rd(72), 10); rd(73); const nv = parseInt(rd(93), 10);
        for (let v = 0; v < nv; v++) { const x = +rd(10), y = +rd(20); let b = 0; if (hasB) { if (G[k] && G[k][0] === 42) b = +G[k++][1]; } loop.push({ x, y, b }); }
      } else {
        const ne = parseInt(rd(93), 10);
        for (let q = 0; q < ne; q++) {
          const et = parseInt(rd(72), 10);
          if (et === 1) { const a = { x: +rd(10), y: +rd(20) }; rd(11); rd(21); loop.push({ ...a, b: 0 }); }
          else if (et === 2) { const c = { x: +rd(10), y: +rd(20) }, r = +rd(40); let sa = +rd(50) * D2R, ea = +rd(51) * D2R; const ccw = parseInt(rd(73), 10); if (!ccw) { sa = -sa; ea = -ea; const sw = an(sa - ea) || TAU; loop.push({ ...polar(c, sa, r), b: -Math.tan(sw / 4) }); } else { const sw = an(ea - sa) || TAU; loop.push({ ...polar(c, sa, r), b: Math.tan(sw / 4) }); } }
          else if (et === 3) { const c = { x: +rd(10), y: +rd(20) }, u = { x: +rd(11), y: +rd(21) }, kk = +rd(40); let sa = +rd(50) * D2R, ea = +rd(51) * D2R; const ccw = parseInt(rd(73), 10); const n2 = 24; if (!ccw) { sa = -sa; ea = -ea; } const sw = ccw ? (an(ea - sa) || TAU) : -(an(sa - ea) || TAU); const v = mul(perp(u), kk); for (let j = 0; j < n2; j++) { const t = sa + sw * j / n2; loop.push({ x: c.x + u.x * Math.cos(t) + v.x * Math.sin(t), y: c.y + u.y * Math.cos(t) + v.y * Math.sin(t), b: 0 }); } }
          else if (et === 4) { const deg = +rd(94); rd(73); rd(74); const nk = +rd(95), nc = +rd(96); const kn = []; for (let j = 0; j < nk; j++) kn.push(+rd(40)); const cp = []; for (let j = 0; j < nc; j++) cp.push({ x: +rd(10), y: +rd(20) }); try { splinePts({ cp, kn, deg }).slice(0, -1).forEach(p => loop.push({ ...p, b: 0 })); } catch { cp.forEach(p => loop.push({ ...p, b: 0 })); } }
        }
      }
      const ns = rd(97); for (let s = 0; s < parseInt(ns || '0', 10); s++) rd(330);
      if (loop.length >= 2) loops.push(loop);
    }
    if (!loops.length) return null;
    const h = { ...e, type: 'hatch', pat: solid ? 'SOLID' : name.toUpperCase(), sc: f(G, 41, 1), ang: f(G, 52) * D2R, loops, org: { x: 0, y: 0 } };
    if (!solid) {
      const fams = []; let j = G.findIndex(t => t[0] === 78);
      if (j >= 0) {
        const nf = parseInt(G[j][1], 10); j++;
        for (let q = 0; q < nf; q++) {
          const take = c => { while (j < G.length && G[j][0] !== c) j++; return j < G.length ? +G[j++][1] : 0; };
          const a = take(53), bx = take(43), by = take(44), ox = take(45), oy = take(46), nd = take(79), dash = [];
          for (let z = 0; z < nd; z++) dash.push(take(49));
          const u = { x: Math.cos(a * D2R), y: Math.sin(a * D2R) }, v = perp(u);
          fams.push([a, bx, by, dot({ x: ox, y: oy }, u), dot({ x: ox, y: oy }, v), ...dash]);
        }
      }
      if (fams.length) { h.patDef = fams; }
      else if (!PATTERNS[h.pat]) h.pat = 'ANSI31';
    }
    return h;
  }
  return out;
}
export const UNITS_FROM_INS = { 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' };
void UNIT_MM; void layoutFrame; void plSegs; void loopPts; void mtextLines; void primsToEnts; void insMatrix; void sweepOf;
