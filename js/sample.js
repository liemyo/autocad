// Contoh gambar: denah rumah tipe 45 (mm) lengkap dengan as, dinding, kusen, furnitur, dimensi, hatch & label ruang.
import { LIBRARY } from './library.js';

export function buildSample(doc) {
  const L = (n, c, o = {}) => doc.addLayer(n, { color: c, ...o });
  L('AS', 1, { lt: 'CENTER', lw: 13 }); L('DINDING', 7, { lw: 50 }); L('KOLOM', 7, { lw: 35 }); L('KUSEN', 4, { lw: 25 }); L('FURNITUR', 8, { lw: 13 });
  L('HATCH', 252, { lw: 9 }); L('DIMENSI', 2, { lw: 13 }); L('TEKS', 7, { lw: 18 }); L('LANTAI', 9, { lw: 9 });
  ['CENTER', 'DASHED', 'HIDDEN'].forEach(t => { if (!doc.ltypes.includes(t)) doc.ltypes.push(t); });
  for (const n of ['PINTU-90', 'PINTU-80', 'PINTU-70', 'JENDELA-120', 'JENDELA-60', 'KLOSET', 'WASTAFEL', 'KASUR-160', 'KASUR-90', 'SOFA-3', 'MEJA-MAKAN-4', 'KOLOM-30', 'ARAH-UTARA', 'POHON', 'MOBIL', 'LEMARI', 'SHOWER']) doc.blocks[n] = JSON.parse(JSON.stringify(LIBRARY[n]));
  doc.set.ltscale = 50; doc.dim = { ...doc.dim, scale: 100, dec: 0, arrow: 'tick', sep: ',' }; doc.dimRev++;
  doc.set.textH = 250;
  const E = [], add = e => { E.push({ color: 256, lt: 'ByLayer', lw: -1, ...e }); };
  const t = 150, W = 9000, H = 7500; // as dinding
  const ax = [0, 3000, 6000, 9000], ay = [0, 3500, 7500];
  // as
  ax.forEach((x, i) => { add({ type: 'line', layer: 'AS', p1: { x, y: -1800 }, p2: { x, y: H + 1500 } }); add({ type: 'circle', layer: 'AS', lt: 'Continuous', c: { x, y: H + 1900 }, r: 400 }); add({ type: 'text', layer: 'TEKS', p: { x, y: H + 1900 }, s: String(i + 1), h: 350, ha: 1, va: 2 }); });
  ay.forEach((y, i) => { add({ type: 'line', layer: 'AS', p1: { x: -1800, y }, p2: { x: W + 1500, y } }); add({ type: 'circle', layer: 'AS', lt: 'Continuous', c: { x: -2200, y }, r: 400 }); add({ type: 'text', layer: 'TEKS', p: { x: -2200, y }, s: 'ABC'[i], h: 350, ha: 1, va: 2 }); });
  // dinding luar (2 garis) & hatch
  const rect = (x1, y1, x2, y2) => [{ x: x1, y: y1, b: 0 }, { x: x2, y: y1, b: 0 }, { x: x2, y: y2, b: 0 }, { x: x1, y: y2, b: 0 }];
  const outer = rect(-t / 2, -t / 2, W + t / 2, H + t / 2), inner = rect(t / 2, t / 2, W - t / 2, H - t / 2);
  add({ type: 'pline', layer: 'DINDING', pts: outer, closed: true });
  // dinding dalam sebagai persegi tipis
  const walls = [[3000 - t / 2, t / 2, 3000 + t / 2, H - t / 2], [6000 - t / 2, t / 2, 6000 + t / 2, 3500 - t / 2], [t / 2, 3500 - t / 2, 3000 - t / 2, 3500 + t / 2], [6000 + t / 2, 3500 - t / 2, W - t / 2, 3500 + t / 2], [7500 - t / 2, t / 2, 7500 + t / 2, 3500 - t / 2]];
  const loops = [outer, inner];
  add({ type: 'hatch', layer: 'HATCH', pat: 'ANSI31', sc: 12, ang: 0, loops: loops.map(l => l.map(p => ({ ...p }))), org: { x: 0, y: 0 } });
  add({ type: 'pline', layer: 'DINDING', pts: inner, closed: true });
  walls.forEach(([x1, y1, x2, y2]) => { const r = rect(x1, y1, x2, y2); add({ type: 'hatch', layer: 'HATCH', pat: 'ANSI31', sc: 12, ang: 0, loops: [r], org: { x: 0, y: 0 } }); add({ type: 'pline', layer: 'DINDING', pts: r, closed: true }); });
  // kolom
  for (const x of ax) for (const y of ay) add({ type: 'insert', layer: 'KOLOM', name: 'KOLOM-30', p: { x, y }, sx: 1, sy: 1, rot: 0 });
  // pintu & jendela
  const ins = (name, x, y, rot = 0, sx = 1, layer = 'KUSEN') => add({ type: 'insert', layer, name, p: { x, y }, sx, sy: sx, rot: rot * Math.PI / 180 });
  ins('PINTU-90', 1200, H - t / 2 + 0, 270); ins('PINTU-80', 3000 - t / 2, 4200, 0); ins('PINTU-80', 3000 + t / 2, 2200, 180, -1);
  ins('PINTU-80', 6000 - t / 2, 1200, 0); ins('PINTU-70', 7500 - t / 2, 1700, 0); ins('PINTU-90', 4300, -t / 2, 90);
  ins('JENDELA-120', 600, H - t / 2, 0); ins('JENDELA-120', 3900, H - t / 2, 0); ins('JENDELA-120', 7200, H - t / 2, 0);
  ins('JENDELA-120', t / 2, 1200, 90, 1); ins('JENDELA-120', W + t / 2, 4800, 90, 1); ins('JENDELA-60', 8000, -t / 2, 0); ins('JENDELA-120', 1000, -t / 2, 0);
  // furnitur
  ins('KASUR-160', 700, 600, 0, 1, 'FURNITUR'); ins('LEMARI', 1700, 2800, 0, 1, 'FURNITUR');
  ins('KASUR-90', 6400, 1100, 0, 1, 'FURNITUR'); ins('SOFA-3', 3600, 6400, 0, 1, 'FURNITUR'); ins('MEJA-MAKAN-4', 6900, 5500, 0, 1, 'FURNITUR');
  ins('KLOSET', 8250, 3200, 180, 1, 'FURNITUR'); ins('WASTAFEL', 8800, 900, 90, 1, 'FURNITUR'); ins('SHOWER', 7600, 100, 0, 0.9, 'FURNITUR');
  ins('ARAH-UTARA', W + 2600, H + 600, 0, 1, 'TEKS'); ins('POHON', -3200, -2600, 0, 1, 'FURNITUR'); ins('MOBIL', 2200, -6200, 0, 1, 'FURNITUR');
  // label ruang
  const room = (x, y, n, a, hh = 250) => { add({ type: 'text', layer: 'TEKS', p: { x, y: y + 160 }, s: n, h: hh, ha: 1, va: 2 }); if (a) add({ type: 'text', layer: 'TEKS', p: { x, y: y - 220 }, s: a, h: hh * 0.72, ha: 1, va: 2 }); };
  room(1500, 1900, 'K. TIDUR UTAMA', '3,00 × 3,50 m²'); room(1500, 5500, 'R. TAMU', '3,00 × 4,00 m²'); room(4500, 5000, 'R. KELUARGA', '3,00 × 7,50 m²');
  room(6750, 2700, 'K. TIDUR 2', '1,50 × 3,50', 170); room(8250, 2700, 'KM/WC', '', 170); room(7500, 4700, 'R. MAKAN & DAPUR', '3,00 × 4,00 m²');
  add({ type: 'hatch', layer: 'LANTAI', pat: 'NET', sc: 100, ang: 0, loops: [rect(7500 + t / 2, t / 2, W - t / 2, 3500 - t / 2)], org: { x: 0, y: 0 } });
  // dimensi
  const D = (p1, p2, dl, rot = 0) => add({ type: 'dim', layer: 'DIMENSI', kind: 'lin', p1, p2, dl, rot });
  for (let i = 0; i < ax.length - 1; i++) D({ x: ax[i], y: H }, { x: ax[i + 1], y: H }, { x: 0, y: H + 900 });
  D({ x: 0, y: H }, { x: W, y: H }, { x: 0, y: H + 1250 });
  for (let i = 0; i < ay.length - 1; i++) D({ x: 0, y: ay[i] }, { x: 0, y: ay[i + 1] }, { x: -1000, y: 0 }, Math.PI / 2);
  D({ x: 0, y: 0 }, { x: 0, y: H }, { x: -1350, y: 0 }, Math.PI / 2);
  D({ x: 6000, y: 0 }, { x: 7500, y: 0 }, { x: 0, y: -900 }); D({ x: 7500, y: 0 }, { x: 9000, y: 0 }, { x: 0, y: -900 });
  // judul
  add({ type: 'text', layer: 'TEKS', p: { x: W / 2, y: -2600 }, s: 'DENAH LANTAI 1', h: 450, ha: 1, va: 2 });
  add({ type: 'text', layer: 'TEKS', p: { x: W / 2, y: -3150 }, s: 'SKALA 1 : 100', h: 250, ha: 1, va: 2 });
  add({ type: 'line', layer: 'TEKS', p1: { x: W / 2 - 2200, y: -2870 }, p2: { x: W / 2 + 2200, y: -2870 }, lw: 35 });
  add({ type: 'leader', layer: 'DIMENSI', pts: [{ x: 9075, y: 6300 }, { x: 10000, y: 6900 }, { x: 10300, y: 6900 }], s: 'Dinding bata ringan t=15 cm\nplester + aci, cat', h: 200 });
  E.forEach(e => doc.prep(e));
  doc.model.push(...E);
  const Ly = doc.layouts[0];
  Ly.name = 'A-01 Denah'; Ly.tb = { ...Ly.tb, project: 'RUMAH TINGGAL TIPE 45', location: 'Jl. Contoh No. 1, Indonesia', title: 'DENAH LANTAI 1', drawn: 'Amatu', checked: '-', approved: '-', no: 'A-01', sheet: '1 / 2' };
  Ly.vp = null;
  const L2 = doc.layouts[1]; L2.name = 'A-02 Detail'; L2.paper = 'A3'; L2.tb = { ...L2.tb, project: 'RUMAH TINGGAL TIPE 45', title: 'DETAIL KAMAR MANDI', no: 'A-02', sheet: '2 / 2' };
  L2.vp = { s: 1 / 25, cx: 8250, cy: 1750, lock: false };
  doc.clayer = 'DINDING';
}
