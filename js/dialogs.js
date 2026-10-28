// Dialog & palet: Layer Manager, Color, Linetype, Lineweight, Drafting Settings, Units, Options, Dim/Text Style, QSelect, Find, Block, Insert, Hatch, QuickCalc, Help, Quick Properties.
import { $, h, esc, win, menu, toast, sel, num, chk, isOpen, closeWin } from './dom.js';
import { icon } from './icons.js';
import { ACI, LTYPES, LWEIGHTS, lwName, colorName, TYPE_NAMES, PATTERNS, prims, bbox, DIMDEF } from './ent.js';
import { evalNum, bbEmpty, bbUnion, bbOk, D2R } from './geom.js';
import { drawEntities } from './render.js';
import { LIBRARY } from './library.js';
import { patternSwatch } from './ui.js';

// ---------- Layer Properties Manager ----------
export function layerManager(ui) {
  if (isOpen('layers')) { refreshLayerManager(ui); return; }
  const body = h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' } });
  const w = win({ id: 'layers', title: 'Layer Properties Manager', body, modal: false, width: Math.min(900, innerWidth - 20), height: Math.min(460, innerHeight - 120), left: 60, top: 150 });
  w.el.querySelector('.wb').style.padding = '8px';
  ui._lm = { w, body, filter: '' };
  refreshLayerManager(ui);
}
export function refreshLayerManager(ui) {
  if (!isOpen('layers') || !ui._lm) return;
  const { body } = ui._lm, doc = ui.doc, app = ui.app;
  body.innerHTML = '';
  const M = fn => { app.mutate(fn); ui.refresh(); };
  const used = new Set(doc.allEnts().map(e => e.layer));
  const tb = h('div', { class: 'row' },
    h('button', { class: 'btn sm', title: 'New Layer (Alt+N)', onclick: () => { let i = 1; while (doc.layers['Layer' + i]) i++; M(() => doc.addLayer('Layer' + i, { color: 7 })); setTimeout(() => body.querySelector(`[data-name="Layer${i}"] .nm`)?.dispatchEvent(new Event('dblclick')), 50); } }, h('span', { html: icon('plus'), style: { display: 'inline-block', width: '14px', verticalAlign: '-2px' } }), ' New Layer'),
    h('button', { class: 'btn sm', title: 'Delete Layer', onclick: () => { const n = ui._lm.sel; if (!n) return; if (n === '0' || n === 'Defpoints' || n === doc.clayer || used.has(n)) { toast('Layer tidak dapat dihapus (layer 0, Defpoints, layer aktif, atau berisi objek).'); return; } M(() => delete doc.layers[n]); } }, '✕ Delete'),
    h('button', { class: 'btn sm', title: 'Set Current (Alt+C)', onclick: () => { const n = ui._lm.sel; if (n) { doc.clayer = n; ui.refresh(); } } }, '✓ Set Current'),
    h('span', { style: { flex: 1 } }),
    h('input', { placeholder: 'Search for layer', value: ui._lm.filter, style: { width: '180px' }, oninput: e => { ui._lm.filter = e.target.value; refreshLayerManager(ui); setTimeout(() => body.querySelector('input')?.focus(), 0); } }));
  const tbl = h('table', { class: 'lt' });
  tbl.append(h('tr', {}, ...['Status', 'Name', 'On', 'Freeze', 'Lock', 'Plot', 'Color', 'Linetype', 'Lineweight', 'Description'].map(t => h('th', {}, t))));
  const names = Object.keys(doc.layers).filter(n => n.toLowerCase().includes(ui._lm.filter.toLowerCase())).sort((a, b) => a === '0' ? -1 : b === '0' ? 1 : a.localeCompare(b, undefined, { numeric: true }));
  for (const n of names) {
    const L = doc.layers[n];
    const tog = (k, onI, offI, title) => h('td', { class: 'c', title, onclick: e => { e.stopPropagation(); if (k === 'frz' && n === doc.clayer) { toast('Layer aktif tidak dapat di-freeze.'); return; } M(() => L[k] = !L[k]); } }, h('span', { html: icon(L[k] ? onI : offI), class: (k === 'on' ? !L.on : (k === 'plot' ? !L.plot : false)) ? 'off' : '', style: { color: k === 'on' ? (L.on ? '#F2C94C' : '#777') : k === 'frz' ? (L.frz ? '#8fc3ff' : '#F2C94C') : k === 'plot' ? (L.plot ? 'var(--tx)' : '#777') : 'var(--tx)' } }));
    const nm = h('span', { class: 'nm' }, n);
    nm.addEventListener('dblclick', () => {
      if (n === '0' || n === 'Defpoints') return;
      const inp = h('input', { value: n, style: { width: '150px' } });
      nm.replaceWith(inp); inp.focus(); inp.select();
      const fin = () => { const v = inp.value.trim(); if (v && v !== n && !doc.layers[v]) M(() => { doc.layers[v] = doc.layers[n]; delete doc.layers[n]; doc.allEnts().forEach(e => { if (e.layer === n) e.layer = v; }); Object.values(doc.blocks).forEach(b => b.ents.forEach(e => { if (e.layer === n) e.layer = v; })); if (doc.clayer === n) doc.clayer = v; }); else refreshLayerManager(ui); };
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') fin(); if (e.key === 'Escape') refreshLayerManager(ui); });
      inp.addEventListener('blur', fin);
    });
    const tr = h('tr', { class: ui._lm.sel === n ? 'on' : '', 'data-name': n, onclick: () => { ui._lm.sel = n; refreshLayerManager(ui); }, ondblclick: e => { if (!e.target.closest('.nm,input')) { doc.clayer = n; ui.refresh(); } } },
      h('td', { class: 'c' }, n === doc.clayer ? h('span', { class: 'cur-mark' }, '✓') : h('span', { style: { color: used.has(n) ? 'var(--tx2)' : 'var(--tx3)' } }, '▱')),
      h('td', {}, nm), tog('on', 'bulb', 'bulb', 'On/Off'), tog('frz', 'snow', 'sun', 'Freeze/Thaw'), tog('lck', 'lock', 'unlock', 'Lock/Unlock'), tog('plot', 'printer', 'printer', 'Plot/No Plot'),
      h('td', { class: 'c', style: { textAlign: 'left' }, onclick: e => { e.stopPropagation(); colorDialog(ui, L.color, c => M(() => L.color = c >= 1 && c <= 255 ? c : 7), true); } }, h('i', { class: 'swatch', style: { background: ACI[L.color], marginRight: '6px', verticalAlign: '-2px' } }), colorName(L.color)),
      h('td', { class: 'c', style: { textAlign: 'left' }, onclick: e => { e.stopPropagation(); menu(doc.ltypes.map(lt => ({ l: lt, chk: L.lt === lt, fn: () => M(() => L.lt = lt) })).concat(['-', { l: 'Load…', fn: () => linetype(ui) }]), e.clientX, e.clientY); } }, L.lt),
      h('td', { class: 'c', style: { textAlign: 'left' }, onclick: e => { e.stopPropagation(); menu([-3, ...LWEIGHTS].map(x => ({ l: lwName(x), chk: L.lw === x, fn: () => M(() => L.lw = x) })), e.clientX, e.clientY - 200); } }, lwName(L.lw)),
      h('td', {}, h('input', { value: L.desc || '', style: { border: 0, background: 'transparent', width: '160px', padding: 0 }, onchange: e => M(() => L.desc = e.target.value), onkeydown: e => e.stopPropagation() })));
    tbl.append(tr);
  }
  body.append(tb, h('div', { style: { flex: 1, overflow: 'auto', border: '1px solid var(--line)', borderRadius: '4px' } }, tbl), h('div', { class: 'hint' }, `All: ${Object.keys(doc.layers).length} layers displayed · Current layer: ${doc.clayer} · Double-click nama untuk rename, double-click baris untuk Set Current.`));
}

// ---------- Color (ACI) ----------
export function colorDialog(ui, cur, cb, noBy) {
  let val = cur ?? 7;
  const show = h('div', { class: 'row' });
  const upd = () => { show.innerHTML = ''; show.append(h('i', { class: 'swatch', style: { width: '40px', height: '22px', background: val >= 1 && val <= 255 ? ACI[val] : 'linear-gradient(135deg,#fff 50%,#000 50%)' } }), h('b', {}, colorName(val)), h('span', { class: 'hint' }, val >= 1 && val <= 255 ? ACI[val] : '')); };
  const pick = c => { val = c; upd(); };
  const grid = h('div', { class: 'aci-grid' });
  for (let r = 0; r < 10; r++) for (let c = 0; c < 24; c++) { const i = 10 + c * 10 + (r % 2 ? 1 : 0) + Math.floor(r / 2) * 2; grid.append(h('i', { style: { background: ACI[i] }, title: 'Index color: ' + i, onclick: () => pick(i), ondblclick: () => { pick(i); ok(); } })); }
  const row1 = h('div', { class: 'aci-row' }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => h('i', { style: { background: ACI[i] }, title: colorName(i) + ' (' + i + ')', onclick: () => pick(i), ondblclick: () => { pick(i); ok(); } })));
  const row2 = h('div', { class: 'aci-row' }, ...[250, 251, 252, 253, 254, 255].map(i => h('i', { style: { background: ACI[i] }, title: 'Index color: ' + i, onclick: () => pick(i) })));
  const inp = h('input', { placeholder: 'Color index 1-255', style: { width: '140px' }, onchange: e => { const n = parseInt(e.target.value, 10); if (n >= 0 && n <= 256) pick(n); } });
  const body = h('div', { class: 'col', style: { gap: '10px' } }, h('div', { class: 'hint' }, 'AutoCAD Color Index (ACI):'), grid, h('div', { class: 'row' }, row1, h('span', { style: { width: '18px' } }), row2),
    noBy ? null : h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => pick(256) }, 'ByLayer'), h('button', { class: 'btn sm', onclick: () => pick(0) }, 'ByBlock')), h('div', { class: 'row' }, 'Color:', inp), show);
  upd();
  const w = win({ title: 'Select Color', body, width: 430, buttons: [{ label: 'OK', pri: true, fn: () => ok() }, { label: 'Cancel', fn: x => x.close() }] });
  function ok() { w.close(); cb?.(val); }
}

// ---------- Linetype Manager ----------
export function linetype(ui) {
  const doc = ui.doc;
  const body = h('div', { class: 'col' });
  const draw = () => {
    body.innerHTML = '';
    const list = h('div', { class: 'list' });
    for (const [n, L] of Object.entries(LTYPES)) {
      const loaded = doc.ltypes.includes(n);
      list.append(h('div', { class: doc.set.clt === n ? 'on' : '' }, h('input', { type: 'checkbox', checked: loaded || null, disabled: n === 'Continuous' || null, onchange: e => { ui.app.mutate(() => { if (e.target.checked) { if (!doc.ltypes.includes(n)) doc.ltypes.push(n); } else doc.ltypes = doc.ltypes.filter(x => x !== n); }); draw(); } }), h('b', { style: { width: '150px' } }, n), h('span', { class: 'hint' }, L.d), h('button', { class: 'btn sm', style: { marginLeft: 'auto' }, onclick: () => { ui.app.mutate(() => { if (!doc.ltypes.includes(n)) doc.ltypes.push(n); doc.set.clt = n; }); draw(); ui.refresh(); } }, 'Current')));
    }
    body.append(h('div', { class: 'row' }, 'Current Linetype:', h('b', {}, doc.set.clt)), list,
      h('div', { class: 'grid2' }, 'Global scale factor (LTSCALE):', num(doc.set.ltscale, x => { if (x > 0) { ui.app.mutate(() => doc.set.ltscale = x); ui.ed.invalidate(); } }), 'Current object scale:', num(doc.set.cltscale || 1, x => doc.set.cltscale = x)),
      h('div', { class: 'note' }, 'LTSCALE mengatur tampilan di Model (mis. 50–100 untuk gambar 1:100 dalam mm). Di Layout dan hasil plot/PDF pola selalu mengikuti ukuran kertas (PSLTSCALE=1), jadi garis putus-putus tetap rapi di gambar kerja.'));
  };
  draw();
  win({ title: 'Linetype Manager', body, width: 620, buttons: [{ label: 'OK', pri: true, fn: w => { w.close(); ui.refresh(); } }] });
}
export function lweight(ui) {
  const ed = ui.ed, doc = ui.doc;
  const list = h('div', { class: 'list', style: { maxHeight: '240px' } }, ...[-1, -2, -3, ...LWEIGHTS].map(x => h('div', { class: doc.set.clw === x ? 'on' : '', onclick: () => { doc.set.clw = x; w.close(); ui.refresh(); } }, h('span', { style: { display: 'inline-block', width: '60px', borderTop: `${Math.max(1, (x > 0 ? x : 25) / 25)}px solid var(--tx)` } }), lwName(x))));
  const w = win({ title: 'Lineweight Settings', body: h('div', { class: 'col' }, list, chk('Display Lineweight (LWDISPLAY)', ed.T.lwt, v => { ed.T.lwt = v; ui.refreshStatus(); ed.invalidate(); }), h('div', { class: 'hint' }, 'Units for listing: Millimeters (mm). Default: 0.25 mm.')), width: 340, buttons: [{ label: 'OK', pri: true, fn: x => x.close() }] });
}

// ---------- Drafting Settings ----------
export function drafting(ui, tab = 'snap') {
  const ed = ui.ed, T = ed.T, o = ed.opt;
  const body = h('div', {});
  const tabs = { snap: 'Snap and Grid', polar: 'Polar Tracking', osnap: 'Object Snap', dyn: 'Dynamic Input' };
  const draw = () => {
    body.innerHTML = '';
    body.append(h('div', { class: 'tabsx' }, ...Object.entries(tabs).map(([k, l]) => h('button', { class: k === tab ? 'on' : '', onclick: () => { tab = k; draw(); } }, l))));
    if (tab === 'snap') body.append(h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '14px' } },
      h('fieldset', {}, h('legend', {}, chk('Snap On (F9)', T.snap, v => T.snap = v)), h('div', { class: 'grid2' }, 'Snap X spacing:', num(o.snapX, x => o.snapX = x > 0 ? x : o.snapX), 'Snap Y spacing:', num(o.snapY, x => o.snapY = x > 0 ? x : o.snapY))),
      h('fieldset', {}, h('legend', {}, chk('Grid On (F7)', T.grid, v => { T.grid = v; ed.invalidate(); })), h('div', { class: 'grid2' }, 'Grid X spacing:', num(o.gridX, x => { o.gridX = x > 0 ? x : o.gridX; ed.invalidate(); }), 'Major line every:', num(5, () => { })), h('div', { class: 'hint', style: { marginTop: '6px' } }, 'Grid adaptif: subdivisi otomatis saat zoom.'))));
    if (tab === 'polar') body.append(h('fieldset', {}, h('legend', {}, chk('Polar Tracking On (F10)', T.polar, v => { T.polar = v; if (v) T.ortho = false; })),
      h('div', { class: 'grid2' }, 'Increment angle:', sel([90, 45, 30, 22.5, 18, 15, 10, 5].map(a => [a, a]), o.polarInc, x => o.polarInc = +x), 'Additional angles:', h('input', { value: o.polarExtra.join(', '), placeholder: 'mis. 12, 37.5', onchange: e => o.polarExtra = e.target.value.split(/[,; ]+/).map(Number).filter(isFinite) })),
      h('div', { style: { marginTop: '10px' } }, chk('Object Snap Tracking On (F11)', T.otrack, v => T.otrack = v))));
    if (tab === 'osnap') {
      const items = [['end', 'Endpoint'], ['mid', 'Midpoint'], ['cen', 'Center'], ['gcen', 'Geometric Center'], ['nod', 'Node'], ['qua', 'Quadrant'], ['int', 'Intersection'], ['ext', 'Extension'], ['ins', 'Insertion'], ['per', 'Perpendicular'], ['tan', 'Tangent'], ['nea', 'Nearest']];
      const grid = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' } }, ...items.map(([k, n]) => chk(n, ed.os.has(k), v => v ? ed.os.add(k) : ed.os.delete(k))));
      body.append(h('div', { class: 'row', style: { marginBottom: '8px' } }, chk('Object Snap On (F3)', T.osnap, v => T.osnap = v), chk('Object Snap Tracking On (F11)', T.otrack, v => T.otrack = v)),
        h('fieldset', {}, h('legend', {}, 'Object Snap modes'), grid, h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn sm', onclick: () => { items.forEach(([k]) => ed.os.add(k)); draw(); } }, 'Select All'), h('button', { class: 'btn sm', onclick: () => { ed.os.clear(); draw(); } }, 'Clear All'))),
        h('div', { class: 'hint' }, 'Shift + klik kanan di kanvas untuk menu snap override. Ketik END, MID, CEN, INT, PER, TAN, NEA, QUA, NOD, FROM, M2P saat diminta titik.'));
    }
    if (tab === 'dyn') body.append(h('fieldset', {}, h('legend', {}, chk('Enable Pointer Input & Dimensional Input (F12)', T.dyn, v => T.dyn = v)), h('div', { class: 'hint' }, 'Saat DYN aktif, koordinat titik kedua bersifat relatif (seperti AutoCAD). Awali dengan # untuk absolut, @ untuk relatif, d<a untuk polar.')));
  };
  draw();
  win({ title: 'Drafting Settings', body, width: 560, buttons: [{ label: 'OK', pri: true, fn: w => { w.close(); ui.refreshStatus(); ed.invalidate(); } }, { label: 'Options…', fn: w => { w.close(); options(ui); } }] });
}
export function units(ui) {
  const s = ui.doc.set;
  const body = h('div', { class: 'col' },
    h('fieldset', {}, h('legend', {}, 'Length'), h('div', { class: 'grid2' }, 'Type:', sel(['Decimal'], 'Decimal'), 'Precision:', sel([0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => [n, n ? '0.' + '0'.repeat(n) : '0']), s.prec, x => s.prec = +x))),
    h('fieldset', {}, h('legend', {}, 'Angle'), h('div', { class: 'grid2' }, 'Type:', sel(['Decimal Degrees'], 'Decimal Degrees'), 'Precision:', sel([0, 1, 2, 3, 4].map(n => [n, n ? '0.' + '0'.repeat(n) : '0']), s.angPrec, x => s.angPrec = +x), '', chk('Clockwise', false, () => toast('Arah sudut: counterclockwise (default AutoCAD).')))),
    h('fieldset', {}, h('legend', {}, 'Insertion scale'), h('div', { class: 'grid2' }, 'Units to scale inserted content:', sel([['mm', 'Millimeters'], ['cm', 'Centimeters'], ['m', 'Meters'], ['in', 'Inches'], ['ft', 'Feet']], s.units, x => s.units = x))),
    h('div', { class: 'hint' }, 'Sample Output: 1.5,2.0039,0 · 3<45,0'));
  win({ title: 'Drawing Units', body, width: 380, buttons: [{ label: 'OK', pri: true, fn: w => { w.close(); ui.refresh(); ui.ed.invalidate(); } }] });
}
export function options(ui) {
  const ed = ui.ed, o = ed.opt;
  let tab = 'display';
  const body = h('div', {});
  const tabs = { display: 'Display', drafting: 'Drafting', selection: 'Selection', user: 'User Preferences', save: 'Open and Save' };
  const draw = () => {
    body.innerHTML = '';
    body.append(h('div', { class: 'tabsx' }, ...Object.entries(tabs).map(([k, l]) => h('button', { class: k === tab ? 'on' : '', onclick: () => { tab = k; draw(); } }, l))));
    if (tab === 'display') body.append(h('div', { class: 'grid2' },
      'Color scheme:', sel([['dark', 'Dark'], ['light', 'Light']], document.documentElement.dataset.theme || 'dark', x => { document.documentElement.dataset.theme = x; try { localStorage.setItem('amatucad-theme', x); } catch { } }),
      'Model background:', h('input', { type: 'color', value: o.bg, onchange: e => { o.bg = e.target.value; $('#wrap').style.background = o.bg; ed.invalidate(); } }),
      'Crosshair size (%):', h('input', { type: 'range', min: 1, max: 100, value: o.cursor, oninput: e => { o.cursor = +e.target.value; ed.invalidate(); } }),
      '', h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { o.bg = '#212830'; $('#wrap').style.background = o.bg; ed.invalidate(); } }, 'Default (#212830)'), h('button', { class: 'btn sm', onclick: () => { o.bg = '#000000'; $('#wrap').style.background = o.bg; ed.invalidate(); } }, 'Black'), h('button', { class: 'btn sm', onclick: () => { o.bg = '#ffffff'; ed.invalidate(); } }, 'White'))));
    if (tab === 'drafting') body.append(h('div', { class: 'grid2' }, 'AutoSnap aperture size (px):', h('input', { type: 'range', min: 4, max: 30, value: o.aperture, oninput: e => o.aperture = +e.target.value }), 'Grip size (px):', h('input', { type: 'range', min: 3, max: 12, value: o.gripSize, oninput: e => { o.gripSize = +e.target.value; ed.invalidate(); } })));
    if (tab === 'selection') body.append(h('div', { class: 'grid2' }, 'Pickbox size (px):', h('input', { type: 'range', min: 2, max: 15, value: o.pickbox, oninput: e => { o.pickbox = +e.target.value; ed.invalidate(); } }), '', h('div', { class: 'hint' }, 'Klik kiri-ke-kanan = Window (biru), kanan-ke-kiri = Crossing (hijau). Tekan & seret = Lasso.')));
    if (tab === 'user') body.append(h('div', { class: 'grid2' },
      'Right-click in drawing area:', sel([['menu', 'Shortcut Menu'], ['enter', 'ENTER (repeat last command)']], o.rightClick, x => o.rightClick = x),
      'Mouse wheel / trackpad:', sel([['auto', 'Otomatis (wheel = zoom, trackpad 2 jari = pan)'], ['zoom', 'Selalu zoom (seperti mouse)'], ['pan', 'Selalu pan (trackpad Mac)']], o.wheel, x => o.wheel = x)),
      h('div', { class: 'note', style: { marginTop: '10px' } }, 'Gesture: pinch = zoom · dua jari geser = pan · double-click roda tengah = Zoom Extents · tahan roda tengah = pan · sentuh lama (tablet) = menu konteks.'));
    if (tab === 'save') body.append(h('div', { class: 'col' }, chk('Automatic save (ke penyimpanan browser, untuk pemulihan)', o.autosave, v => o.autosave = v), h('div', { class: 'hint' }, 'Format native: .amcad (JSON, menyimpan layout & kop). Untuk AutoCAD gunakan Save As → DXF sesuai versi tahun.')));
  };
  draw();
  win({ title: 'Options', body, width: 560, buttons: [{ label: 'OK', pri: true, fn: w => { w.close(); ui.app.saveOpts(); } }, { label: 'Cancel', fn: w => w.close() }] });
}
export function dimStyle(ui) {
  const d = ui.doc.dim, ed = ui.ed;
  const set = (k, v) => { ui.app.mutate(() => { d[k] = v; ui.doc.dimRev++; }); ed.invalidate(); };
  const body = h('div', { class: 'col' },
    h('div', { class: 'row' }, 'Current dimstyle:', h('b', {}, 'ISO-25 (Standard)'), h('button', { class: 'btn sm', onclick: () => { ui.app.mutate(() => { Object.assign(d, DIMDEF); ui.doc.dimRev++; }); ed.invalidate(); w.close(); dimStyle(ui); } }, 'Reset')),
    h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '12px' } },
      h('fieldset', {}, h('legend', {}, 'Lines & Arrows'), h('div', { class: 'grid2' }, 'Extend beyond dim lines:', num(d.exe, x => set('exe', x)), 'Offset from origin:', num(d.exo, x => set('exo', x)), 'Arrowheads:', sel([['closed', 'Closed filled'], ['tick', 'Architectural tick'], ['dot', 'Dot'], ['open', 'Open']], d.arrow, x => set('arrow', x)), 'Arrow size:', num(d.asz, x => set('asz', x)))),
      h('fieldset', {}, h('legend', {}, 'Text'), h('div', { class: 'grid2' }, 'Text height:', num(d.txt, x => set('txt', x)), 'Offset from dim line:', num(d.gap, x => set('gap', x))))),
    h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '12px' } },
      h('fieldset', {}, h('legend', {}, 'Fit'), h('div', { class: 'grid2' }, 'Use overall scale of (DIMSCALE):', num(d.scale, x => set('scale', x)))),
      h('fieldset', {}, h('legend', {}, 'Primary Units'), h('div', { class: 'grid2' }, 'Precision:', sel([0, 1, 2, 3, 4].map(n => [n, n ? '0.' + '0'.repeat(n) : '0']), d.dec, x => set('dec', +x)), 'Decimal separator:', sel([[',', "',' (Comma)"], ['.', "'.' (Period)"]], d.sep, x => set('sep', x)), 'Scale factor:', num(d.lfac, x => set('lfac', x)), 'Suffix:', h('input', { value: d.suffix, onchange: e => set('suffix', e.target.value) }), 'Angular precision:', sel([0, 1, 2].map(n => [n, n ? '0.' + '0'.repeat(n) : '0']), d.angDec, x => set('angDec', +x))))),
    h('div', { class: 'note' }, 'Untuk gambar 1:100 dalam mm, set DIMSCALE = 100 agar teks 2,5 mm di kertas.'));
  const w = win({ title: 'Dimension Style Manager — Modify', body, width: 640, buttons: [{ label: 'OK', pri: true, fn: x => x.close() }] });
}
export function textStyle(ui) {
  const s = ui.doc.set;
  win({ title: 'Text Style', body: h('div', { class: 'grid2' }, 'Style name:', h('b', {}, 'Standard'), 'Font:', sel(['Arial (txt.shx substitute)'], 'Arial'), 'Height (0 = prompt):', num(s.textH, x => s.textH = x), 'Width factor:', num(1, () => { })), width: 380, buttons: [{ label: 'Apply & Close', pri: true, fn: w => w.close() }] });
}

// ---------- Quick Select / Find ----------
export function qselect(ui) {
  const ed = ui.ed, doc = ui.doc;
  const scope = ed.sel.size ? 'sel' : 'all';
  const base = () => (st.scope === 'sel' ? [...ed.sel] : ed.ents);
  const st = { scope, type: '*', prop: 'layer', op: '=', val: doc.clayer, mode: 'new' };
  const types = () => ['*', ...new Set(base().map(e => e.type))];
  const valIn = h('input', { value: st.val, onchange: e => st.val = e.target.value });
  const body = h('div', { class: 'grid2' },
    'Apply to:', sel([['all', 'Entire drawing'], ['sel', 'Current selection']], st.scope, x => st.scope = x),
    'Object type:', sel(types().map(t => [t, t === '*' ? 'Multiple' : TYPE_NAMES[t]]), st.type, x => st.type = x),
    'Properties:', sel([['layer', 'Layer'], ['color', 'Color'], ['lt', 'Linetype'], ['name', 'Block name'], ['s', 'Contents (text)'], ['pat', 'Hatch pattern']], st.prop, x => { st.prop = x; valIn.value = x === 'layer' ? doc.clayer : x === 'color' ? '256' : ''; st.val = valIn.value; }),
    'Operator:', sel([['=', '= Equals'], ['!=', '<> Not Equal'], ['*', '* Wildcard Match'], ['all', 'Select All']], st.op, x => st.op = x),
    'Value:', valIn,
    'How to apply:', sel([['new', 'Include in new selection set'], ['ex', 'Exclude from new selection set']], st.mode, x => st.mode = x));
  win({ title: 'Quick Select', body, width: 420, buttons: [{ label: 'OK', pri: true, fn: w => {
    const re = new RegExp('^' + String(st.val).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    const test = e => { if (st.type !== '*' && e.type !== st.type) return false; if (st.op === 'all') return true; const v = String(e[st.prop] ?? (st.prop === 'color' ? 256 : '')); const m = st.op === '*' ? re.test(v) : v.toLowerCase() === String(st.val).toLowerCase(); return st.op === '!=' ? !m : m; };
    const res = base().filter(e => ed.selectable(e) && (st.mode === 'new' ? test(e) : !test(e)));
    ed.setSel(res); ui.print(`${res.length} item(s) selected.`); w.close();
  } }, { label: 'Cancel', fn: w => w.close() }] });
}
export function find(ui) {
  const doc = ui.doc, ed = ui.ed;
  const f = h('input', { placeholder: 'Find what', autofocus: true }), r = h('input', { placeholder: 'Replace with' });
  const out = h('div', { class: 'list', style: { maxHeight: '180px' } });
  const hits = () => ed.ents.filter(e => ['text', 'mtext', 'leader'].includes(e.type) && f.value && String(e.s).toLowerCase().includes(f.value.toLowerCase()));
  const show = () => { out.innerHTML = ''; hits().forEach(e => out.append(h('div', { onclick: () => { ed.setSel([e]); ed.zoomRect(bbox(e, doc), 3); } }, TYPE_NAMES[e.type] + ': ' + e.s))); };
  f.addEventListener('input', show);
  win({ title: 'Find and Replace', body: h('div', { class: 'col' }, f, r, out), width: 420, buttons: [{ label: 'Find', fn: show }, { label: 'Replace All', pri: true, fn: () => { const H = hits(); const re = new RegExp(f.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); ui.app.mutate(() => H.forEach(e => e.s = String(e.s).replace(re, r.value))); ui.print(`${H.length} replaced.`); ed.invalidate(); show(); } }, { label: 'Done', fn: w => w.close() }] });
}

// ---------- Block create / insert ----------
export function blockDialog(ui) {
  return new Promise(res => {
    const doc = ui.doc, ed = ui.ed;
    let mode = 'convert';
    const name = h('input', { placeholder: 'Nama blok', autofocus: true });
    const pre = ed.sel.size ? [...ed.sel] : null;
    const body = h('div', { class: 'col' }, h('div', { class: 'grid2' }, 'Name:', name, 'Description:', h('input', { id: 'bdesc' })),
      h('fieldset', {}, h('legend', {}, 'Objects'), h('div', { class: 'col' }, ...[['retain', 'Retain'], ['convert', 'Convert to block'], ['delete', 'Delete']].map(([k, l]) => h('label', { class: 'row' }, h('input', { type: 'radio', name: 'bm', checked: k === mode || null, onchange: () => mode = k }), l)), h('div', { class: 'hint' }, pre ? `${pre.length} objek terpilih.` : 'Objek dipilih setelah menentukan base point.'))),
      h('div', { class: 'hint' }, 'Base point diminta di kanvas setelah OK.'));
    const w = win({ title: 'Block Definition', body, width: 420, onClose: v => res(v || null), buttons: [{ label: 'OK', pri: true, fn: () => {
      const n = name.value.trim();
      if (!n) { toast('Masukkan nama blok.'); return; }
      if (doc.blocks[n] && !confirm(`Blok "${n}" sudah ada. Definisikan ulang?`)) return;
      w.close({ name: n, mode, sel: pre, desc: body.querySelector('#bdesc').value });
    } }, { label: 'Cancel', fn: () => w.close(null) }] });
  });
}
export function blockThumb(c, doc, name, B) {
  const x = c.getContext('2d'); const W = c.width, H = c.height;
  x.fillStyle = '#212830'; x.fillRect(0, 0, W, H);
  let bb = bbEmpty(); for (const e of B.ents) { const b = bbox(e, doc); if (bbOk(b)) bb = bbUnion(bb, b); }
  if (!bbOk(bb)) return;
  const s = Math.min((W - 10) / ((bb.x2 - bb.x1) || 1), (H - 10) / ((bb.y2 - bb.y1) || 1));
  const v = { scale: s, ox: W / 2 - (bb.x1 + bb.x2) / 2 * s, oy: H / 2 + (bb.y1 + bb.y2) / 2 * s, w: W, h: H };
  drawEntities(x, B.ents, doc, v, { bg: 'dark', cull: false });
  void name;
}
export function insertDialog(ui, filter) {
  return new Promise(res => {
    const doc = ui.doc;
    let tab = filter === 'lib' ? 'lib' : (Object.keys(doc.blocks).filter(n => !n.startsWith('*') && !n.startsWith('A$C')).length ? 'cur' : 'lib');
    const body = h('div', { class: 'col' });
    let chosen = null;
    const draw = () => {
      body.innerHTML = '';
      body.append(h('div', { class: 'tabsx' }, h('button', { class: tab === 'cur' ? 'on' : '', onclick: () => { tab = 'cur'; draw(); } }, 'Current Drawing'), h('button', { class: tab === 'lib' ? 'on' : '', onclick: () => { tab = 'lib'; draw(); } }, 'Libraries (Amatu)')));
      const grid = h('div', { class: 'blocks' });
      const src = tab === 'cur' ? Object.entries(doc.blocks).filter(([n]) => !n.startsWith('*') && !n.startsWith('A$C')) : Object.entries(LIBRARY).filter(([, b]) => !filter || filter === 'lib' || b.cat === filter);
      if (!src.length) grid.append(h('div', { class: 'hint' }, 'Belum ada blok di gambar ini. Buka tab Libraries atau buat dengan BLOCK.'));
      let lastCat = null;
      for (const [n, B] of src) {
        if (tab === 'lib' && B.cat !== lastCat) { lastCat = B.cat; grid.append(h('div', { style: { gridColumn: '1/-1', color: 'var(--tx2)', fontWeight: 600, marginTop: '4px' } }, B.cat)); }
        const c = h('canvas', { width: 176, height: 140 });
        grid.append(h('button', { title: B.desc || n, onclick: () => pick(n, B), ondblclick: () => { pick(n, B); ok(); } }, c, h('span', {}, n)));
        setTimeout(() => blockThumb(c, doc, n, B), 0);
      }
      body.append(grid, h('div', { class: 'hint' }, 'Klik dua kali untuk menyisipkan. Skala/rotasi dapat diatur di command line (opsi Scale/Rotate).'));
    };
    const pick = (n, B) => { chosen = { n, B }; body.querySelectorAll('.blocks button').forEach(b => b.classList.toggle('on', b.title === (B.desc || n))); };
    const ok = () => {
      if (!chosen) return;
      if (!doc.blocks[chosen.n]) { ui.app.mutate(() => { doc.blocks[chosen.n] = JSON.parse(JSON.stringify(chosen.B)); }); }
      w.close(chosen.n);
    };
    draw();
    const w = win({ title: 'Blocks', body, width: Math.min(720, innerWidth - 20), onClose: v => res(v || null), buttons: [{ label: 'Insert', pri: true, fn: ok }, { label: 'Cancel', fn: () => w.close(null) }] });
  });
}

// ---------- Hatch ----------
export function hatchDialog(ui, ent) {
  return new Promise(res => {
    const s = ui.doc.set;
    const st = ent ? { pat: ent.pat, sc: ent.sc || 1, ang: (ent.ang || 0) / D2R } : { pat: s.hpName, sc: s.hpScale, ang: s.hpAng || 0 };
    const gal = h('div', { class: 'gallery', style: { gridTemplateColumns: 'repeat(6, 64px)', gridAutoRows: '60px', maxHeight: '270px' } });
    for (const n of Object.keys(PATTERNS)) { const c = h('canvas', { width: 128, height: 120 }); gal.append(h('button', { class: n === st.pat ? 'on' : '', title: n + ' — ' + PATTERNS[n].d, onclick: e => { st.pat = n; gal.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, c, h('span', {}, n))); setTimeout(() => patternSwatch(c, n), 0); }
    const body = h('div', { class: 'col' }, gal, h('div', { class: 'grid2' }, 'Angle:', num(st.ang, x => st.ang = x), 'Scale:', num(st.sc, x => st.sc = x > 0 ? x : st.sc)));
    const w = win({ title: ent ? 'Hatch Edit' : 'Hatch and Gradient', body, width: 470, onClose: () => res(), buttons: [{ label: 'OK', pri: true, fn: () => {
      if (ent) ui.app.mutate(() => { ent.pat = st.pat; ent.sc = st.sc; ent.ang = st.ang * D2R; delete ent.patDef; });
      else { s.hpName = st.pat; s.hpScale = st.sc; s.hpAng = st.ang; ui.buildRibbon(); }
      ui.ed.invalidate(); w.close();
    } }, { label: 'Cancel', fn: () => w.close() }] });
  });
}

// ---------- QuickCalc ----------
export function quickCalc(ui) {
  if (isOpen('calc')) return;
  const out = h('div', { class: 'list', style: { maxHeight: '160px', fontFamily: 'Menlo,monospace' } });
  const inp = h('input', { placeholder: 'mis. (3500-150*2)/2 atau sqrt(2)*100', style: { width: '100%' }, autofocus: true });
  const go = () => { const v = evalNum(inp.value); if (!isFinite(v)) { toast('Ekspresi tidak valid'); return; } out.prepend(h('div', { title: 'Klik untuk menyalin ke command line', onclick: () => { $('#cmdin').value += String(+v.toFixed(8)); } }, `${inp.value} = ${+v.toFixed(8)}`)); inp.value = String(+v.toFixed(8)); inp.select(); };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); });
  const keys = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' } }, ...['7', '8', '9', '/', '(', '4', '5', '6', '*', ')', '1', '2', '3', '-', 'sqrt(', '0', '.', 'pi', '+', '^'].map(k => h('button', { class: 'btn sm', onclick: () => { inp.value += k; inp.focus(); } }, k)), h('button', { class: 'btn sm', onclick: () => { inp.value = ''; } }, 'C'), h('button', { class: 'btn sm pri', style: { gridColumn: 'span 4' }, onclick: go }, '='));
  win({ id: 'calc', title: 'QuickCalc', modal: false, width: 320, left: innerWidth - 360, top: 170, body: h('div', { class: 'col' }, out, inp, keys, h('div', { class: 'hint' }, 'Ekspresi juga bisa langsung diketik saat diminta jarak/angka, mis. 3000/4.')), buttons: [{ label: 'Paste to command line', fn: () => { $('#cmdin').value = inp.value; $('#cmdin').focus(); } }] });
}

// ---------- Quick Properties ----------
export function quickProps(ui) {
  const ed = ui.ed;
  if (!ed.sel.size) return;
  const host = h('div', { style: { width: '100%' } });
  if (!isOpen('qp')) {
    const r = $('#wrap').getBoundingClientRect();
    win({ id: 'qp', title: 'Quick Properties', modal: false, width: 300, left: Math.min(innerWidth - 320, r.left + ed.mouse.sx + 30), top: Math.max(r.top + 10, r.top + ed.mouse.sy - 60), body: host });
  } else { const w = document.querySelectorAll('.win'); w.forEach(x => { if (x.querySelector('.wh .t')?.textContent === 'Quick Properties') { const b = x.querySelector('.wb'); b.innerHTML = ''; b.append(host); } }); }
  host.className = 'palette'; host.style.border = '0'; host.style.width = '100%';
  ui.buildProps(host, true);
}

// ---------- Help ----------
export function help(ui, q = '') {
  const ed = ui.ed;
  const aliases = {}; for (const [a, n] of Object.entries(ed.alias)) (aliases[n] ||= []).push(a);
  const body = h('div', { class: 'col' });
  const search = h('input', { placeholder: 'Cari perintah / shortcut…', value: q, style: { width: '100%' }, autofocus: true, oninput: () => draw() });
  const list = h('div', { style: { maxHeight: '52vh', overflow: 'auto' } });
  const keys = [['Ctrl+N / O / S', 'New / Open / Save'], ['Ctrl+Shift+S', 'Save As'], ['Ctrl+P', 'Plot (PDF gambar kerja)'], ['Ctrl+Z / Ctrl+Y', 'Undo / Redo'], ['Ctrl+C / X / V', 'Copy / Cut / Paste'], ['Ctrl+Shift+C / V', 'Copy base point / Paste as block'], ['Ctrl+A', 'Select all'], ['Ctrl+1', 'Properties'], ['Ctrl+2 / 3', 'Blocks / Library'], ['Ctrl+8', 'QuickCalc'], ['Ctrl+9', 'Command line'], ['Ctrl+0', 'Clean screen'], ['Ctrl+Tab', 'Ganti gambar'], ['Ctrl+Shift+P', 'Quick Properties'], ['F1', 'Help'], ['F2', 'Text window'], ['F3', 'OSNAP'], ['F7', 'GRID'], ['F8', 'ORTHO'], ['F9', 'SNAP'], ['F10', 'POLAR'], ['F11', 'OTRACK'], ['F12', 'DYN input'], ['Enter / Space', 'Ulangi perintah terakhir / konfirmasi'], ['Esc', 'Batal / hapus seleksi'], ['Del', 'Erase'], ['Shift+klik', 'Hapus dari seleksi'], ['Shift+klik kanan', 'Menu OSNAP override'], ['Roda mouse', 'Zoom pada kursor'], ['Tahan roda', 'Pan'], ['Double-click roda', 'Zoom extents'], ['Pinch / 2 jari', 'Zoom / Pan (trackpad & layar sentuh)']];
  const draw = () => {
    const t = search.value.trim().toUpperCase(); list.innerHTML = '';
    const g = h('div', { class: 'helpgrid' }, h('div', { style: { color: 'var(--tx2)' } }, 'Command'), h('div', { style: { color: 'var(--tx2)' } }, 'Alias'), h('div', { style: { color: 'var(--tx2)' } }, ''));
    Object.keys(ed.cmds).filter(n => !n.startsWith('UI_') && !n.startsWith('HATCHPICK') && n !== 'GRIPEDIT').sort().forEach(n => { const al = (aliases[n] || []).join(', '); if (t && !n.includes(t) && !al.includes(t)) return; g.append(h('b', { style: { cursor: 'pointer' }, onclick: () => { w.close(); ui.app.exec(n); } }, n), h('span', {}, al), h('div', { style: { color: 'var(--tx2)' } }, ui.DESC?.[n] || '')); });
    const k = h('div', { class: 'helpgrid', style: { gridTemplateColumns: '170px 1fr', marginTop: '14px' } }, ...keys.filter(([a, b]) => !t || (a + b).toUpperCase().includes(t)).flatMap(([a, b]) => [h('kbd', {}, a), h('div', {}, b)]));
    list.append(h('h4', { style: { margin: '4px 0' } }, 'Shortcut & gesture'), k, h('h4', { style: { margin: '14px 0 4px' } }, 'Perintah'), g);
  };
  body.append(search, list);
  draw();
  const w = win({ title: 'Amatu CAD — Help', body, width: Math.min(760, innerWidth - 20), buttons: [{ label: 'Close', pri: true, fn: x => x.close() }] });
}
void esc; void prims; void LTYPES;
