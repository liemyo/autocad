// Pustaka blok bawaan (satuan mm): pintu, jendela, sanitair, furnitur, simbol gambar kerja.
const L = (x1, y1, x2, y2, o = {}) => ({ type: 'line', p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, layer: '0', color: 0, lt: 'ByBlock', lw: -2, ...o });
const R = (x, y, w, h, o = {}) => ({ type: 'pline', pts: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }].map(p => ({ ...p, b: 0 })), closed: true, layer: '0', color: 0, lt: 'ByBlock', lw: -2, ...o });
const RR = (x, y, w, h, r, o = {}) => { const k = Math.tan(Math.PI / 8); return { type: 'pline', closed: true, layer: '0', color: 0, lt: 'ByBlock', lw: -2, pts: [{ x: x + r, y, b: 0 }, { x: x + w - r, y, b: k }, { x: x + w, y: y + r, b: 0 }, { x: x + w, y: y + h - r, b: k }, { x: x + w - r, y: y + h, b: 0 }, { x: x + r, y: y + h, b: k }, { x, y: y + h - r, b: 0 }, { x, y: y + r, b: k }], ...o }; };
const C = (x, y, r, o = {}) => ({ type: 'circle', c: { x, y }, r, layer: '0', color: 0, lt: 'ByBlock', lw: -2, ...o });
const A = (x, y, r, sa, ea, o = {}) => ({ type: 'arc', c: { x, y }, r, sa: sa * Math.PI / 180, ea: ea * Math.PI / 180, layer: '0', color: 0, lt: 'ByBlock', lw: -2, ...o });
const E = (x, y, rx, ry, o = {}) => ({ type: 'ellipse', c: { x, y }, u: rx >= ry ? { x: rx, y: 0 } : { x: 0, y: ry }, k: rx >= ry ? ry / rx : rx / ry, layer: '0', color: 0, lt: 'ByBlock', lw: -2, ...o });
const T = (x, y, s, h, o = {}) => ({ type: 'text', p: { x, y }, s, h, ha: 1, va: 2, rot: 0, layer: '0', color: 0, lt: 'ByBlock', lw: -2, ...o });
const H = (loops, pat = 'SOLID', o = {}) => ({ type: 'hatch', pat, sc: 1, ang: 0, loops, layer: '0', color: 0, lt: 'ByBlock', lw: -2, ...o });
const door = w => ({ base: { x: 0, y: 0 }, desc: `Pintu ayun ${w} mm`, cat: 'Pintu & Jendela', ents: [R(0, 0, 40, w), A(0, 0, w, 0, 90), L(0, 0, 0, -60), L(w, 0, w, -60)] });
let id = 1; const withIds = b => { b.ents.forEach(e => e.id = id++); b.rev = 1; return b; };
export const LIBRARY = {
  'PINTU-90': door(900), 'PINTU-80': door(800), 'PINTU-70': door(700),
  'PINTU-GANDA-150': { base: { x: 0, y: 0 }, desc: 'Pintu ganda 1500 mm', cat: 'Pintu & Jendela', ents: [R(0, 0, 40, 750), A(0, 0, 750, 0, 90), R(1460, 0, 40, 750), A(1500, 0, 750, 90, 180)] },
  'JENDELA-120': { base: { x: 0, y: 0 }, desc: 'Jendela 1200 di dinding 150', cat: 'Pintu & Jendela', ents: [R(0, 0, 1200, 150), L(0, 60, 1200, 60), L(0, 90, 1200, 90), L(600, 60, 600, 90)] },
  'JENDELA-60': { base: { x: 0, y: 0 }, desc: 'Jendela 600 di dinding 150', cat: 'Pintu & Jendela', ents: [R(0, 0, 600, 150), L(0, 75, 600, 75)] },
  'KLOSET': { base: { x: 0, y: 0 }, desc: 'Kloset duduk', cat: 'Sanitair', ents: [RR(-250, 0, 500, 180, 40), E(0, 420, 190, 250), E(0, 410, 140, 190)] },
  'WASTAFEL': { base: { x: 0, y: 0 }, desc: 'Wastafel 600×450', cat: 'Sanitair', ents: [RR(-300, 0, 600, 450, 50), E(0, 240, 230, 160), C(0, 240, 20)] },
  'SHOWER': { base: { x: 0, y: 0 }, desc: 'Area shower 900×900', cat: 'Sanitair', ents: [R(0, 0, 900, 900), L(0, 0, 900, 900), L(900, 0, 0, 900), C(450, 450, 35)] },
  'KASUR-160': { base: { x: 0, y: 0 }, desc: 'Kasur queen 1600×2000', cat: 'Furnitur', ents: [R(0, 0, 1600, 2000), RR(100, 1650, 650, 280, 60), RR(850, 1650, 650, 280, 60), L(0, 1400, 1600, 1400), L(0, 1400, 300, 1150)] },
  'KASUR-90': { base: { x: 0, y: 0 }, desc: 'Kasur single 900×2000', cat: 'Furnitur', ents: [R(0, 0, 900, 2000), RR(150, 1650, 600, 280, 60), L(0, 1400, 900, 1400)] },
  'KASUR-120': { base: { x: 0, y: 0 }, desc: 'Kasur 1200×2000', cat: 'Furnitur', ents: [R(0, 0, 1200, 2000), RR(120, 1650, 450, 280, 60), RR(630, 1650, 450, 280, 60), L(0, 1400, 1200, 1400), L(0, 1400, 260, 1160)] },
  'NAKAS': { base: { x: 0, y: 0 }, desc: 'Nakas 450×400', cat: 'Furnitur', ents: [R(0, 0, 450, 400), C(225, 200, 90)] },
  'MEJA-KOPI': { base: { x: 0, y: 0 }, desc: 'Meja tamu 900×450', cat: 'Furnitur', ents: [R(0, 0, 900, 450), R(40, 40, 820, 370)] },
  'KOMPOR-2': { base: { x: 0, y: 0 }, desc: 'Kompor 2 tungku 700×450', cat: 'Dapur', ents: [RR(0, 0, 700, 450, 30), C(180, 225, 120), C(180, 225, 60), C(520, 225, 120), C(520, 225, 60)] },
  'BAK-CUCI-PIRING': { base: { x: 0, y: 0 }, desc: 'Bak cuci piring 800×450', cat: 'Dapur', ents: [RR(0, 0, 800, 450, 30), RR(60, 60, 460, 330, 50), C(290, 225, 30), L(580, 90, 740, 90), L(580, 150, 740, 150), L(580, 210, 740, 210), L(580, 270, 740, 270), C(560, 410, 25)] },
  'KULKAS': { base: { x: 0, y: 0 }, desc: 'Kulkas 650×650', cat: 'Dapur', ents: [R(0, 0, 650, 650), R(30, 30, 590, 520), L(0, 0, 650, 650), L(650, 0, 0, 650)] },
  'MESIN-CUCI': { base: { x: 0, y: 0 }, desc: 'Mesin cuci 600×550', cat: 'Sanitair', ents: [R(0, 0, 600, 550), L(0, 460, 600, 460), C(300, 225, 190), C(300, 225, 140)] },
  'MEJA-MAKAN-4': { base: { x: 0, y: 0 }, desc: 'Meja makan 4 kursi', cat: 'Furnitur', ents: [R(0, 0, 1200, 800), RR(150, -500, 400, 400, 40), RR(650, -500, 400, 400, 40), RR(150, 900, 400, 400, 40), RR(650, 900, 400, 400, 40)] },
  'SOFA-3': { base: { x: 0, y: 0 }, desc: 'Sofa 3 dudukan', cat: 'Furnitur', ents: [RR(0, 0, 2100, 850, 80), R(150, 0, 1800, 650), L(750, 0, 750, 650), L(1350, 0, 1350, 650)] },
  'LEMARI': { base: { x: 0, y: 0 }, desc: 'Lemari 1200×600', cat: 'Furnitur', ents: [R(0, 0, 1200, 600), L(600, 0, 600, 600), L(0, 0, 1200, 600)] },
  'MOBIL': { base: { x: 0, y: 0 }, desc: 'Mobil (tampak atas)', cat: 'Lansekap', ents: [RR(0, 0, 4500, 1800, 350), RR(1300, 150, 1800, 1500, 200), L(1300, 150, 1000, 300), L(1300, 1650, 1000, 1500), L(3100, 150, 3400, 350), L(3100, 1650, 3400, 1450)] },
  'POHON': { base: { x: 0, y: 0 }, desc: 'Pohon Ø3000', cat: 'Lansekap', ents: [C(0, 0, 1500), C(0, 0, 120), ...Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return L(Math.cos(a) * 200, Math.sin(a) * 200, Math.cos(a) * 1300, Math.sin(a) * 1300); })] },
  'ARAH-UTARA': { base: { x: 0, y: 0 }, desc: 'Simbol arah utara', cat: 'Simbol', ents: [C(0, 0, 600), H([[{ x: 0, y: 550, b: 0 }, { x: 200, y: -350, b: 0 }, { x: 0, y: -150, b: 0 }]]), { type: 'pline', closed: true, pts: [{ x: 0, y: 550, b: 0 }, { x: -200, y: -350, b: 0 }, { x: 0, y: -150, b: 0 }], layer: '0', color: 0, lt: 'ByBlock', lw: -2 }, T(0, 800, 'U', 300)] },
  'ELEVASI': { base: { x: 0, y: 0 }, desc: 'Penanda elevasi ±0.00', cat: 'Simbol', ents: [H([[{ x: 0, y: 0, b: 0 }, { x: -150, y: 250, b: 0 }, { x: 150, y: 250, b: 0 }]]), L(-150, 250, 1000, 250), T(450, 400, '±0.00', 200)] },
  'POTONGAN': { base: { x: 0, y: 0 }, desc: 'Tanda potongan A', cat: 'Simbol', ents: [C(0, 0, 400), L(-400, 0, 400, 0), T(0, 180, 'A', 220), T(0, -200, 'A-01', 150), H([[{ x: 400, y: 0, b: 0 }, { x: 900, y: 0, b: 0 }, { x: 400, y: 400, b: 0 }]])] },
  'KOLOM-30': { base: { x: 0, y: 0 }, desc: 'Kolom beton 300×300', cat: 'Struktur', ents: [R(-150, -150, 300, 300), H([[{ x: -150, y: -150, b: 0 }, { x: 150, y: -150, b: 0 }, { x: 150, y: 150, b: 0 }, { x: -150, y: 150, b: 0 }]], 'ANSI31', { sc: 10 })] },
  'KOLOM-20': { base: { x: 0, y: 0 }, desc: 'Kolom praktis 150×150', cat: 'Struktur', ents: [R(-75, -75, 150, 150), H([[{ x: -75, y: -75, b: 0 }, { x: 75, y: -75, b: 0 }, { x: 75, y: 75, b: 0 }, { x: -75, y: 75, b: 0 }]], 'SOLID')] },
  'TANGGA-LURUS': { base: { x: 0, y: 0 }, desc: 'Tangga lurus 1000×3600 (12 anak tangga)', cat: 'Struktur', ents: [R(0, 0, 1000, 3600), ...Array.from({ length: 11 }, (_, i) => L(0, 300 * (i + 1), 1000, 300 * (i + 1))), L(500, 150, 500, 3300), L(500, 3300, 400, 3100), L(500, 3300, 600, 3100)] },
};
for (const b of Object.values(LIBRARY)) withIds(b);
