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
const COLLECTIONS = [
  ['shared', 'Main library'], ['election', 'Election'], ['ph-souvenir', 'PH Souvenir'],
  ['wedding', 'Wedding'], ['in-loving-memory', 'In Loving Memory'],
];
const OTHER_CATS = [
  ['shapes', 'Shapes'], ['wordart', 'Text art'], ['characters', 'Characters'],
  ['borders', 'Borders'], ['background', 'Backgrounds'], ['letters', 'Letters'],
];
const STICKER_LOGO_RE = /^logo\.[^.]+$/i;

/* ── state ─────────────────────────────────────────────────── */
const S = {
  items: [],            // { id, src, label, sizeMm, qty }
  settings: { style: 'contour', border: 3, gap: 0.5, margin: 5, spacing: 2, rotate: true, showCut: true },  // gap/margin/spacing are fixed (no UI)
  pages: [],            // [{ placements:[{inst,x,y,rot}] }]
  oversize: [],
  pageIdx: 0,
  stats: { stickers: 0, usedPct: 0 },
};
let LIB = { sets: {}, order: {}, collection: 'shared', category: null, hidden: new Set(), isAdmin: false };
let nextId = 1;
let buildGen = 0;
let buildTimer = null;
const IMG_CACHE = {};     // src -> Promise<HTMLImageElement>
const FIELD_CACHE = {};   // src|size -> Promise<field record>

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
  refreshCollections();
  renderLibrary();
  renderAdminLib();
}
function refreshCollections() {
  const usable = COLLECTIONS.filter(([id]) => stickerCategories(id).length);
  $('libCollection').innerHTML = usable.map(([id, label]) => '<option value="' + id + '">' + esc(label) + '</option>').join('');
  $('libCollection').style.display = usable.length > 1 ? '' : 'none';
  if (!usable.find(([id]) => id === LIB.collection) && usable.length) LIB.collection = usable[0][0];
  $('libCollection').value = LIB.collection;
}
// admin: tick/untick which collections and categories customers can use
function renderAdminLib() {
  const box = $('adminLib'); if (!box) return;
  box.innerHTML = COLLECTIONS.map(([id, label]) => {
    const cats = stickerCategories(id, true);
    if (!cats.length) return '';
    return '<details><summary><input type="checkbox" data-coll="' + id + '"> ' + esc(label) + ' <span class="st-mini">(' + cats.length + ')</span></summary><div class="st-admin-cats">' +
      cats.map(c => '<label><input type="checkbox" data-key="' + esc(c.key) + '"' + (LIB.hidden.has(c.key) ? '' : ' checked') + '> ' + esc(c.label) + '</label>').join('') +
      '</div></details>';
  }).join('');
  box.querySelectorAll('[data-coll]').forEach(syncCollBox);
}
function syncCollBox(cb) {
  const kids = [...cb.closest('details').querySelectorAll('[data-key]')];
  const on = kids.filter(k => k.checked).length;
  cb.checked = on === kids.length; cb.indeterminate = on > 0 && on < kids.length;
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
function renderLibrary() {
  const cats = stickerCategories(LIB.collection, LIB.isAdmin);
  if (!cats.find(c => c.id === LIB.category)) LIB.category = cats.length ? cats[0].id : null;
  $('libCats').innerHTML = cats.map(c =>
    '<button class="st-chip' + (c.id === LIB.category ? ' active' : '') + '" data-cat="' + esc(c.id) + '">' + esc(c.label) + '</button>').join('');
  const cat = cats.find(c => c.id === LIB.category);
  if (!cat) { $('libGrid').innerHTML = '<div class="st-empty">Nothing here yet.</div>'; return; }
  const items = cat.items.slice().sort((a, b) =>
    (STICKER_LOGO_RE.test(b.name) ? 1 : 0) - (STICKER_LOGO_RE.test(a.name) ? 1 : 0) || a.label.localeCompare(b.label));
  $('libGrid').innerHTML = items.map((it, i) =>
    '<div class="st-lib-item" data-src="' + esc(it.src) + '" data-label="' + esc(it.label) + '" title="' + esc(it.label) + '"><img loading="lazy" src="' + esc(it.src) + '" alt="' + esc(it.label) + '"></div>').join('');
  updateBadges();
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
    for (let k = 0; k < item.qty && instances.length < MAX_INSTANCES; k++) instances.push({ item, geom });
  }
  if (gen !== buildGen) return;
  const { pages, oversize } = layoutPages(instances, st);
  S.pages = pages; S.oversize = oversize;
  if (S.pageIdx >= pages.length) S.pageIdx = Math.max(0, pages.length - 1);
  const totalArea = pages.length * PAGE_W * PAGE_H;
  const used = pages.reduce((s, pg) => s + pg.placements.reduce((a, p) => a + p.inst.geom.area, 0), 0);
  S.stats = { stickers: pages.reduce((s, pg) => s + pg.placements.length, 0), usedPct: totalArea ? used / totalArea * 100 : 0, failed };
  $('sheetBusy').style.display = 'none';
  renderPreview();
}
function renderPreview() {
  const hasItems = S.items.length > 0;
  $('sheetEmpty').style.display = hasItems && S.pages.length ? 'none' : 'block';
  $('sheetEmpty').textContent = hasItems ? (S.oversize.length ? 'Nothing fits on a sheet — try a smaller size.' : 'Preparing…') : 'Pick stickers from the library and they’ll be arranged here automatically.';
  $('sheetWrap').style.display = hasItems && S.pages.length ? 'block' : 'none';
  $('sheetTabs').innerHTML = S.pages.length > 1
    ? S.pages.map((_, i) => '<button class="st-chip' + (i === S.pageIdx ? ' active' : '') + '" data-page="' + i + '">Sheet ' + (i + 1) + '</button>').join('') : '';
  const warn = [];
  if (S.oversize.length) warn.push(S.oversize.length + ' sticker' + (S.oversize.length > 1 ? 's are' : ' is') + ' too big for an A4 sheet with these margins and were left out — reduce their size.');
  if (S.stats.failed) warn.push(S.stats.failed + ' image' + (S.stats.failed > 1 ? 's' : '') + ' couldn’t be loaded.');
  const total = S.items.reduce((s, i) => s + i.qty, 0);
  if (total > MAX_INSTANCES) warn.push('Limit is ' + MAX_INSTANCES + ' stickers per order; extras were ignored.');
  $('sheetWarn').innerHTML = warn.map(w => '<div class="st-warn">' + esc(w) + '</div>').join('');
  $('sheetStats').textContent = S.pages.length
    ? S.pages.length + ' sheet' + (S.pages.length > 1 ? 's' : '') + ' · ' + S.stats.stickers + ' sticker' + (S.stats.stickers !== 1 ? 's' : '') + ' · ' + S.stats.usedPct.toFixed(0) + '% of paper used'
    : '';
  $('adminCount').textContent = S.pages.length;
  if (!S.pages.length) return;
  const cv = $('sheetCanvas'), ppmm = 4;
  cv.width = Math.round(PAGE_W * ppmm); cv.height = Math.round(PAGE_H * ppmm);
  drawPage(cv.getContext('2d'), S.pages[S.pageIdx], ppmm, 'preview', { showCut: S.settings.showCut, margin: S.settings.margin });
}

/* ═══════════════ tray ═══════════════ */
function addItem(src, label) {
  const existing = S.items.find(i => i.src === src);
  if (existing) { existing.qty = Math.min(99, existing.qty + 1); }
  else S.items.push({ id: nextId++, src, label, sizeMm: 40, qty: 1 });
  renderTray(); scheduleBuild();
}
function renderTray() {
  updateBadges();
  const box = $('trayList');
  if (!S.items.length) { box.innerHTML = '<div class="st-empty">No stickers selected yet. Tap one in the library above.</div>'; $('trayCount').textContent = ''; return; }
  box.innerHTML = S.items.map(it =>
    '<div class="st-tray-row" data-id="' + it.id + '">' +
    '<div class="st-tray-thumb"><img src="' + esc(it.src) + '" alt=""></div>' +
    '<div class="st-tray-main"><div class="st-tray-name">' + esc(it.label) + '</div>' +
    '<div class="st-tray-fields">' +
    '<span class="st-mini">Size (mm)</span><span class="st-step"><button data-act="size-" aria-label="Smaller">−</button><input data-f="sizeMm" type="number" min="10" max="190" value="' + it.sizeMm + '"><button data-act="size+" aria-label="Bigger">+</button></span>' +
    '<span class="st-mini">Qty</span><span class="st-step"><button data-act="qty-" aria-label="Fewer">−</button><input data-f="qty" type="number" min="1" max="99" value="' + it.qty + '"><button data-act="qty+" aria-label="More">+</button></span>' +
    '</div></div>' +
    '<button class="st-remove" data-act="remove" title="Remove">×</button></div>').join('');
  $('trayCount').textContent = S.items.reduce((s, i) => s + i.qty, 0) + ' stickers';
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ═══════════════ own-image upload ═══════════════ */
function handleUpload(file) {
  if (!file || !/^image\//.test(file.type)) return;
  const fr = new FileReader();
  fr.onload = () => {
    const im = new Image();
    im.onload = () => {
      const max = 900, sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.round(im.naturalWidth * sc); cv.height = Math.round(im.naturalHeight * sc);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      addItem(cv.toDataURL('image/png'), (file.name || 'My image').replace(/\.[^.]+$/, ''));
    };
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
}

/* ═══════════════ admin export ═══════════════ */
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function exportPng(mode) {
  S.pages.forEach((pg, i) => {
    const cv = document.createElement('canvas');
    cv.width = Math.round(PAGE_W * EXPORT_PPMM); cv.height = Math.round(PAGE_H * EXPORT_PPMM);
    drawPage(cv.getContext('2d'), pg, EXPORT_PPMM, mode);
    cv.toBlob(b => download(b, 'sticker-sheet-' + (i + 1) + (mode === 'proof' ? '-proof' : '-print') + '.png'));
  });
}
function exportSvg() {
  S.pages.forEach((pg, i) => download(new Blob([pageSvg(pg)], { type: 'image/svg+xml' }), 'sticker-sheet-' + (i + 1) + '-cutline.svg'));
}

/* ═══════════════ wiring ═══════════════ */
function bindSetting(id, key, parse, outId, fmt) {
  const el = $(id);
  const apply = () => {
    S.settings[key] = parse(el);
    if (outId) $(outId).textContent = fmt(S.settings[key]);
    scheduleBuild();
  };
  el.addEventListener('input', apply);
  if (outId) $(outId).textContent = fmt(S.settings[key]);
}

document.addEventListener('DOMContentLoaded', () => {
  bindSetting('setBorder', 'border', e => +e.value, 'setBorderVal', v => v + ' mm');
  bindSetting('setRotate', 'rotate', e => e.checked);
  $('setShowCut').addEventListener('change', e => { S.settings.showCut = e.target.checked; renderPreview(); });

  $('styleChips').addEventListener('click', e => {
    const b = e.target.closest('[data-style]'); if (!b) return;
    S.settings.style = b.dataset.style;
    document.querySelectorAll('#styleChips .st-chip').forEach(c => c.classList.toggle('active', c === b));
    $('borderRow').style.display = S.settings.style === 'none' ? 'none' : '';
    scheduleBuild();
  });

  $('libCollection').addEventListener('change', e => { LIB.collection = e.target.value; LIB.category = null; renderLibrary(); });
  $('libCats').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    LIB.category = b.dataset.cat; renderLibrary();
  });
  $('libGrid').addEventListener('click', e => {
    const it = e.target.closest('.st-lib-item'); if (!it) return;
    addItem(it.dataset.src, it.dataset.label);
  });
  $('uploadInput').addEventListener('change', e => { handleUpload(e.target.files[0]); e.target.value = ''; });

  const tray = $('trayList');
  tray.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const row = btn.closest('.st-tray-row'); const it = S.items.find(i => i.id === +row.dataset.id); if (!it) return;
    const act = btn.dataset.act;
    if (act === 'remove') { S.items = S.items.filter(i => i !== it); renderTray(); }
    else {
      if (act === 'size-') it.sizeMm = clamp(it.sizeMm - 5, 10, 190);
      if (act === 'size+') it.sizeMm = clamp(it.sizeMm + 5, 10, 190);
      if (act === 'qty-') it.qty = clamp(it.qty - 1, 1, 99);
      if (act === 'qty+') it.qty = clamp(it.qty + 1, 1, 99);
      row.querySelector('[data-f="sizeMm"]').value = it.sizeMm;
      row.querySelector('[data-f="qty"]').value = it.qty;
      $('trayCount').textContent = S.items.reduce((s, i) => s + i.qty, 0) + ' stickers';
      updateBadges();
    }
    scheduleBuild();
  });
  tray.addEventListener('input', e => {
    const f = e.target.dataset.f; if (!f) return;
    const row = e.target.closest('.st-tray-row'); const it = S.items.find(i => i.id === +row.dataset.id); if (!it) return;
    const v = parseFloat(e.target.value); if (!isFinite(v)) return;
    if (f === 'sizeMm') it.sizeMm = clamp(Math.round(v), 10, 190);
    if (f === 'qty') it.qty = clamp(Math.round(v), 1, 99);
    $('trayCount').textContent = S.items.reduce((s, i) => s + i.qty, 0) + ' stickers';
    updateBadges();
    scheduleBuild();
  });
  $('sizeAll').addEventListener('click', () => {
    const v = clamp(parseInt($('sizeAllVal').value, 10) || 40, 10, 190);
    S.items.forEach(i => i.sizeMm = v); renderTray(); scheduleBuild();
  });
  $('clearAll').addEventListener('click', () => { S.items = []; renderTray(); scheduleBuild(); });
  $('sheetTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-page]'); if (!b) return;
    S.pageIdx = +b.dataset.page; renderPreview();
  });

  $('adminLib').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.coll) { t.closest('details').querySelectorAll('[data-key]').forEach(k => { k.checked = t.checked; }); }
    else if (t.dataset.key) syncCollBox(t.closest('details').querySelector('[data-coll]'));
  });
  $('libSave').addEventListener('click', async () => {
    const hidden = [...document.querySelectorAll('#adminLib [data-key]')].filter(k => !k.checked).map(k => k.dataset.key);
    const msg = $('libSaveMsg'); msg.textContent = 'Saving…';
    try {
      await saveStickerLibrary({ hidden });
      LIB.hidden = new Set(hidden); msg.textContent = 'Saved ✓';
      refreshCollections(); renderLibrary();
    } catch (err) { msg.textContent = 'Couldn’t save — are the Firestore rules published? (' + (err.code || err.message) + ')'; }
  });

  $('expPrint').addEventListener('click', () => exportPng('print'));
  $('expProof').addEventListener('click', () => exportPng('proof'));
  $('expSvg').addEventListener('click', exportSvg);

  renderTray();
  loadLibrary();
  if (typeof AUTH !== 'undefined' && AUTH) {
    AUTH.onAuthStateChanged(u => {
      const admin = !!(u && isAdmin(u));
      $('adminPanel').classList.toggle('show', admin);
      if (admin !== LIB.isAdmin) { LIB.isAdmin = admin; if (Object.keys(LIB.sets).length) { refreshCollections(); renderLibrary(); } }
    });
  }
});
