// Contoh gambar kerja: Rumah Tinggal Tipe 45 (6,00 × 7,50 m), satuan mm.
// A-01 Denah Lantai 1 skala 1:100 · A-02 Detail Kusen Pintu & Jendela skala 1:50.
// Kaidah gambar: dinding terpotong tebal + arsir bata, kolom praktis diarsir penuh, bukaan memotong dinding,
// kusen berkode, dimensi 3 lapis (bukaan · as · total), notasi as, elevasi lantai, tanda potongan, arah utara.
import { LIBRARY } from './library.js';

const T = 150, HT = T / 2;                     // tebal dinding 1/2 bata + plester
const AX = [0, 3000, 4500, 6000], AY = [0, 3000, 6000, 7500];
const RAD = Math.PI / 180;

// ---------- primitif blok (ByBlock) ----------
let bid = 900000;
const bp = (e) => ({ layer: '0', color: 0, lt: 'ByBlock', lw: -2, id: bid++, ...e });
const bL = (x1, y1, x2, y2, o) => bp({ type: 'line', p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, ...o });
const bR = (x, y, w, h, o) => bp({ type: 'pline', closed: true, pts: [{ x, y, b: 0 }, { x: x + w, y, b: 0 }, { x: x + w, y: y + h, b: 0 }, { x, y: y + h, b: 0 }], ...o });
const bA = (x, y, r, sa, ea, o) => bp({ type: 'arc', c: { x, y }, r, sa: sa * RAD, ea: ea * RAD, ...o });

// Pintu ayun 1 daun di dinding 150: bukaan sepanjang +x (0..W), daun membuka ke +y, engsel di x=0.
function doorBlock(W, desc) {
  const L = W - 120;
  return { base: { x: 0, y: 0 }, desc, cat: 'Pintu & Jendela', rev: 1, ents: [
    bR(0, -HT, 60, T), bR(W - 60, -HT, 60, T),            // kusen 6/15 (terpotong)
    bR(60, HT, 40, L),                                     // daun terbuka 90°
    bA(60, HT, L, 0, 90, { lw: 9 }),                       // jejak ayunan
    bL(60, -HT, W - 60, -HT, { lw: 9 }), bL(60, HT, 100, HT, { lw: 9 }),
  ] };
}
// Jendela ayun (casement) n daun: kusen terpotong, ambang bawah tampak, daun + kaca.
function windowBlock(W, n, desc) {
  const ents = [bR(0, -HT, 60, T), bR(W - 60, -HT, 60, T), bL(60, -HT, W - 60, -HT, { lw: 13 }), bL(60, HT, W - 60, HT, { lw: 13 })];
  const dw = (W - 120) / n;
  for (let i = 0; i < n; i++) { const x = 60 + i * dw; ents.push(bR(x, -25, dw, 50, { lw: 13 }), bL(x + 40, 0, x + dw - 40, 0, { lw: 5 })); }
  return { base: { x: 0, y: 0 }, desc, cat: 'Pintu & Jendela', rev: 1, ents };
}
// Bovenlicht tinggi (di atas bidang potong) → tampil garis tersembunyi, dinding tetap utuh.
function bvBlock(W, desc) {
  return { base: { x: 0, y: 0 }, desc, cat: 'Pintu & Jendela', rev: 1, ents: [bR(0, -HT, W, T), bL(0, 0, W, 0)] };
}

// ---------- union persegi sumbu-sejajar → loop batas (dinding menyatu tanpa garis sambungan) ----------
function regionLoops(adds, subs, keep = () => true) {
  const xs = [...new Set([...adds, ...subs].flatMap(r => [r[0], r[2]]))].sort((a, b) => a - b);
  const ys = [...new Set([...adds, ...subs].flatMap(r => [r[1], r[3]]))].sort((a, b) => a - b);
  const inR = (r, x, y) => x > r[0] && x < r[2] && y > r[1] && y < r[3];
  const nx = xs.length - 1, ny = ys.length - 1, F = [];
  for (let i = 0; i < nx; i++) { F[i] = []; for (let j = 0; j < ny; j++) { const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2; F[i][j] = adds.some(r => inR(r, cx, cy)) && !subs.some(r => inR(r, cx, cy)) && keep(cx, cy); } }
  const f = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && F[i][j];
  const edges = new Map(), key = p => p.x + ',' + p.y, push = (a, b) => { const k = key(a); if (!edges.has(k)) edges.set(k, []); edges.get(k).push({ a, b }); };
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if (!F[i][j]) continue;
    const x0 = xs[i], x1 = xs[i + 1], y0 = ys[j], y1 = ys[j + 1];
    if (!f(i, j - 1)) push({ x: x0, y: y0 }, { x: x1, y: y0 });
    if (!f(i + 1, j)) push({ x: x1, y: y0 }, { x: x1, y: y1 });
    if (!f(i, j + 1)) push({ x: x1, y: y1 }, { x: x0, y: y1 });
    if (!f(i - 1, j)) push({ x: x0, y: y1 }, { x: x0, y: y0 });
  }
  const loops = [];
  for (const list of edges.values()) while (list.length) {
    let e = list.pop(); const loop = [e.a];
    for (let guard = 0; guard < 10000; guard++) { loop.push(e.b); const nxt = edges.get(key(e.b)); if (!nxt || !nxt.length) break; e = nxt.pop(); }
    loop.pop();
    const out = loop.filter((p, k) => { const a = loop[(k - 1 + loop.length) % loop.length], b = loop[(k + 1) % loop.length]; return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y)); });
    if (out.length >= 4) loops.push(out.map(p => ({ x: p.x, y: p.y, b: 0 })));
  }
  return loops;
}

export function buildSample(doc) {
  const LY = (n, color, o = {}) => doc.addLayer(n, { color, ...o });
  LY('AS', 1, { lt: 'CENTER2', lw: 13, desc: 'Garis as / grid struktur' });
  LY('DINDING', 7, { lw: 50, desc: 'Dinding terpotong' }); LY('ARSIR-DINDING', 8, { lw: 9, desc: 'Arsir pasangan bata' });
  LY('KOLOM', 7, { lw: 50, desc: 'Kolom praktis 15/15' }); LY('KUSEN', 4, { lw: 25, desc: 'Kusen, daun pintu & jendela' });
  LY('TAG-KUSEN', 3, { lw: 13 }); LY('FURNITUR', 8, { lw: 13 }); LY('SANITAIR', 5, { lw: 13 }); LY('LANTAI', 9, { lw: 9, desc: 'Pola keramik' });
  LY('TEPI-LANTAI', 7, { lw: 25 }); LY('ATAP', 6, { lt: 'HIDDEN2', lw: 13, desc: 'Garis overstek atap (proyeksi)' });
  LY('POTONGAN', 1, { lw: 50 }); LY('DIMENSI', 2, { lw: 13 }); LY('TEKS', 7, { lw: 18 }); LY('TABEL', 7, { lw: 13 });
  ['CENTER2', 'HIDDEN2', 'PHANTOM'].forEach(t => { if (!doc.ltypes.includes(t)) doc.ltypes.push(t); });

  const blocks = {
    P1: doorBlock(1000, 'P1 — Pintu utama panel kayu 1 daun, kusen 6/15'),
    P2: doorBlock(900, 'P2 — Pintu kamar / belakang panel kayu, kusen 6/15'),
    P3: doorBlock(800, 'P3 — Pintu KM PVC, kusen aluminium'),
    J1: windowBlock(1200, 2, 'J1 — Jendela ayun 2 daun kaca 5 mm'),
    J2: windowBlock(600, 1, 'J2 — Jendela ayun 1 daun kaca 5 mm'),
    BV1: bvBlock(600, 'BV1 — Bovenlicht jalusi KM (atas, +1,80)'),
  };
  Object.assign(doc.blocks, blocks);
  for (const n of ['KASUR-160', 'KASUR-120', 'LEMARI', 'NAKAS', 'SOFA-3', 'MEJA-KOPI', 'MEJA-MAKAN-4', 'KOMPOR-2', 'BAK-CUCI-PIRING', 'KULKAS', 'MESIN-CUCI', 'KLOSET', 'SHOWER', 'ARAH-UTARA']) doc.blocks[n] = JSON.parse(JSON.stringify(LIBRARY[n]));

  doc.set.ltscale = 100; doc.set.textH = 200;
  doc.dim = { ...doc.dim, scale: 100, txt: 2, asz: 2, exo: 1, exe: 1.25, gap: 0.8, dec: 0, arrow: 'tick', sep: ',' }; doc.dimRev++;

  const E = [], add = e => { E.push({ color: 256, lt: 'ByLayer', lw: -1, ...e }); return e; };
  const line = (x1, y1, x2, y2, layer, o) => add({ type: 'line', layer, p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, ...o });
  const pl = (pts, layer, closed = true, o) => add({ type: 'pline', layer, closed, pts: pts.map(([x, y]) => ({ x, y, b: 0 })), ...o });
  const box = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  const loop = (x1, y1, x2, y2) => box(x1, y1, x2, y2).map(([x, y]) => ({ x, y, b: 0 }));
  const text = (x, y, s, h, o = {}) => add({ type: 'text', layer: 'TEKS', p: { x, y }, s, h, ha: 1, va: 2, rot: 0, ...o });
  const ins = (name, x, y, rot = 0, sx = 1, sy = sx, layer = 'KUSEN', o) => add({ type: 'insert', layer, name, p: { x, y }, sx, sy, rot: rot * RAD, ...o });
  // sisipkan blok sehingga sudut kiri-bawah kotak hasil rotasi jatuh di (x, y); lb = kotak lokal blok
  const place = (name, lb, rot, x, y, layer = 'FURNITUR', s = 1) => {
    const c = Math.cos(rot * RAD), si = Math.sin(rot * RAD);
    const pts = [[lb[0], lb[1]], [lb[2], lb[1]], [lb[2], lb[3]], [lb[0], lb[3]]].map(([u, v]) => [(u * c - v * si) * s, (u * si + v * c) * s]);
    ins(name, x - Math.min(...pts.map(p => p[0])), y - Math.min(...pts.map(p => p[1])), rot, s, s, layer);
  };
  const D = (p1, p2, dl, rot = 0, o) => add({ type: 'dim', layer: 'DIMENSI', kind: 'lin', p1, p2, dl, rot, ...o });

  // ---------- dinding, bukaan, kolom ----------
  const walls = [[0, 0, 6000, 0], [0, 7500, 6000, 7500], [0, 0, 0, 7500], [6000, 0, 6000, 7500],
    [3000, 0, 3000, 6000], [3000, 3000, 6000, 3000], [3000, 6000, 6000, 6000], [4500, 6000, 4500, 7500]];
  // [kode, dinding 'h' (y tetap) / 'v' (x tetap), koordinat dinding, awal, akhir, arah buka ±1 (sumbu tegak lurus), engsel 'a' (awal) / 'b' (akhir)]
  const openings = [
    ['J1', 'h', 0, 300, 1500], ['P1', 'h', 0, 1700, 2700, 1, 'b'], ['J1', 'h', 0, 3900, 5100],
    ['J1', 'v', 0, 3900, 5100], ['J2', 'v', 0, 6450, 7050],
    ['J1', 'v', 6000, 3900, 5100],
    ['J1', 'h', 7500, 900, 2100], ['P2', 'h', 7500, 3300, 4200, -1, 'a'],
    ['P2', 'v', 3000, 1850, 2750, 1, 'b'], ['P2', 'v', 3000, 3250, 4150, 1, 'a'],
    ['P3', 'v', 4500, 6350, 7150, 1, 'a'],
  ];
  const bv = [['BV1', 'v', 6000, 6450, 7050]];
  const cols = [];
  for (const x of [0, 6000]) for (const y of AY) cols.push([x, y]);
  cols.push([3000, 0], [3000, 3000], [3000, 6000], [3000, 7500], [4500, 6000], [4500, 7500]);
  const wallR = walls.map(([x1, y1, x2, y2]) => [Math.min(x1, x2) - HT, Math.min(y1, y2) - HT, Math.max(x1, x2) + HT, Math.max(y1, y2) + HT]);
  const openR = openings.map(([, o, c, a, b]) => o === 'h' ? [a, c - HT, b, c + HT] : [c - HT, a, c + HT, b]);
  const colR = cols.map(([x, y]) => [x - HT, y - HT, x + HT, y + HT]);
  const inCol = (x, y) => colR.some(r => x > r[0] && x < r[2] && y > r[1] && y < r[3]);
  add({ type: 'hatch', layer: 'ARSIR-DINDING', pat: 'ANSI31', sc: 22, ang: 0, loops: regionLoops(wallR, openR, (x, y) => !inCol(x, y)), org: { x: 0, y: 0 } });
  regionLoops([...wallR], openR).forEach(l => add({ type: 'pline', layer: 'DINDING', closed: true, pts: l }));
  const column = (x, y) => { add({ type: 'hatch', layer: 'KOLOM', pat: 'SOLID', sc: 1, ang: 0, loops: [loop(x - HT, y - HT, x + HT, y + HT)], org: { x: 0, y: 0 }, color: 8 }); pl(box(x - HT, y - HT, x + HT, y + HT), 'KOLOM'); };
  cols.forEach(([x, y]) => column(x, y));

  // kusen: blok berorientasi pada dinding
  const putOpening = ([code, o, c, a, b, sw = 1, hinge = 'a'], layer = 'KUSEN', extra) => {
    const sx = hinge === 'a' ? 1 : -1;
    if (o === 'h') ins(code, hinge === 'a' ? a : b, c, 0, sx, sw, layer, extra);
    else ins(code, c, hinge === 'a' ? a : b, 90, sx, -sw, layer, extra);
  };
  openings.forEach(op => putOpening(op));
  bv.forEach(op => putOpening(op, 'KUSEN', { lt: 'HIDDEN2' }));
  // tag kode kusen
  const tag = (code, x, y) => { add({ type: 'circle', layer: 'TAG-KUSEN', c: { x, y }, r: 190 }); text(x, y, code, code.length > 2 ? 110 : 140, { layer: 'TAG-KUSEN' }); };
  [['J1', 900, -420], ['P1', 2200, -420], ['J1', 4500, -420], ['J1', -420, 4500], ['J2', -420, 6750], ['J1', 6420, 4500], ['BV1', 6420, 6750],
    ['J1', 1500, 7920], ['P2', 3750, 7920], ['P2', 2620, 2300], ['P2', 2620, 3700], ['P3', 4200, 6880]].forEach(t => tag(...t));

  // ---------- teras, tepi lantai, overstek ----------
  pl([[-HT, -HT], [-HT, -1575], [3075, -1575], [3075, -HT]], 'TEPI-LANTAI', false);
  pl([[-HT, -1575], [-HT, -1875], [3075, -1875], [3075, -1575]], 'TEPI-LANTAI', false);
  column(0, -1500); column(3000, -1500);
  add({ type: 'hatch', layer: 'LANTAI', pat: 'NET', sc: 300 / 3.175, ang: 0, loops: [loop(-HT, -1575, 3075, -HT), loop(-HT, -1575, HT, -1425), loop(2925, -1575, 3075, -1425)], org: { x: 0, y: 0 } });
  line(3000, 6000 + HT, 3000, 7500 - HT, 'TEPI-LANTAI', { lw: 13 });  // beda tinggi dapur / r. cuci
  pl([[-675, -2100], [3675, -2100], [3675, -675], [6675, -675], [6675, 8175], [-675, 8175]], 'ATAP');
  text(5200, -900, 'GARIS OVERSTEK ATAP', 110, { layer: 'ATAP', ha: 1 });

  // ---------- furnitur & sanitair ----------
  place('SOFA-3', [0, 0, 2100, 850], 90, 100, 450);
  place('MEJA-KOPI', [0, 0, 900, 450], 90, 1250, 1050);
  place('KASUR-160', [0, 0, 1600, 2000], 180, 3750, 100);
  place('NAKAS', [0, 0, 450, 400], 0, 3250, 100); place('NAKAS', [0, 0, 450, 400], 0, 5400, 100);
  place('LEMARI', [0, 0, 1200, 600], 90, 5325, 1725);
  place('KASUR-120', [0, 0, 1200, 2000], 0, 4400, 3925);
  place('NAKAS', [0, 0, 450, 400], 0, 3900, 5525);
  place('LEMARI', [0, 0, 1200, 600], 90, 3075, 4400);
  place('MEJA-MAKAN-4', [0, -500, 1200, 1300], 0, 900, 4200);
  pl(box(HT, 6825, 2300, 7500 - HT), 'FURNITUR');
  place('KOMPOR-2', [0, 0, 700, 450], 0, 250, 6900); place('BAK-CUCI-PIRING', [0, 0, 800, 450], 0, 1100, 6900);
  place('KULKAS', [0, 0, 650, 650], 0, 2325, 6775);
  place('MESIN-CUCI', [0, 0, 600, 550], 0, 3825, 6075);
  place('KLOSET', [-250, 0, 250, 670], 90, 5255, 6075, 'SANITAIR');
  place('SHOWER', [0, 0, 900, 900], 0, 5925 - 600, 7425 - 600, 'SANITAIR', 2 / 3);
  // keramik 20/20 area basah (kecuali perabot)
  add({ type: 'hatch', layer: 'LANTAI', pat: 'NET', sc: 200 / 3.175, ang: 0, loops: [loop(4575, 6075, 5925, 7425), loop(5255, 6075, 5925, 6575), loop(5325, 6825, 5925, 7425)], org: { x: 0, y: 0 } });
  add({ type: 'hatch', layer: 'LANTAI', pat: 'NET', sc: 200 / 3.175, ang: 0, loops: [loop(3000, 6075, 4425, 7425), loop(3825, 6075, 4425, 6625)], org: { x: 0, y: 0 } });

  // ---------- label ruang + elevasi ----------
  const elev = (x, y, s, h = 120) => {
    const k = h / 120;
    add({ type: 'hatch', layer: 'TEKS', pat: 'SOLID', sc: 1, ang: 0, loops: [[{ x: x - 75 * k, y: y + 110 * k, b: 0 }, { x: x + 75 * k, y: y + 110 * k, b: 0 }, { x, y: y - 20 * k, b: 0 }]], org: { x: 0, y: 0 } });
    line(x - 75 * k, y + 110 * k, x + 520 * k, y + 110 * k, 'TEKS', { lw: 13 });
    text(x + 110 * k, y + 130 * k, s, h, { ha: 0, va: 1 });
  };
  const room = (x, y, name, el, h = 200) => { text(x, y, name, h); elev(x - 250, y - 450, el); };
  room(2250, 1500, 'R. TAMU', '±0,00'); room(4650, 2650, 'K. TIDUR 1', '±0,00', 180); room(4950, 3650, 'K. TIDUR 2', '±0,00', 180);
  room(1250, 3700, 'R. KELUARGA / MAKAN', '±0,00', 160); room(1200, 6620, 'DAPUR', '±0,00', 180);
  text(3420, 6520, 'R. CUCI', 140); elev(3130, 6110, '−0,03', 100);
  text(4900, 7290, 'KM/WC', 130); elev(4650, 6105, '−0,03', 95);
  room(1500, -950, 'TERAS', '−0,05', 180);

  // ---------- as / grid ----------
  const BOT = -5300, TOP = 11300, LEFT = -3800, RIGHT = 9800, RB = 350;
  const bubble = (x, y, s) => { add({ type: 'circle', layer: 'AS', lt: 'Continuous', c: { x, y }, r: RB, lw: 18 }); text(x, y, s, 300, { layer: 'AS' }); };
  AX.forEach((x, i) => { line(x, BOT + RB, x, TOP - RB, 'AS', { lts: 0.5 }); bubble(x, BOT, String(i + 1)); bubble(x, TOP, String(i + 1)); });
  AY.forEach((y, i) => { line(LEFT + RB, y, RIGHT - RB, y, 'AS', { lts: 0.5 }); bubble(LEFT, y, 'ABCD'[i]); bubble(RIGHT, y, 'ABCD'[i]); });

  // ---------- dimensi 3 lapis ----------
  // ukuran kecil (< 600) ditulis di sisi seberang garis ukur agar tidak berhimpit dengan angka di sebelahnya
  const chainX = (xs, defY, dimY) => { for (let i = 0; i < xs.length - 1; i++) { const a = xs[i], b = xs[i + 1]; D({ x: a, y: defY }, { x: b, y: defY }, { x: 0, y: dimY }, 0, b - a < 600 ? { tp: { x: (a + b) / 2, y: dimY - 280 } } : {}); } };
  const chainY = (ys, defX, dimX) => { for (let i = 0; i < ys.length - 1; i++) { const a = ys[i], b = ys[i + 1]; D({ x: defX, y: a }, { x: defX, y: b }, { x: dimX, y: 0 }, Math.PI / 2, b - a < 600 ? { tp: { x: dimX + 280, y: (a + b) / 2 } } : {}); } };
  const opPts = (o, c, axes) => { const ed = openings.concat(bv).filter(op => op[1] === o && op[2] === c).flatMap(op => [op[3], op[4]]); const inside = v => openings.concat(bv).some(op => op[1] === o && op[2] === c && v > op[3] && v < op[4]); return [...new Set([...axes.filter(v => !inside(v)), ...ed])].sort((a, b) => a - b); };
  chainX(opPts('h', 0, AX), -2200, -3100); chainX(AX, -2200, -3800); chainX([0, 6000], -2200, -4500);
  chainX(opPts('h', 7500, AX), 8250, 9100); chainX(AX, 8250, 9800); chainX([0, 6000], 8250, 10500);
  chainY(opPts('v', 0, AY), -750, -1600); chainY(AY, -750, -2300); chainY([0, 7500], -750, -3000);
  chainY(opPts('v', 6000, AY), 6750, 7600); chainY(AY, 6750, 8300); chainY([0, 7500], 6750, 9000);

  // ---------- tanda potongan ----------
  const cut = (x1, y1, x2, y2, vx, vy, s) => {
    line(x1, y1, x2, y2, 'POTONGAN');
    const ux = Math.sign(x2 - x1), uy = Math.sign(y2 - y1);
    add({ type: 'hatch', layer: 'POTONGAN', pat: 'SOLID', sc: 1, ang: 0, loops: [[{ x: x1, y: y1, b: 0 }, { x: x1 + ux * 260, y: y1 + uy * 260, b: 0 }, { x: x1 + vx * 260, y: y1 + vy * 260, b: 0 }]], org: { x: 0, y: 0 } });
    text(x1 + vx * 300 + ux * 140, y1 + vy * 300 + uy * 140, s, 260, { layer: 'POTONGAN', va: 2 });
  };
  cut(-1250, 4500, -750, 4500, 0, 1, 'A'); cut(7250, 4500, 6750, 4500, 0, 1, 'A');
  cut(1300, -2850, 1300, -2350, -1, 0, 'B'); cut(1300, 8800, 1300, 8300, -1, 0, 'B');

  // ---------- judul, arah utara ----------
  text(3000, -6400, 'DENAH LANTAI 1', 420);
  line(800, -6720, 5200, -6720, 'TEKS', { lw: 50 }); line(800, -6780, 5200, -6780, 'TEKS', { lw: 13 });
  text(3000, -7100, 'SKALA 1 : 100', 220);
  ins('ARAH-UTARA', 8600, -6300, 0, 1, 1, 'TEKS');

  // ---------- tabel luas ruang, legenda, catatan ----------
  const TX = 11000, TW = [700, 3200, 1500, 1300];
  let ty = 10600;
  text(TX, ty, 'TABEL LUAS RUANG', 260, { ha: 0 }); ty -= 350;
  const rows = [['NO', 'RUANG', 'UKURAN (m)', 'LUAS (m²)'], ['1', 'Ruang Tamu', '3,00 × 3,00', '9,00'], ['2', 'Kamar Tidur 1', '3,00 × 3,00', '9,00'], ['3', 'Kamar Tidur 2', '3,00 × 3,00', '9,00'],
    ['4', 'Ruang Keluarga / Makan', '3,00 × 3,00', '9,00'], ['5', 'Dapur', '3,00 × 1,50', '4,50'], ['6', 'Ruang Cuci', '1,50 × 1,50', '2,25'], ['7', 'KM / WC', '1,50 × 1,50', '2,25'],
    ['', 'LUAS BANGUNAN (as–as)', '6,00 × 7,50', '45,00'], ['', 'Teras (di luar luas)', '3,00 × 1,50', '4,50']];
  const RH = 420, TWsum = TW.reduce((a, b) => a + b, 0);
  rows.forEach((r, i) => {
    const y0 = ty - i * RH; let x = TX;
    if (i === 0 || i === 8) line(TX, y0, TX + TWsum, y0, 'TABEL', { lw: 35 });
    r.forEach((s, k) => { text(k === 1 ? x + 120 : x + TW[k] / 2, y0 - RH / 2, s, i === 0 ? 150 : 160, { layer: 'TABEL', ha: k === 1 ? 0 : 1 }); x += TW[k]; });
    line(TX, y0 - RH, TX + TWsum, y0 - RH, 'TABEL', { lw: i === 0 ? 35 : 13 });
  });
  const tb = ty - rows.length * RH;
  line(TX, ty, TX, tb, 'TABEL', { lw: 35 }); line(TX + TWsum, ty, TX + TWsum, tb, 'TABEL', { lw: 35 });
  let cx = TX; TW.slice(0, -1).forEach(w => { cx += w; line(cx, ty, cx, tb, 'TABEL'); });

  let ly = tb - 800;
  text(TX, ly, 'LEGENDA', 260, { ha: 0 }); ly -= 550;
  const leg = (draw, s) => { draw(TX, ly - 150); text(TX + 900, ly, s, 160, { ha: 0 }); ly -= 500; };
  leg((x, y) => { add({ type: 'hatch', layer: 'ARSIR-DINDING', pat: 'ANSI31', sc: 22, ang: 0, loops: [loop(x, y, x + 700, y + 300)], org: { x: 0, y: 0 } }); pl(box(x, y, x + 700, y + 300), 'DINDING'); }, 'Pasangan 1/2 bata, plester + aci, t = 15 cm');
  leg((x, y) => { add({ type: 'hatch', layer: 'KOLOM', pat: 'SOLID', sc: 1, ang: 0, loops: [loop(x + 200, y, x + 500, y + 300)], org: { x: 0, y: 0 }, color: 8 }); pl(box(x + 200, y, x + 500, y + 300), 'KOLOM'); }, 'Kolom praktis beton bertulang 15/15');
  leg((x, y) => { add({ type: 'hatch', layer: 'LANTAI', pat: 'NET', sc: 100 / 3.175, ang: 0, loops: [loop(x, y, x + 700, y + 300)], org: { x, y } }); pl(box(x, y, x + 700, y + 300), 'TEPI-LANTAI'); }, 'Lantai keramik 20/20 (KM, r. cuci), 30/30 (teras)');
  leg((x, y) => { line(x, y + 150, x + 700, y + 150, 'ATAP'); }, 'Garis overstek atap (lebar 60 cm)');
  leg((x, y) => { add({ type: 'circle', layer: 'TAG-KUSEN', c: { x: x + 350, y: y + 150 }, r: 190 }); text(x + 350, y + 150, 'P1', 140, { layer: 'TAG-KUSEN' }); }, 'Kode kusen — lihat lembar A-02');
  leg((x, y) => { elev(x + 200, y + 50, '±0,00'); }, 'Peil lantai (±0,00 = lantai r. tamu)');

  ly -= 250;
  text(TX, ly, 'CATATAN', 260, { ha: 0 }); ly -= 450;
  ['1. Semua ukuran dalam milimeter (mm), elevasi dalam meter.', '2. Ukuran diukur dari as ke as dinding kecuali dinyatakan lain.', '3. Lantai r. dalam keramik 40/40, area basah turun 3 cm.',
    '4. Kusen kayu kamper 6/15 dicat duco; KM kusen aluminium.', '5. Tinggi ambang atas pintu & jendela +2,10; bovenlicht s/d +2,56.', '6. Cek ulang ukuran di lapangan sebelum pelaksanaan.']
    .forEach(s => { text(TX, ly, s, 150, { ha: 0 }); ly -= 330; });

  // ================= A-02: DETAIL KUSEN (skala 1:50) =================
  const OX = 26000, DS = { scale: 50 };
  const Dd = (p1, p2, dl, rot = 0) => D(p1, p2, dl, rot, { ds: DS });
  const glass = (x1, y1, x2, y2) => { const w = x2 - x1, h = y2 - y1, s = Math.min(w, h) * 0.18; [[0.3, 0.55], [0.42, 0.67], [0.54, 0.79]].forEach(([a, b]) => line(x1 + w * a, y1 + h * b, x1 + w * a + s, y1 + h * b + s, 'LANTAI')); };
  const swing = (x1, y1, x2, y2, hingeLeft) => { const hx = hingeLeft ? x1 : x2, fx = hingeLeft ? x2 : x1, my = (y1 + y2) / 2; line(fx, y1, hx, my, 'KUSEN', { lt: 'HIDDEN2', lw: 9 }); line(fx, y2, hx, my, 'KUSEN', { lt: 'HIDDEN2', lw: 9 }); };
  const KUSEN = [
    { code: 'P1', W: 1000, type: 'door', bv: true, n: 1, t1: 'PINTU UTAMA', t2: 'Daun panel kayu, BV kaca 5 mm', q: 1 },
    { code: 'P2', W: 900, type: 'door', bv: true, n: 1, t1: 'PINTU KAMAR / BELAKANG', t2: 'Daun panel kayu, BV kaca 5 mm', q: 3 },
    { code: 'P3', W: 800, type: 'door', bv: false, n: 1, t1: 'PINTU KM', t2: 'Daun PVC, kusen aluminium', q: 1 },
    { code: 'J1', W: 1200, type: 'win', n: 2, t1: 'JENDELA 2 DAUN', t2: 'Daun kaca 5 mm, BV kaca 5 mm', q: 6 },
    { code: 'J2', W: 600, type: 'win', n: 1, t1: 'JENDELA 1 DAUN', t2: 'Daun kaca 5 mm, BV kaca 5 mm', q: 1 },
    { code: 'BV1', W: 600, type: 'bv', n: 1, t1: 'BOVENLICHT KM', t2: 'Kaca jalusi (nako) 5 mm', q: 1 },
  ];
  let kx = OX;
  for (const k of KUSEN) {
    const W = k.W, x0 = kx, x1 = x0 + W;
    const sill = k.type === 'win' ? 900 : k.type === 'bv' ? 1800 : 0;
    const top = k.type === 'bv' ? 2260 : k.bv || k.type === 'win' ? 2560 : 2160;
    const tr = k.type === 'bv' ? null : 2100;
    line(x0 - 350, 0, x1 + 350, 0, 'DINDING');
    add({ type: 'hatch', layer: 'ARSIR-DINDING', pat: 'EARTH', sc: 6, ang: 0, loops: [loop(x0 - 350, -120, x1 + 350, 0)], org: { x: 0, y: 0 } });
    pl(box(x0, sill, x1, top), 'KUSEN', true, { lw: 35 });
    // ambang atas, ambang tengah (transom), ambang bawah, tiang
    pl(box(x0 + 60, top - 60, x1 - 60, top), 'KUSEN');
    if (tr && tr < top - 60) pl(box(x0 + 60, tr, x1 - 60, tr + 60), 'KUSEN');
    if (sill > 0) pl(box(x0 + 60, sill, x1 - 60, sill + 60), 'KUSEN');
    line(x0 + 60, sill + (sill > 0 ? 60 : 0), x0 + 60, top - 60, 'KUSEN'); line(x1 - 60, sill + (sill > 0 ? 60 : 0), x1 - 60, top - 60, 'KUSEN');
    if (tr && tr + 60 < top - 60) { // bovenlicht kaca
      const b1 = tr + 60, b2 = top - 60; pl(box(x0 + 90, b1 + 30, x1 - 90, b2 - 30), 'KUSEN', true, { lw: 13 }); glass(x0 + 90, b1 + 30, x1 - 90, b2 - 30);
    }
    if (k.type === 'door') {
      const d1 = x0 + 63, d2 = x1 - 63, y1 = 10, y2 = tr - 3;
      pl(box(d1, y1, d2, y2), 'KUSEN', true, { lw: 18 });
      if (k.code === 'P3') { for (let y = 250; y < 650; y += 60) line(d1 + 100, y, d2 - 100, y, 'KUSEN', { lw: 9 }); pl(box(d1 + 100, 200, d2 - 100, 700), 'KUSEN', true, { lw: 9 }); }
      else { pl(box(d1 + 120, 150, d2 - 120, 950), 'KUSEN', true, { lw: 13 }); pl(box(d1 + 120, 1100, d2 - 120, y2 - 150), 'KUSEN', true, { lw: 13 }); }
      add({ type: 'circle', layer: 'KUSEN', c: { x: d2 - 90, y: 1000 }, r: 25, lw: 13 }); line(d2 - 90, 1000, d2 - 210, 1000, 'KUSEN', { lw: 18 });
      swing(d1, y1, d2, y2, true);
    } else if (k.type === 'win') {
      const dw = (W - 120) / k.n, y1 = sill + 60, y2 = tr;
      for (let i = 0; i < k.n; i++) {
        const a = x0 + 60 + i * dw + 3, b = a + dw - 6;
        pl(box(a, y1 + 3, b, y2 - 3), 'KUSEN', true, { lw: 18 }); pl(box(a + 60, y1 + 63, b - 60, y2 - 63), 'KUSEN', true, { lw: 13 }); glass(a + 60, y1 + 63, b - 60, y2 - 63);
        swing(a, y1 + 3, b, y2 - 3, k.n === 1 || i === 0);
      }
    } else {
      for (let y = sill + 120; y < top - 80; y += 70) line(x0 + 80, y, x1 - 80, y, 'KUSEN', { lw: 9 });
    }
    // dimensi: lebar (atas) dan tinggi (kiri)
    Dd({ x: x0, y: top + 80 }, { x: x1, y: top + 80 }, { x: 0, y: top + 400 });
    const hs = [0, ...(sill ? [sill] : []), ...(tr ? [tr] : []), top].filter((v, i, a) => a.indexOf(v) === i);
    for (let i = 0; i < hs.length - 1; i++) Dd({ x: x0 - 80, y: hs[i] }, { x: x0 - 80, y: hs[i + 1] }, { x: x0 - 450, y: 0 }, Math.PI / 2);
    text(x1 + 380, 40, '±0,00', 90, { ha: 0, va: 1 });
    // judul elemen
    add({ type: 'circle', layer: 'TAG-KUSEN', c: { x: (x0 + x1) / 2, y: -520 }, r: 230 });
    text((x0 + x1) / 2, -520, k.code, k.code.length > 2 ? 140 : 170, { layer: 'TAG-KUSEN' });
    text((x0 + x1) / 2, -950, k.t1, 115);
    text((x0 + x1) / 2, -1130, `${k.W} × ${top - sill} · ${k.q} unit`, 95);
    kx = x1 + 1450;
  }
  const DX2 = kx - 1450;
  text((OX + DX2) / 2, 4050, 'DETAIL KUSEN PINTU & JENDELA', 260);
  line((OX + DX2) / 2 - 2200, 3850, (OX + DX2) / 2 + 2200, 3850, 'TEKS', { lw: 35 });
  text((OX + DX2) / 2, 3630, 'TAMPAK DARI LUAR · SKALA 1 : 50', 130);

  // tabel kusen
  const KW = [650, 2200, 1500, 4900, 2700, 750], KWs = KW.reduce((a, b) => a + b, 0);
  let ky = -1600; const KH = 300;
  const kx0 = OX - 450;
  text(kx0, ky, 'DAFTAR KUSEN', 170, { ha: 0 }); ky -= 220;
  const loc = { P1: 'R. tamu (depan)', P2: 'K. tidur 1, 2; r. cuci', P3: 'KM / WC', J1: 'R. tamu, KT 1, KT 2, keluarga, dapur', J2: 'Dapur (samping)', BV1: 'KM / WC' };
  const mat = { P1: 'Kusen kamper 6/15, daun panel kayu t=35, cat duco', P2: 'Kusen kamper 6/15, daun panel kayu t=35, cat duco', P3: 'Kusen aluminium 4", daun PVC, kunci tanam', J1: 'Kusen kamper 6/15, daun kayu 3/10, kaca 5 mm', J2: 'Kusen kamper 6/15, daun kayu 3/10, kaca 5 mm', BV1: 'Kusen kamper 6/15, kaca nako 5 mm + teralis' };
  const kRows = [['KODE', 'JENIS', 'UKURAN (L × T)', 'BAHAN / FINISHING', 'LOKASI', 'JML'], ...KUSEN.map(k => { const s = k.type === 'win' ? 900 : k.type === 'bv' ? 1800 : 0, t = k.type === 'bv' ? 2260 : k.bv || k.type === 'win' ? 2560 : 2160; return [k.code, k.t1.toLowerCase().replace(/^\w/, c => c.toUpperCase()), `${k.W} × ${t - s}`, mat[k.code], loc[k.code], String(k.q)]; })];
  kRows.forEach((r, i) => {
    const y0 = ky - i * KH; let x = kx0;
    if (i === 0) line(kx0, y0, kx0 + KWs, y0, 'TABEL', { lw: 35 });
    r.forEach((s, j) => { const c = j === 0 || j === 2 || j === 5; text(c ? x + KW[j] / 2 : x + 80, y0 - KH / 2, s, i === 0 ? 85 : 90, { layer: 'TABEL', ha: c ? 1 : 0 }); x += KW[j]; });
    line(kx0, y0 - KH, kx0 + KWs, y0 - KH, 'TABEL', { lw: i === 0 || i === kRows.length - 1 ? 35 : 13 });
  });
  const kb = ky - kRows.length * KH;
  line(kx0, ky, kx0, kb, 'TABEL', { lw: 35 }); line(kx0 + KWs, ky, kx0 + KWs, kb, 'TABEL', { lw: 35 });
  let kxx = kx0; KW.slice(0, -1).forEach(w => { kxx += w; line(kxx, ky, kxx, kb, 'TABEL'); });

  E.forEach(e => doc.prep(e));
  doc.model.push(...E);

  const Ly = doc.layouts[0];
  Ly.name = 'A-01 Denah'; Ly.paper = 'A3'; Ly.orient = 'L';
  Ly.tb = { ...Ly.tb, project: 'RUMAH TINGGAL TIPE 45', location: 'Jl. Contoh No. 1, Indonesia', title: 'DENAH LANTAI 1', drawn: 'Amatu', checked: '-', approved: '-', no: 'A-01', sheet: '1 / 2', notes: 'Ukuran dalam mm, elevasi dalam m. Peil ±0,00 = lantai r. tamu. Baca bersama gambar A-02.' };
  Ly.vp = { s: 1 / 100, cx: 6500, cy: 2100, lock: true };
  const L2 = doc.layouts[1];
  L2.name = 'A-02 Detail Kusen'; L2.paper = 'A3'; L2.orient = 'L';
  L2.tb = { ...L2.tb, project: 'RUMAH TINGGAL TIPE 45', location: 'Jl. Contoh No. 1, Indonesia', title: 'DETAIL KUSEN\nPINTU & JENDELA', drawn: 'Amatu', checked: '-', approved: '-', no: 'A-02', sheet: '2 / 2', notes: 'Ukuran kusen = ukuran luar. Ukuran daun disesuaikan di lapangan. Kayu kamper kering oven.' };
  L2.vp = { s: 1 / 50, cx: (OX - 900 + Math.max(DX2, kx0 + KWs)) / 2, cy: (4250 + kb) / 2, lock: true };
  doc.clayer = 'DINDING';
}
