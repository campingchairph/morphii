/* ═══════════════════════════════════════════════════════════════
   Morphii Sticker Sheets — standalone from the button-pin designer.
   Reads the same asset library (GitHub tree) but shares no code with create.js.

   Pipeline per sticker:
     1. rasterise the image at MP px/mm, threshold alpha -> silhouette
     2. Euclidean distance field from the silhouette (Felzenszwalb)
     3. marching squares on that field at level = border  -> white "holder" outline
        and at level = border + gap                       -> cut line
        (holes are dropped, so the holder is solid white)
     4. simplify both outlines (Douglas-Peucker) into mm polygons
   Then all stickers are packed onto A4 pages with MaxRects (bounding boxes of
   the cut lines + minimum spacing, optional 90deg rotation).
   ═══════════════════════════════════════════════════════════════ */
'use strict';
(function () {

/* ── constants ─────────────────────────────────────────────── */
const PAGE_W = 210, PAGE_H = 297;      // A4, mm
const MP = 6;                           // mask resolution, px per mm
const PAD_MM = 13;                      // room around the image for border+gap (max 8+4 +1)
const EXPORT_PPMM = 2480 / 210;         // 300 dpi
const ALPHA_T = 32;
const MAX_INSTANCES = 400;

const PINS_RAW_BASE = 'https://raw.githubusercontent.com/campingchairph/morphii/main/assets/pins/';
const PINS_TREE_URL = 'https://api.github.com/repos/campingchairph/morphii/git/trees/main?recursive=1';
const PINS_TREE_CACHE_KEY = 'morphii_pins_asset_tree_v1';   // same cache create.js uses
const PINS_TREE_CACHE_TTL = 10 * 60 * 1000;
const ASSET_CATEGORIES = ['stickers','shapes','holders','texts','borders','background','characters','letters'];
const CATEGORY_TO_SET_KEY = { stickers:'stickers', shapes:'shapes', holders:'shapes', texts:'wordart', borders:'borders', background:'background', characters:'characters', letters:'letters' };
const COLLECTIONS = [['shared', 'Main library']];   // only the main library is offered for stickers
const OTHER_CATS = [
  ['shapes', 'Shapes'], ['wordart', 'Text art'], ['characters', 'Characters'],
  ['borders', 'Borders'], ['background', 'Backgrounds'], ['letters', 'Letters'],
];
const STICKER_LOGO_RE = /^logo\.[^.]+$/i;

/* ── state ─────────────────────────────────────────────────── */
const S = {
  items: [],            // { id, src, label, sizeMm, qty }
  settings: { style: 'contour', border: 3, gap: 0.5, margin: 5, spacing: 2, rotate: false, showCut: false },  // gap/margin/spacing are fixed (no UI)
  pages: [],            // [{ placements:[{inst,x,y,rot}] }]
  oversize: [],
  pageIdx: 0,
  panel: null,          // which bottom pop-up is open: null | 'lib' | 'admin'
  sel: null,            // id of the item whose sticker is selected (tapped on the sheet)
  stats: { stickers: 0, usedPct: 0 },
};
let LIB = { sets: {}, order: {}, collection: 'shared', category: null, hidden: new Set(), isAdmin: false };
let nextId = 1;
let buildGen = 0;
let buildTimer = null;
const IMG_CACHE = {};     // src -> Promise<HTMLImageElement>
const FIELD_CACHE = {};   // src|size -> Promise<field record>

const DESKTOP = window.matchMedia('(min-width:901px)');   // desktop = two panels; below that = the phone layout
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/* ═══════════════ asset library ═══════════════ */
function labelFromFilename(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}
async function fetchTree() {
  try {
    const cached = JSON.parse(localStorage.getItem(PINS_TREE_CACHE_KEY) || 'null');
    if (cached && Array.isArray(cached.paths) && Date.now() - cached.t < PINS_TREE_CACHE_TTL) return cached.paths;
  } catch (e) {}
  const res = await fetch(PINS_TREE_URL);
  if (!res.ok) throw new Error('GitHub tree fetch failed: ' + res.status);
  const data = await res.json();
  const paths = (data.tree || []).filter(it => it.type === 'blob' && it.path.startsWith('assets/pins/')).map(it => it.path);
  try { localStorage.setItem(PINS_TREE_CACHE_KEY, JSON.stringify({ t: Date.now(), paths })); } catch (e) {}
  return paths;
}
function buildSet(paths, basePath, overrides) {
  const set = { stickers: [], shapes: [], wordart: [], borders: [], background: [], characters: [], letters: [] };
  ASSET_CATEGORIES.forEach(cat => {
    const prefix = 'assets/pins/' + basePath + cat + '/';
    const key = CATEGORY_TO_SET_KEY[cat];
    paths.forEach(path => {
      if (!path.startsWith(prefix)) return;
      const rest = path.slice(prefix.length);
      if (cat === 'stickers') {
        const parts = rest.split('/');
        if (parts.length > 2) return;
        const name = parts[parts.length - 1];
        if (!/\.(png|jpe?g|webp|gif)$/i.test(name)) return;
        const url = PINS_RAW_BASE + basePath + cat + '/' + rest;
        set[key].push({ label: overrides[url] || labelFromFilename(name), src: url, name, group: parts.length === 2 ? parts[0] : null });
        return;
      }
      if (rest.includes('/') || !/\.(png|jpe?g|webp|gif)$/i.test(rest)) return;
      const url = PINS_RAW_BASE + basePath + cat + '/' + rest;
      set[key].push({ label: overrides[url] || labelFromFilename(rest), src: url, name: rest });
    });
  });
  return set;
}
function stickerCategories(collection, includeHidden) {
  const set = LIB.sets[collection];
  if (!set) return [];
  const by = {}, loose = [];
  set.stickers.forEach(it => { if (it.group) (by[it.group] = by[it.group] || []).push(it); else loose.push(it); });
  const order = (LIB.order && LIB.order[collection]) || [];
  const ids = Object.keys(by).sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  const cats = ids.map(id => ({ id: 's:' + id, label: labelFromFilename(id), items: by[id] }));
  if (loose.length) cats.push({ id: 's:__other', label: 'Other', items: loose });
  OTHER_CATS.forEach(([key, label]) => {
    if (set[key] && set[key].length) cats.push({ id: 'o:' + key, label, items: set[key] });
  });
  cats.forEach(c => { c.key = collection + '|' + c.id; });
  return includeHidden ? cats : cats.filter(c => !LIB.hidden.has(c.key));
}
async function loadLibrary() {
  $('libGrid').innerHTML = '<div class="st-empty">Loading library…</div>';
  let overrides = {};
  try { overrides = await getAssetLabelOverrides(); } catch (e) {}
  try { LIB.order = await getCategoryOrder(); } catch (e) {}
  try { LIB.hidden = new Set((await getStickerLibrary()).hidden); } catch (e) {}
  let paths = [];
  try { paths = await fetchTree(); }
  catch (e) { $('libGrid').innerHTML = '<div class="st-empty">Couldn’t load the library right now. Check your connection and refresh.</div>'; return; }
  COLLECTIONS.forEach(([id]) => { LIB.sets[id] = buildSet(paths, id === 'shared' ? '' : id + '/', overrides); });
  renderLibrary();
  renderAdminLib();   // no-op unless an admin is signed in
  if (DESKTOP.matches && !S.panel && LIB.category) openPanel('lib');
}
// every group from every collection, in one list (collection order, then the admin's group order)
function allCategories(includeHidden) {
  const cats = [];
  COLLECTIONS.forEach(([id, label]) => stickerCategories(id, includeHidden).forEach(c => cats.push(Object.assign({ coll: id, collLabel: label }, c))));
  const count = {};
  cats.forEach(c => { count[c.label] = (count[c.label] || 0) + 1; });
  cats.forEach(c => { c.shown = count[c.label] > 1 && c.coll !== 'shared' ? c.label + ' (' + c.collLabel + ')' : c.label; });
  return cats;
}
// circle badge on each library thumbnail showing how many copies are in the tray
function updateBadges() {
  const counts = {};
  S.items.forEach(i => { counts[i.src] = i.qty; });
  document.querySelectorAll('#libGrid .st-lib-item').forEach(el => {
    const n = counts[el.dataset.src] || 0;
    el.classList.toggle('picked', n > 0);
    let b = el.querySelector('.st-badge');
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'st-badge'; el.appendChild(b); }
    b.textContent = n;
  });
}
function groupThumb(c) {
  const logo = c.items.find(it => STICKER_LOGO_RE.test(it.name || ''));
  return (logo || c.items[0]).src;
}
const ICON_PASTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M9 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-3"/><path d="M9 12h6M9 16h6"/></svg>';
const ICON_UPLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>';
const ICON_ADMIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z"/></svg>';

// the menu along the bottom: tools first, then every group of the library as a thumbnail
function renderLibrary() {
  const cats = allCategories(LIB.isAdmin);
  if (!cats.find(c => c.key === LIB.category)) LIB.category = cats.length ? cats[0].key : null;
  const strip = $('libCats'), keep = strip.scrollLeft;
  const tool = (name, label, icon) =>
    '<button class="st-group tool' + (S.panel === name ? ' active' : '') + '" data-panel="' + name + '"><div class="th">' + icon + '</div><span>' + label + '</span></button>';
  strip.innerHTML =
    '<label class="st-group tool desk" for="uploadInput"><div class="th">' + ICON_UPLOAD + '</div><span>Upload</span></label>' +
    '<button class="st-group tool desk" data-act="paste"><div class="th">' + ICON_PASTE + '</div><span>Paste</span></button>' +
    (LIB.isAdmin ? tool('admin', 'Admin', ICON_ADMIN) : '') +
    '<i class="st-dock-sep' + (LIB.isAdmin ? '' : ' desk') + '"></i>' +
    cats.map(c =>
      '<button class="st-group' + (S.panel === 'lib' && c.key === LIB.category ? ' active' : '') + (LIB.hidden.has(c.key) ? ' is-hidden' : '') + '" data-cat="' + esc(c.key) + '">' +
      '<div class="th"><img loading="lazy" src="' + esc(groupThumb(c)) + '" alt=""></div><span>' + esc(c.shown) + '</span></button>').join('');
  strip.scrollLeft = keep;
  renderGrid();
}
// all the assets of the chosen group, shown in the bottom pop-up
function renderGrid() {
  const cat = allCategories(LIB.isAdmin).find(c => c.key === LIB.category);
  if (!cat) { $('libGrid').innerHTML = '<div class="st-empty">Nothing here yet.</div>'; updatePanelHead(null); return; }
  const items = cat.items.slice().sort((a, b) =>
    (STICKER_LOGO_RE.test(b.name) ? 1 : 0) - (STICKER_LOGO_RE.test(a.name) ? 1 : 0) || a.label.localeCompare(b.label));
  const same = $('libGrid').dataset.cat === cat.key;
  if (!same) {
    $('libGrid').innerHTML = items.map(it =>
      '<div class="st-lib-item" data-src="' + esc(it.src) + '" data-label="' + esc(it.label) + '"><img loading="lazy" src="' + esc(it.src) + '" alt=""></div>').join('');
    $('libGrid').dataset.cat = cat.key;
    $('pane-lib').parentElement.scrollTop = 0;
  }
  updateBadges();
  updatePanelHead(cat);
}
function updatePanelHead(cat) {
  const t = $('panelTitle'), sub = $('panelSub');
  if (S.panel === 'lib') { t.textContent = cat ? cat.shown : 'Stickers'; sub.textContent = 'Tap to add · tap again for more'; }
  else if (S.panel === 'admin') { t.textContent = 'Admin'; sub.textContent = ''; }
}
function openPanel(name) {
  S.panel = name;
  $('panel').classList.add('open');
  ['lib', 'admin'].forEach(n => { $('pane-' + n).hidden = n !== name; });
  $('pane-lib').parentElement.scrollTop = 0;
  renderLibrary();
}
function closePanel() {
  if (DESKTOP.matches && LIB.category) { openPanel('lib'); return; }   // desktop: the library is always open
  S.panel = null;
  $('panel').classList.remove('open');
  renderLibrary();
}

/* ═══════════════ image + silhouette field ═══════════════ */
function loadImg(src) {
  if (!IMG_CACHE[src]) {
    IMG_CACHE[src] = new Promise((resolve, reject) => {
      const im = new Image();
      if (!/^data:|^blob:/.test(src)) im.crossOrigin = 'anonymous';
      im.onload = () => resolve(im);
      im.onerror = () => { delete IMG_CACHE[src]; reject(new Error('image failed: ' + src)); };
      im.src = src;
    });
  }
  return IMG_CACHE[src];
}

// 1-D squared distance transform (Felzenszwalb & Huttenlocher)
function dt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s;
    for (;;) {
      const p = v[k];
      s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
      if (s <= z[k]) k--; else break;
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const p = v[k];
    d[q] = (q - p) * (q - p) + f[p];
  }
}
// distance (in px) from every pixel to the nearest opaque pixel; 0 inside
function distanceField(opaque, W, H) {
  const BIG = 1e10;
  const f = new Float64Array(W * H);
  for (let i = 0; i < f.length; i++) f[i] = opaque[i] ? 0 : BIG;
  const n = Math.max(W, H);
  const col = new Float64Array(n), out = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) col[y] = f[y * W + x];
    dt1d(col, H, out, v, z);
    for (let y = 0; y < H; y++) f[y * W + x] = out[y];
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) col[x] = f[y * W + x];
    dt1d(col, W, out, v, z);
    for (let x = 0; x < W; x++) f[y * W + x] = out[x];
  }
  const res = new Float32Array(W * H);
  for (let i = 0; i < res.length; i++) res[i] = Math.sqrt(f[i]);
  return res;
}

function getField(src, sizeMm) {
  const key = src + '|' + sizeMm;
  if (!FIELD_CACHE[key]) {
    const keys = Object.keys(FIELD_CACHE);
    if (keys.length > 40) delete FIELD_CACHE[keys[0]];
    FIELD_CACHE[key] = (async () => {
      const img = await loadImg(src);
      const aspect = img.naturalWidth / img.naturalHeight;
      const wMm = aspect >= 1 ? sizeMm : sizeMm * aspect;
      const hMm = aspect >= 1 ? sizeMm / aspect : sizeMm;
      const padPx = Math.round(PAD_MM * MP);
      const iw = Math.max(1, Math.round(wMm * MP)), ih = Math.max(1, Math.round(hMm * MP));
      const W = iw + padPx * 2, H = ih + padPx * 2;
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(img, padPx, padPx, iw, ih);
      const data = cx.getImageData(0, 0, W, H).data;
      const opaque = new Uint8Array(W * H);
      let minX = W, minY = H, maxX = -1, maxY = -1, n = 0;
      for (let i = 0; i < opaque.length; i++) {
        if (data[i * 4 + 3] > ALPHA_T) {
          opaque[i] = 1; n++;
          const x = i % W, y = (i / W) | 0;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
      if (!n) throw new Error('empty image: ' + src);
      const field = distanceField(opaque, W, H);
      // enclosing-circle radius about the bbox centre (for the circle holder)
      const cxp = (minX + maxX + 1) / 2, cyp = (minY + maxY + 1) / 2;
      let r2 = 0;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        if (!opaque[y * W + x]) continue;
        const dx = x + 0.5 - cxp, dy = y + 0.5 - cyp, d = dx * dx + dy * dy;
        if (d > r2) r2 = d;
      }
      const toMm = (px) => (px - padPx) / MP;
      return {
        img, wMm, hMm, W, H, field, padPx,
        bbox: { x0: toMm(minX), y0: toMm(minY), x1: toMm(maxX + 1), y1: toMm(maxY + 1) },
        circle: { cx: toMm(cxp), cy: toMm(cyp), r: Math.sqrt(r2) / MP },
      };
    })();
    FIELD_CACHE[key].catch(() => { delete FIELD_CACHE[key]; });
  }
  return FIELD_CACHE[key];
}

/* ═══════════════ contours ═══════════════ */
// marching squares with linear interpolation; returns closed loops as [[x,y],...] in px
function marching(field, W, H, L) {
  const adj = new Map(), pts = new Map();
  function edge(kind, i, j) {
    const key = (j * W + i) * 2 + (kind === 'h' ? 0 : 1);
    if (!pts.has(key)) {
      let a, b, xb, yb;
      if (kind === 'h') { a = field[j * W + i]; b = field[j * W + i + 1]; xb = i + 1; yb = j; }
      else { a = field[j * W + i]; b = field[(j + 1) * W + i]; xb = i; yb = j + 1; }
      const t = (L - a) / (b - a);
      pts.set(key, [i + (xb - i) * t + 0.5, j + (yb - j) * t + 0.5]);
    }
    return key;
  }
  function link(a, b) {
    (adj.get(a) || adj.set(a, []).get(a)).push(b);
    (adj.get(b) || adj.set(b, []).get(b)).push(a);
  }
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const tl = field[j * W + i] < L ? 1 : 0, tr = field[j * W + i + 1] < L ? 2 : 0;
      const br = field[(j + 1) * W + i + 1] < L ? 4 : 0, bl = field[(j + 1) * W + i] < L ? 8 : 0;
      const code = tl | tr | br | bl;
      if (code === 0 || code === 15) continue;
      const T = edge('h', i, j), B = edge('h', i, j + 1), Lf = edge('v', i, j), R = edge('v', i + 1, j);
      switch (code) {
        case 1: case 14: link(Lf, T); break;
        case 2: case 13: link(T, R); break;
        case 3: case 12: link(Lf, R); break;
        case 4: case 11: link(R, B); break;
        case 5: link(Lf, T); link(R, B); break;
        case 6: case 9: link(T, B); break;
        case 7: case 8: link(Lf, B); break;
        case 10: link(T, R); link(B, Lf); break;
      }
    }
  }
  const seen = new Set(), loops = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let prev = -1, cur = start, ok = true;
    for (let guard = 0; guard < 2e6; guard++) {
      seen.add(cur);
      loop.push(pts.get(cur));
      const nb = adj.get(cur);
      if (!nb || nb.length < 2) { ok = false; break; }
      const next = nb[0] !== prev ? nb[0] : nb[1];
      if (next === start) break;
      prev = cur; cur = next;
    }
    if (ok && loop.length > 2) loops.push(loop);
  }
  return loops;
}
function polyArea(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) { const q = p[(i + 1) % n]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
  return a / 2;
}
function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function dpChain(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, idx = -1;
    const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function simplifyClosed(poly, eps) {
  if (poly.length < 8) return poly;
  // split at the point farthest from vertex 0 so both halves are open chains
  let far = 0, fd = 0;
  for (let i = 1; i < poly.length; i++) {
    const d = (poly[i][0] - poly[0][0]) ** 2 + (poly[i][1] - poly[0][1]) ** 2;
    if (d > fd) { fd = d; far = i; }
  }
  const a = dpChain(poly.slice(0, far + 1), eps);
  const b = dpChain(poly.slice(far).concat([poly[0]]), eps);
  return a.concat(b.slice(1, -1));
}
// outer contours only, in mm relative to the image's top-left corner
function contoursAt(F, levelMm) {
  const L = levelMm * MP;
  const toMm = p => [(p[0] - F.padPx) / MP, (p[1] - F.padPx) / MP];
  let loops = marching(F.field, F.W, F.H, L).map(l => l.map(toMm));
  const minArea = 1.5 * Math.PI * levelMm * levelMm;   // drops circles that came from stray specks
  loops = loops.map(p => ({ p, a: Math.abs(polyArea(p)) })).filter(o => o.a > Math.max(minArea, 0.5)).sort((x, y) => y.a - x.a);
  const out = [];
  loops.forEach(o => {
    const insideAnother = out.some(big => pointInPoly(o.p[0], big.p));
    if (!insideAnother) out.push(o);     // inside another loop at the same level = a hole -> ignore
  });
  return out.map(o => simplifyClosed(o.p, 0.04));
}
function roundedRectPoly(x0, y0, x1, y1, r) {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  const pts = [], seg = 8;
  const corners = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
  corners.forEach(([cx, cy, a0]) => {
    for (let i = 0; i <= seg; i++) {
      const a = (a0 + (90 * i) / seg) * Math.PI / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  });
  return pts;
}
function circlePoly(cx, cy, r) {
  const pts = [], n = 120;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}

// geometry for one item under the current settings (all in mm, origin = image top-left)
function buildGeom(F, st) {
  const style = st.style;
  const b = style === 'none' ? 0 : st.border, gap = st.gap;
  let holders = [], cuts;
  if (style === 'contour') {
    holders = b > 0 ? contoursAt(F, b) : [];
    cuts = contoursAt(F, b + gap);
  } else if (style === 'none') {
    cuts = contoursAt(F, gap);
  } else if (style === 'circle') {
    holders = [circlePoly(F.circle.cx, F.circle.cy, F.circle.r + b)];
    cuts = [circlePoly(F.circle.cx, F.circle.cy, F.circle.r + b + gap)];
  } else { // 'rounded'
    const bb = F.bbox, rr = Math.max(3, b * 1.5);
    holders = [roundedRectPoly(bb.x0 - b, bb.y0 - b, bb.x1 + b, bb.y1 + b, rr)];
    cuts = [roundedRectPoly(bb.x0 - b - gap, bb.y0 - b - gap, bb.x1 + b + gap, bb.y1 + b + gap, rr + gap)];
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, area = 0;
  cuts.forEach(p => {
    area += Math.abs(polyArea(p));
    p.forEach(([x, y]) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
  });
  return { F, holders, cuts, bbox: { x0, y0, x1, y1 }, w: x1 - x0, h: y1 - y0, area };
}

/* ═══════════════ packing (MaxRects, best short side fit) ═══════════════ */
function maxRectsPack(binW, binH, items, allowRot) {
  let free = [{ x: 0, y: 0, w: binW, h: binH }];
  const placed = [], rest = [];
  items.forEach(it => {
    let best = null;
    for (const r of free) {
      for (let rot = 0; rot < (allowRot ? 2 : 1); rot++) {
        const w = rot ? it.h : it.w, h = rot ? it.w : it.h;
        if (w <= r.w + 1e-6 && h <= r.h + 1e-6) {
          const s1 = Math.min(r.w - w, r.h - h), s2 = Math.max(r.w - w, r.h - h);
          if (!best || s1 < best.s1 || (s1 === best.s1 && s2 < best.s2)) best = { x: r.x, y: r.y, w, h, rot, s1, s2 };
        }
      }
    }
    if (!best) { rest.push(it); return; }
    placed.push({ it, x: best.x, y: best.y, rot: best.rot });
    const next = [];
    free.forEach(f => {
      if (best.x >= f.x + f.w || best.x + best.w <= f.x || best.y >= f.y + f.h || best.y + best.h <= f.y) { next.push(f); return; }
      if (best.x > f.x) next.push({ x: f.x, y: f.y, w: best.x - f.x, h: f.h });
      if (best.x + best.w < f.x + f.w) next.push({ x: best.x + best.w, y: f.y, w: f.x + f.w - best.x - best.w, h: f.h });
      if (best.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: best.y - f.y });
      if (best.y + best.h < f.y + f.h) next.push({ x: f.x, y: best.y + best.h, w: f.w, h: f.y + f.h - best.y - best.h });
    });
    free = next.filter((a, i) => !next.some((b, j) => i !== j && a.x >= b.x - 1e-9 && a.y >= b.y - 1e-9 &&
      a.x + a.w <= b.x + b.w + 1e-9 && a.y + a.h <= b.y + b.h + 1e-9 && (i > j || a.w < b.w || a.h < b.h)));
  });
  return { placed, rest };
}

function layoutPages(instances, st) {
  const usableW = PAGE_W - 2 * st.margin, usableH = PAGE_H - 2 * st.margin;
  const sp = st.spacing;
  let todo = instances.map(inst => ({ inst, w: inst.geom.w + sp, h: inst.geom.h + sp }));
  const fits = it => (it.w <= usableW + sp && it.h <= usableH + sp) || (st.rotate && it.h <= usableW + sp && it.w <= usableH + sp);
  const oversize = todo.filter(it => !fits(it)).map(it => it.inst);
  todo = todo.filter(fits).sort((a, b) => b.w * b.h - a.w * a.h);
  const pages = [];
  while (todo.length && pages.length < 30) {
    const { placed, rest } = maxRectsPack(usableW + sp, usableH + sp, todo, st.rotate);
    if (!placed.length) break;
    pages.push({ placements: placed.map(p => ({ inst: p.it.inst, x: st.margin + p.x, y: st.margin + p.y, rot: p.rot })) });
    todo = rest;
  }
  return { pages, oversize };
}

/* ═══════════════ rendering ═══════════════ */
// matrix mapping geometry mm -> page mm for one placement
function placementMatrix(p) {
  const bb = p.inst.geom.bbox;
  return p.rot
    ? [0, 1, -1, 0, p.x + bb.y1, p.y - bb.x0]
    : [1, 0, 0, 1, p.x - bb.x0, p.y - bb.y0];
}
function pathOf(polys) {
  const path = new Path2D();
  polys.forEach(poly => {
    poly.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
    path.closePath();
  });
  return path;
}
// mode: 'preview' | 'print' (clean artwork, transparent) | 'proof' (clean + cut lines)
function drawPage(ctx, page, ppmm, mode, opts) {
  opts = opts || {};
  const cw = Math.round(PAGE_W * ppmm), ch = Math.round(PAGE_H * ppmm);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  if (mode === 'preview') { ctx.fillStyle = '#f4f3ee'; ctx.fillRect(0, 0, cw, ch); }
  else if (mode === 'proof') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch); }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

  if (mode === 'preview' && opts.margin > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(34,48,31,0.18)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.strokeRect(opts.margin * ppmm, opts.margin * ppmm, (PAGE_W - 2 * opts.margin) * ppmm, (PAGE_H - 2 * opts.margin) * ppmm);
    ctx.restore();
  }
  page.placements.forEach(p => {
    const m = placementMatrix(p), g = p.inst.geom;
    ctx.setTransform(m[0] * ppmm, m[1] * ppmm, m[2] * ppmm, m[3] * ppmm, m[4] * ppmm, m[5] * ppmm);
    if (g.holders.length) {
      ctx.save();
      if (mode === 'preview') { ctx.shadowColor = 'rgba(40,50,30,0.30)'; ctx.shadowBlur = 3 * ppmm / 4; ctx.shadowOffsetY = 0.4 * ppmm / 4; }
      ctx.fillStyle = '#fff';
      ctx.fill(pathOf(g.holders));
      ctx.restore();
    }
    ctx.drawImage(g.F.img, 0, 0, g.F.wMm, g.F.hMm);
    if (mode === 'preview' && opts.selId && p.inst.item.id === opts.selId) {
      ctx.save();
      ctx.strokeStyle = '#1E2A20'; ctx.lineWidth = 0.9; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(143,174,124,0.9)'; ctx.shadowBlur = 6 * ppmm / 4;
      ctx.stroke(pathOf(g.cuts));
      ctx.restore();
    }
    const showCut = mode === 'proof' || (mode === 'preview' && opts.showCut);
    if (showCut) {
      ctx.save();
      ctx.strokeStyle = '#e6007e'; ctx.lineWidth = mode === 'proof' ? 0.25 : 0.35; ctx.lineJoin = 'round';
      ctx.setLineDash(mode === 'preview' ? [1.6, 1.0] : []);
      ctx.stroke(pathOf(g.cuts));
      ctx.restore();
    }
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (mode === 'preview') {
    ctx.save();
    ctx.translate(cw / 2, ch / 2); ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = 'rgba(30,42,32,0.09)';
    ctx.font = '800 ' + Math.round(cw / 14) + 'px "Baloo 2", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const step = cw / 4.2;
    for (let yy = -ch; yy <= ch; yy += step) for (let xx = -cw; xx <= cw; xx += step * 1.9) {
      ctx.fillText('MORPHII', xx + ((yy / step) % 2 ? step : 0), yy);
    }
    ctx.restore();
  }
}
function pageSvg(page) {
  const f = n => (Math.round(n * 1000) / 1000);
  let d = '';
  page.placements.forEach(p => {
    const m = placementMatrix(p);
    p.inst.geom.cuts.forEach(poly => {
      d += poly.map(([x, y], i) => (i ? 'L' : 'M') + f(m[0] * x + m[2] * y + m[4]) + ' ' + f(m[1] * x + m[3] * y + m[5])).join('') + 'Z';
    });
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">\n' +
    '<g id="CutContour" fill="none" stroke="#ff00ff" stroke-width="0.25"><path d="' + d + '"/></g>\n</svg>\n';
}

/* ═══════════════ build pipeline ═══════════════ */
function scheduleBuild() {
  clearTimeout(buildTimer);
  buildTimer = setTimeout(rebuild, 140);
}
async function rebuild() {
  const gen = ++buildGen;
  const st = Object.assign({}, S.settings);
  $('sheetBusy').style.display = S.items.length ? 'block' : 'none';
  const instances = [];
  let failed = 0;
  for (const item of S.items) {
    let F;
    try { F = await getField(item.src, item.sizeMm); } catch (e) { failed++; continue; }
    if (gen !== buildGen) return;
    const geom = buildGeom(F, st);
    if (!isFinite(geom.w) || geom.w <= 0) { failed++; continue; }
    for (let k = 0; k < item.qty && instances.length < MAX_INSTANCES; k++) instances.push({ item, geom, k });
  }
  if (gen !== buildGen) return;
  const { pages, oversize } = layoutPages(instances, st);
  S.pages = pages; S.oversize = oversize;
  if (S.pageIdx >= pages.length) S.pageIdx = Math.max(0, pages.length - 1);
  const totalArea = pages.length * PAGE_W * PAGE_H;
  const used = pages.reduce((s, pg) => s + pg.placements.reduce((a, p) => a + p.inst.geom.area, 0), 0);
  S.stats = { stickers: pages.reduce((s, pg) => s + pg.placements.length, 0), usedPct: totalArea ? used / totalArea * 100 : 0, failed };
  $('sheetBusy').style.display = 'none';
  const burst = FX.queue.splice(0).slice(-3);
  const spots = burst.map(b => {
    for (let i = 0; i < S.pages.length; i++) {
      const p = S.pages[i].placements.find(pl => pl.inst.item.id === b.id && pl.inst.k === b.k);
      if (p) return { page: i, p };
    }
    return null;
  }).filter(Boolean);
  if (spots.length) S.pageIdx = spots[spots.length - 1].page;
  renderPreview();
  spots.forEach(sp => { if (sp.page === S.pageIdx) fxConfetti(sp.p); });
}

/* ═══════════════ summary / selection bar / preview ═══════════════ */
const totalQty = () => S.items.reduce((s, i) => s + i.qty, 0);
function selItem() { return S.items.find(i => i.id === S.sel) || null; }

function renderSummary() {
  const box = $('summary'), total = totalQty();
  if (!total) { box.innerHTML = '<div class="st-sum-empty">Nothing yet — tap stickers in the library to add them.</div>'; return; }
  const sizes = S.items.map(i => i.sizeMm);
  const lo = Math.min(...sizes), hi = Math.max(...sizes);
  const sheets = S.pages.length;
  const parts = [
    S.items.length + ' design' + (S.items.length !== 1 ? 's' : ''),
    lo === hi ? 'All ' + lo + ' mm' : 'Mixed ' + lo + '–' + hi + ' mm',
  ];
  if (sheets) parts.push(sheets + ' sheet' + (sheets > 1 ? 's' : ''), Math.round(S.stats.usedPct) + '% used');
  box.innerHTML =
    '<div class="st-sum-line"><b class="n">' + total + '</b><b>sticker' + (total !== 1 ? 's' : '') + '</b>' +
    parts.map(t => '<i class="sep">|</i><span class="dim">' + t + '</span>').join('') + '</div>' +
    '<div class="st-sum-tools"><span class="st-step"><button data-sum="size-" aria-label="Make all smaller">−</button><b>' + (lo === hi ? lo + ' mm' : '···') + '</b><button data-sum="size+" aria-label="Make all bigger">+</button></span>' +
    '<button class="st-link-btn" data-sum="clear" title="Remove all stickers">Clear</button></div>';
}
function renderSelBar() {
  const it = selItem();
  $('selBar').style.display = it ? 'flex' : 'none';
  $('selHint').style.display = it ? 'none' : 'block';
  $('selHint').textContent = S.items.length ? 'Tap a sticker on the sheet to change it' : 'Your sheet is empty';
  $('floatRail').classList.toggle('show', !!it);
  if (!it) return;
  $('railQty').textContent = '×' + it.qty;
  $('railSize').textContent = it.sizeMm + 'mm';
  $('railMinus').textContent = it.qty <= 1 ? '×' : '−';
  $('selImg').src = it.src;
  $('selQty').textContent = it.qty;
  $('selSize').textContent = it.sizeMm + ' mm';
  $('selQtyMinus').textContent = it.qty <= 1 ? '×' : '−';
  $('selQtyMinus').title = it.qty <= 1 ? 'Remove this sticker' : 'Fewer copies';
}
function refreshUI() {
  updateBadges(); renderSummary(); renderSelBar();
  $('sheetEmpty').style.display = S.items.length ? 'none' : 'flex';
}
function renderPreview() {
  $('sheetEmpty').style.display = S.items.length ? 'none' : 'flex';
  $('sheetTabs').innerHTML = S.pages.length > 1
    ? S.pages.map((_, i) => '<button class="st-chip' + (i === S.pageIdx ? ' active' : '') + '" data-page="' + i + '">Sheet ' + (i + 1) + '</button>').join('') : '';
  const warn = [];
  if (S.oversize.length) warn.push(S.oversize.length + ' sticker' + (S.oversize.length > 1 ? 's are' : ' is') + ' too big for A4 — tap it and make it smaller.');
  if (S.stats.failed) warn.push(S.stats.failed + ' image' + (S.stats.failed > 1 ? 's' : '') + ' couldn’t be loaded.');
  $('sheetWarn').innerHTML = warn.map(w => '<div class="st-warn">' + esc(w) + '</div>').join('');
  const ac = $('adminCount'); if (ac) ac.textContent = S.pages.length;
  renderSummary(); renderSelBar();
  drawSheetPreview();
}
function drawSheetPreview() {
  const cv = $('sheetCanvas'), ppmm = 5;
  cv.width = Math.round(PAGE_W * ppmm); cv.height = Math.round(PAGE_H * ppmm);
  const page = S.pages[S.pageIdx] || { placements: [] };   // an empty sheet is the starting screen
  drawPage(cv.getContext('2d'), page, ppmm, 'preview', { showCut: S.settings.showCut, margin: S.settings.margin, selId: S.sel });
}
// keep the whole A4 sheet visible in whatever space the pop-up leaves it
function fitPaper() {
  const r = $('paperArea').getBoundingClientRect(), pad = 12;
  const maxW = r.width - pad * 2, maxH = r.height - pad * 2 - (S.pages.length > 1 ? 22 : 0);
  if (maxW < 40 || maxH < 40) return;
  const w = Math.min(maxW, maxH * PAGE_W / PAGE_H), cv = $('sheetCanvas');
  cv.style.width = w + 'px'; cv.style.height = (w * PAGE_H / PAGE_W) + 'px';
}
// which sticker is under a click/tap on the preview canvas?
function hitTest(ev) {
  const pg = S.pages[S.pageIdx]; if (!pg) return null;
  const r = $('sheetCanvas').getBoundingClientRect();
  const X = (ev.clientX - r.left) / r.width * PAGE_W, Y = (ev.clientY - r.top) / r.height * PAGE_H;
  for (let i = pg.placements.length - 1; i >= 0; i--) {
    const p = pg.placements[i], m = placementMatrix(p);
    const x = p.rot ? Y - m[5] : X - m[4], y = p.rot ? m[4] - X : Y - m[5];
    if (p.inst.geom.cuts.some(poly => pointInPoly([x, y], poly))) return p.inst.item.id;
  }
  return null;
}

/* ═══════════════ little animations: confetti when added, poof when removed ═══════════════ */
const FX = { parts: [], raf: 0, last: 0, queue: [] };
const FX_COLORS = ['#FF6F91', '#8FAE7C', '#FFC857', '#6EC5FF', '#B79CFF', '#FF9F6B'];
const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
// a placement's centre + rough radius, in CSS px of the preview canvas
function fxSpot(p) {
  const r = $('sheetCanvas').getBoundingClientRect(), g = p.inst.geom;
  const w = p.rot ? g.h : g.w, h = p.rot ? g.w : g.h;
  return { x: (p.x + w / 2) / PAGE_W * r.width, y: (p.y + h / 2) / PAGE_H * r.height, r: Math.max(w, h) / PAGE_W * r.width / 2 };
}
function fxPrepare() {
  const cv = $('sheetCanvas'), fx = $('fxCanvas'), r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  fx.style.left = cv.offsetLeft + 'px'; fx.style.top = cv.offsetTop + 'px';
  fx.style.width = r.width + 'px'; fx.style.height = r.height + 'px';
  if (fx.width !== Math.round(r.width * d)) { fx.width = Math.round(r.width * d); fx.height = Math.round(r.height * d); }
  fx.getContext('2d').setTransform(d, 0, 0, d, 0, 0);
  return fx;
}
function fxConfetti(p) {
  if (reducedMotion() || !p) return;
  fxPrepare();
  const { x, y, r } = fxSpot(p);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 190;
    FX.parts.push({ kind: 'conf', x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, w: 4 + Math.random() * 4, h: 2.5 + Math.random() * 3, c: FX_COLORS[i % FX_COLORS.length], life: 0, max: 0.8 + Math.random() * 0.45 });
  }
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2, d = r * (0.3 + Math.random() * 0.85);
    FX.parts.push({ kind: 'star', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: 0, vy: -14, s: 5 + Math.random() * 6, c: i % 2 ? '#FFC857' : '#fff', life: -Math.random() * 0.25, max: 0.55 + Math.random() * 0.2 });
  }
  fxRun();
}
function fxPoof(p) {
  if (reducedMotion() || !p) return;
  fxPrepare();
  const { x, y, r } = fxSpot(p), base = Math.max(10, r * 0.55);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5, d = r * (0.15 + Math.random() * 0.55);
    FX.parts.push({ kind: 'puff', x: x + Math.cos(a) * d * 0.4, y: y + Math.sin(a) * d * 0.4, vx: Math.cos(a) * d * 1.6, vy: Math.sin(a) * d * 1.6 - 12,
      r0: base * (0.55 + Math.random() * 0.35), grow: 1.1 + Math.random() * 0.6, life: 0, max: 0.55 + Math.random() * 0.15 });
  }
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    FX.parts.push({ kind: 'star', x: x + Math.cos(a) * r * 0.6, y: y + Math.sin(a) * r * 0.6, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, s: 3 + Math.random() * 3, c: '#fff', life: 0, max: 0.45 });
  }
  fxRun();
}
function fxRun() { if (!FX.raf) { FX.last = performance.now(); FX.raf = requestAnimationFrame(fxTick); } }
function fxTick(now) {
  const fx = $('fxCanvas'), ctx = fx.getContext('2d'), dt = Math.min(0.05, (now - FX.last) / 1000);
  FX.last = now;
  ctx.clearRect(0, 0, fx.width, fx.height);
  FX.parts = FX.parts.filter(q => (q.life += dt) < q.max);
  FX.parts.forEach(q => {
    if (q.life < 0) return;
    const t = q.life / q.max;
    q.x += (q.vx || 0) * dt; q.y += (q.vy || 0) * dt;
    if (q.kind === 'conf') {
      q.vy += 520 * dt; q.vx *= 0.985; q.rot += q.vr * dt;
      ctx.save(); ctx.globalAlpha = 1 - t * t; ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.c; ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); ctx.restore();
    } else if (q.kind === 'star') {
      const sz = q.s * (t < 0.5 ? t * 2 : 2 - t * 2) + 0.5;
      ctx.save(); ctx.globalAlpha = 0.95; ctx.translate(q.x, q.y); ctx.fillStyle = q.c; ctx.shadowColor = 'rgba(255,160,60,.7)'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(0, -sz); ctx.quadraticCurveTo(0, 0, sz, 0); ctx.quadraticCurveTo(0, 0, 0, sz); ctx.quadraticCurveTo(0, 0, -sz, 0); ctx.quadraticCurveTo(0, 0, 0, -sz); ctx.fill(); ctx.restore();
    } else { // puff
      q.vx *= 0.94; q.vy *= 0.94;
      const rad = q.r0 * (1 + q.grow * t), a = 1 - t;
      ctx.save(); ctx.globalAlpha = a * 0.95;
      const g = ctx.createRadialGradient(q.x - rad * 0.25, q.y - rad * 0.3, rad * 0.1, q.x, q.y, rad);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgba(214,220,228,0.9)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(120,130,145,.35)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    }
  });
  if (FX.parts.length) FX.raf = requestAnimationFrame(fxTick);
  else { FX.raf = 0; ctx.clearRect(0, 0, fx.width, fx.height); }
}
// poof for the copy that is about to disappear (it is still on the current sheet at this point)
function poofCopy(it, k) {
  const pg = S.pages[S.pageIdx]; if (!pg) return;
  fxPoof(pg.placements.find(pl => pl.inst.item.id === it.id && pl.inst.k === k));
}
function poofAll() {
  const pg = S.pages[S.pageIdx]; if (!pg) return;
  pg.placements.slice(0, 40).forEach((pl, i) => setTimeout(() => fxPoof(pl), i * 25));
}

/* ═══════════════ editing the sheet ═══════════════ */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function addItem(src, label) {
  if (totalQty() >= MAX_INSTANCES) { alert('That’s the most stickers we can fit in one order (' + MAX_INSTANCES + ').'); return; }
  let it = S.items.find(i => i.src === src);
  if (it) { if (it.qty >= 99) return; it.qty++; }
  else { it = { id: nextId++, src, label, sizeMm: 40, qty: 1 }; S.items.push(it); }
  S.sel = it.id;
  FX.queue.push({ id: it.id, k: it.qty - 1 });
  refreshUI(); scheduleBuild();
}
function changeQty(it, d) {
  if (d > 0 && totalQty() >= MAX_INSTANCES) return;
  if (d < 0) poofCopy(it, it.qty - 1);
  it.qty += d;
  if (d > 0) FX.queue.push({ id: it.id, k: it.qty - 1 });
  if (it.qty <= 0) { S.items = S.items.filter(i => i !== it); if (S.sel === it.id) S.sel = null; }
  refreshUI(); scheduleBuild();
}
function changeSize(it, d) { it.sizeMm = clamp(it.sizeMm + d, 10, 190); refreshUI(); scheduleBuild(); }

/* ═══════════════ own-image upload ═══════════════ */
function addImageBlob(blob, name) {
  if (!blob || !/^image\//.test(blob.type)) return;
  const fr = new FileReader();
  fr.onload = () => {
    const im = new Image();
    im.onload = () => {
      const max = 900, sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.round(im.naturalWidth * sc); cv.height = Math.round(im.naturalHeight * sc);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      addItem(cv.toDataURL('image/png'), (name || 'My image').replace(/\.[^.]+$/, ''));
    };
    im.src = fr.result;
  };
  fr.readAsDataURL(blob);
}
function handleUpload(file) { addImageBlob(file, file && file.name); }

// Same idea as the pin designer's paste button: grabs a photo the customer copied
// (e.g. long-press → Copy on a phone). Must run straight from a tap; not every
// browser can read images off the clipboard, so every failure says what to do.
async function pasteFromClipboard() {
  if (!navigator.clipboard || !navigator.clipboard.read) {
    alert("Paste isn't supported in this browser yet — use Upload instead.");
    return;
  }
  let items;
  try { items = await navigator.clipboard.read(); }
  catch (e) {
    alert("Couldn't access your clipboard. Copy a photo first (press and hold it, then Copy), then tap Paste again — your browser may also ask permission first.");
    return;
  }
  const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  for (const item of items) {
    const type = item.types.find(t => TYPES.includes(t));
    if (type) { addImageBlob(await item.getType(type), 'Pasted photo'); return; }
  }
  alert('No photo found on your clipboard — copy one first, then tap Paste.');
}

/* ═══════════════ ADMIN ONLY ═══════════════
   Nothing below is reachable unless Firebase Auth reports a signed-in admin:
   - the admin DOM is only built after that check (it is not in the HTML),
   - every admin action re-checks the live sign-in (guard()) before it runs,
   - this whole file runs inside a closure, so none of these functions are
     callable from the browser console,
   - and the only thing that persists (library access) is protected by the
     Firestore rule on morphii_config (admin emails only) — the real lock.
   The clean, un-watermarked renders are drawn locally from the same public
   library images, so the guard there is a convenience, not a secret. */
let TEST_ADMIN = false;   // only ever set by the localhost test hook at the bottom
function isAdminNow() {
  if (TEST_ADMIN) return true;
  try { const u = AUTH && AUTH.currentUser; return !!(u && isAdmin(u)); } catch (e) { return false; }
}
function guard() { if (!isAdminNow()) throw new Error('Admin sign-in required'); }

const ADMIN_HTML =
  '<div class="st-admin">' +
  '<span class="st-label">Admin · library customers can use</span>' +
  '<p class="st-sub" style="margin-bottom:8px;">Tick the groups customers can use. Saved for everyone.</p>' +
  '<div id="adminLib" class="st-admin-lib"></div>' +
  '<div class="st-row"><button class="st-btn" id="libSave">Save library access</button><span class="st-mini" id="libSaveMsg"></span></div>' +
  '<span class="st-label" style="margin-top:6px;">Admin · clean production files (<span id="adminCount">0</span> sheet)</span>' +
  '<div class="st-row"><button class="st-btn" data-exp="print">Print PNG (transparent)</button><button class="st-btn ghost" data-exp="proof">Proof PNG + cut line</button><button class="st-btn ghost" data-exp="svg">Cut line SVG</button></div>' +
  '</div>';

function mountAdmin() {
  if (!isAdminNow()) return;
  $('pane-admin').innerHTML = ADMIN_HTML;
  renderAdminLib(); renderPreview();
}
function unmountAdmin() { $('pane-admin').innerHTML = ''; if (S.panel === 'admin') closePanel(); }
function applyAuth() {
  const admin = isAdminNow();
  if (admin === LIB.isAdmin && admin === !!$('pane-admin').firstChild) return;
  LIB.isAdmin = admin;
  if (admin) mountAdmin(); else unmountAdmin();
  if (Object.keys(LIB.sets).length) { renderLibrary(); }
}
// one tick box per group of the main library, plus select all
function renderAdminLib() {
  const box = $('adminLib'); if (!box || !isAdminNow()) return;
  const cats = allCategories(true);
  box.innerHTML = '<label class="st-admin-all"><input type="checkbox" data-parent> Select all groups <span class="st-mini">(' + cats.length + ')</span></label>' +
    '<div class="st-admin-cats">' +
    cats.map(c => '<label><input type="checkbox" data-key="' + esc(c.key) + '"' + (LIB.hidden.has(c.key) ? '' : ' checked') + '> ' + esc(c.shown) + '</label>').join('') +
    '</div>';
  syncParents();
}
function syncParents() {
  const p = document.querySelector('#adminLib input[data-parent]'); if (!p) return;
  const kids = [...document.querySelectorAll('#adminLib [data-key]')];
  const on = kids.filter(k => k.checked).length;
  p.checked = on === kids.length; p.indeterminate = on > 0 && on < kids.length;
}
async function saveLibraryAccess() {
  const msg = $('libSaveMsg');
  try {
    guard();
    const hidden = [...document.querySelectorAll('#adminLib [data-key]')].filter(k => !k.checked).map(k => k.dataset.key);
    msg.textContent = 'Saving…';
    await saveStickerLibrary({ hidden });
    LIB.hidden = new Set(hidden); msg.textContent = 'Saved ✓';
    renderLibrary();
  } catch (err) {
    msg.textContent = err.message === 'Admin sign-in required' ? err.message
      : 'Couldn’t save — are the Firestore rules published? (' + (err.code || err.message) + ')';
  }
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function exportFiles(kind) {
  guard();
  if (kind === 'svg') {
    S.pages.forEach((pg, i) => download(new Blob([pageSvg(pg)], { type: 'image/svg+xml' }), 'sticker-sheet-' + (i + 1) + '-cutline.svg'));
    return;
  }
  S.pages.forEach((pg, i) => {
    const cv = document.createElement('canvas');
    cv.width = Math.round(PAGE_W * EXPORT_PPMM); cv.height = Math.round(PAGE_H * EXPORT_PPMM);
    drawPage(cv.getContext('2d'), pg, EXPORT_PPMM, kind);
    cv.toBlob(b => download(b, 'sticker-sheet-' + (i + 1) + (kind === 'proof' ? '-proof' : '-print') + '.png'));
  });
}

/* ═══════════════ wiring ═══════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // phone: the cut line is shown from the start; desktop starts without it
  S.settings.showCut = !DESKTOP.matches; $('setShowCut').checked = S.settings.showCut;
  const border = $('setBorder');
  const setBorderTxt = () => { $('setBorderVal').textContent = S.settings.border + ' mm'; };
  border.addEventListener('input', () => { S.settings.border = +border.value; setBorderTxt(); scheduleBuild(); });
  setBorderTxt();
  $('setShowCut').addEventListener('change', e => { S.settings.showCut = e.target.checked; drawSheetPreview(); });
  $('styleChips').addEventListener('click', e => {
    const b = e.target.closest('[data-style]'); if (!b) return;
    S.settings.style = b.dataset.style;
    document.querySelectorAll('#styleChips [data-style]').forEach(c => c.classList.toggle('active', c === b));
    $('borderRow').style.display = S.settings.style === 'none' ? 'none' : '';
    scheduleBuild();
  });

  // library menu (bottom) + pop-up
  $('libCats').addEventListener('click', e => {
    if (e.target.closest('[data-act="paste"]')) { pasteFromClipboard(); return; }
    const tool = e.target.closest('[data-panel]');
    if (tool) {
      const n = tool.dataset.panel;
      if (n === 'admin' && !isAdminNow()) return;
      S.panel === n ? closePanel() : openPanel(n);
      return;
    }
    const g = e.target.closest('[data-cat]'); if (!g) return;
    if (S.panel === 'lib' && LIB.category === g.dataset.cat) { closePanel(); return; }
    LIB.category = g.dataset.cat; openPanel('lib');
  });
  $('panelClose').addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.panel) closePanel(); });
  $('libGrid').addEventListener('click', e => {
    const it = e.target.closest('.st-lib-item'); if (!it) return;
    addItem(it.dataset.src, it.dataset.label);
  });
  $('uploadInput').addEventListener('change', e => { handleUpload(e.target.files[0]); e.target.value = ''; });

  // tap a sticker on the sheet
  $('sheetCanvas').addEventListener('click', e => {
    S.sel = hitTest(e); renderSelBar(); drawSheetPreview();
  });
  const onSelClick = e => {
    const b = e.target.closest('[data-sel]'); if (!b) return;
    const it = selItem(); if (!it) return;
    const a = b.dataset.sel;
    if (a === 'qty+') changeQty(it, 1);
    else if (a === 'qty-') changeQty(it, -1);
    else if (a === 'size+') changeSize(it, 5);
    else if (a === 'size-') changeSize(it, -5);
  };
  $('selBar').addEventListener('click', onSelClick);
  $('floatRail').addEventListener('click', onSelClick);
  $('summary').addEventListener('click', e => {
    const b = e.target.closest('[data-sum]'); if (!b) return;
    const a = b.dataset.sum;
    if (a === 'clear') { poofAll(); S.items = []; S.sel = null; FX.queue.length = 0; refreshUI(); scheduleBuild(); return; }
    const d = a === 'size+' ? 5 : -5;
    S.items.forEach(i => { i.sizeMm = clamp(i.sizeMm + d, 10, 190); });
    refreshUI(); scheduleBuild();
  });
  $('sheetTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-page]'); if (!b) return;
    S.pageIdx = +b.dataset.page; renderPreview();
  });

  // admin (delegated; each handler re-checks admin status)
  $('pane-admin').addEventListener('change', e => {
    const t = e.target;
    if (!t.closest('#adminLib')) return;
    if (t.hasAttribute('data-parent')) document.querySelectorAll('#adminLib [data-key]').forEach(k => { k.checked = t.checked; });
    syncParents();
  });
  $('pane-admin').addEventListener('click', e => {
    if (e.target.id === 'libSave') { saveLibraryAccess(); return; }
    const b = e.target.closest('[data-exp]');
    if (b) { try { exportFiles(b.dataset.exp); } catch (err) { /* not an admin */ } }
  });

  $('fabPaste').addEventListener('click', pasteFromClipboard);
  document.addEventListener('paste', e => {   // Ctrl/Cmd+V with a copied image
    const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(x => /^image\//.test(x.type));
    if (f) { e.preventDefault(); addImageBlob(f, 'Pasted photo'); }
  });
  const onLayout = () => { if (DESKTOP.matches && !S.panel && LIB.category) openPanel('lib'); fitPaper(); };
  if (DESKTOP.addEventListener) DESKTOP.addEventListener('change', onLayout); else DESKTOP.addListener(onLayout);
  if ('ResizeObserver' in window) new ResizeObserver(fitPaper).observe($('paperArea'));
  window.addEventListener('resize', fitPaper);
  refreshUI(); renderLibrary(); fitPaper(); drawSheetPreview();
  loadLibrary();
  if (typeof AUTH !== 'undefined' && AUTH) AUTH.onAuthStateChanged(applyAuth);

  // localhost-only test hook — absent on the live site
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    window.__stTest = { S, LIB, becomeAdmin() { TEST_ADMIN = true; applyAuth(); }, stopAdmin() { TEST_ADMIN = false; applyAuth(); } };
  }
});
})();
