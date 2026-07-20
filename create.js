/* ═══════════════════════════════════════════════
   MORPHII CREATE — Online Custom Pin Designer
   ═══════════════════════════════════════════════ */

const PRODUCTS = [
  { id:'lapel-pin',    label:'Lapel Pins',              icon:'📌', enabled:true },
  { id:'challenge-coin', label:'Challenge Coins',        icon:'🪙', enabled:true },
  { id:'medal',        label:'Medals',                  icon:'🏅', enabled:true },
  { id:'golf-marker',  label:'Golf Ball Markers',        icon:'⛳', enabled:true },
  { id:'patch',        label:'Patches',                 icon:'🧵', enabled:false },
  { id:'keychain',     label:'Keychains',                icon:'🔑', enabled:false },
  { id:'ai-marker',    label:'AI Ball Marker Generator', icon:'🤖', enabled:false },
  { id:'lanyard',      label:'Lanyards & ID Badges',     icon:'🪪', enabled:false },
  { id:'belt-buckle',  label:'Belt Buckles',             icon:'🎗️', enabled:false },
  { id:'luggage-tag',  label:'Luggage Tags',             icon:'🏷️', enabled:false },
];

// Standard badge-making sizes — mm (finished/cut diameter) + paperMM (the
// full print/PVC-wrap sheet diameter, incl. bleed) per the supplier's size
// chart. Paper size is a fixed property of each size now, not a customer
// choice (see the removed Print Settings step).
const SIZES = [
  { mm:25, paperMM:35.2, tag:'Smallest', enabled:true },
  { mm:32, paperMM:44,   tag:'Compact',  enabled:true },
  { mm:37, paperMM:48.8, tag:'Popular',  enabled:true },
  { mm:44, paperMM:56.4, tag:'Standard', enabled:true }, // ⚠ estimated (not legible on the chart) — confirm and update
  { mm:58, paperMM:70,   tag:'Large',    enabled:true },
  { mm:75, paperMM:86.3, tag:'XL',       enabled:true },
];

const STEP_ORDER = ['product','size','design','submit','done'];
const CANVAS_PX   = 480;   // fixed on-screen render resolution
const EXPORT_PPMM = 11.8;  // export resolution for the clean (admin-facing) design, px per mm (~300 DPI)
const FONTS = ['Luckiest Guy','Shrikhand','Carter One','Ceviche One','Kavoon','Cherry Bomb One','Lobster','Spicy Rice','Chicle'];

// Same gradient presets as the kiosk avatar builder (morphii.js CATS.bg.items),
// copied verbatim so both tools offer identical background options.
const GRADIENTS = [
  {label:'Sky Blue',grad:['#87CEEB','#B0E2FF']},
  {label:'Candy',grad:['#FFD6E0','#FFEFBA']},
  {label:'Mint',grad:['#B8F0D8','#D4F5FF']},
  {label:'Lavender',grad:['#E8D5FF','#FFD6F0']},
  {label:'Peach',grad:['#FFD6A5','#FFEFBA']},
  {label:'Lemon',grad:['#FFFACD','#FFF0B3']},
  {label:'Rose',grad:['#FFD6D6','#FFE8E8']},
  {label:'Seafoam',grad:['#B8EDD8','#D8F5EC']},
  {label:'Lilac',grad:['#DDD0FF','#EEE8FF']},
  {label:'Sunrise',grad:['#FFE0B2','#FFCCBC']},
  {label:'Arctic',grad:['#E0F7FA','#B2EBF2']},
  {label:'Blush',grad:['#FCE4EC','#F8BBD0']},
  {label:'Sunset',grad:['#FF9A9E','#FECFEF']},
  {label:'Ocean',grad:['#2193B0','#6DD5FA']},
  {label:'Forest',grad:['#A8E063','#C8F08C']},
  {label:'Grape',grad:['#E0AAFF','#C77DFF']},
  {label:'Coral',grad:['#FF9A76','#FFE0C8']},
  {label:'Aurora',grad:['#A0F0C0','#92FEE0']},
  {label:'Dusk',grad:['#FFD580','#FFE9AA']},
  {label:'Berry',grad:['#FF758C','#FFB3C1']},
  {label:'Dreamy',   grad4:['#FFB3C6','#FFFACD','#E8D5FF','#C8F0E0']},
  {label:'Sunset 4', grad4:['#FFD6A5','#FFB3C6','#FFF0B3','#FECFEF']},
  {label:'Ocean 4',  grad4:['#B3E5FF','#E8D5FF','#B3C6FF','#C8F5EC']},
  {label:'Spring 4', grad4:['#C8F0E0','#FFFACD','#D4F5FF','#FFB3C6']},
  {label:'Twilight', grad4:['#E0AAFF','#FFB3C6','#B3C6FF','#C8F0E0']},
  {label:'Sherbet',  grad4:['#FF9A9E','#FFD166','#87CEEB','#C8F0D8']},
  {label:'Fairy',    grad4:['#EED5FF','#FFD6E0','#FFFACD','#D4F5FF']},
  {label:'Lullaby',  grad4:['#E8D5FF','#B3E5FF','#FFD6E0','#FFFACD']},
];

// Preset libraries — populated at runtime from assets/pins/manifest.json
// (see loadPinAssetManifest below). Uploading your own PNG always works
// regardless of what's in these lists.
const STICKER_PRESETS = [];
const CHARACTER_PRESETS = [];
const SHAPE_PRESETS = [];      // shapes + holders (text banners/badges) — same category
const WORDART_PRESETS = [];    // premade word-art graphics ("BEST MOM" etc.)
const BORDER_PRESETS = [];     // full-circle decorative frame overlays
const BACKGROUND_PRESETS = []; // curated stock background photos

// Sticker/Shape/Word Art are structurally identical placed-image elements
// ({id, img, xFrac, yFrac, scale, rotation, locked}) that only differ in
// which array holds them, which preset gallery feeds them, and their
// dock label/upload wording — so their CRUD is written once and shared.
const PLACED_META = {
  sticker: { label:'Sticker',  uploadNoun:'sticker' },
  shape:   { label:'Shape',    uploadNoun:'shape' },
  wordart: { label:'Word Art', uploadNoun:'word art graphic' },
};
function placedArray(kind){
  if (kind==='sticker') return state.stickers;
  if (kind==='shape') return state.shapes;
  return state.wordArts;
}
function placedPresets(kind){
  if (kind==='sticker') return STICKER_PRESETS;
  if (kind==='shape') return SHAPE_PRESETS;
  return WORDART_PRESETS;
}
function nextPlacedId(kind){
  if (kind==='sticker') return state.nextStickerId++;
  if (kind==='shape') return state.nextShapeId++;
  return state.nextWordArtId++;
}

const state = {
  product: null,
  size: null,       // finished/cut diameter, mm
  paperSize: null,  // full print/PVC-wrap sheet diameter incl. bleed, mm — fixed per size, not a customer choice
  bg: {
    // Color and image are independent layers that can be mixed (color shows
    // through wherever the image doesn't fully cover, or through transparent
    // PNG areas) — each has its own on/off checkbox.
    colorOn:false, color:null,             // one of GRADIENTS
    imageOn:false, img:null, tainted:false, opacity:0.7,
    offsetXFrac:0, offsetYFrac:0, scale:1, locked:false,
  },
  textLines: [],
  stickers: [],             // [{id, img, xFrac, yFrac, scale, rotation}]
  shapes: [],                // same shape as stickers — decorative shapes/holders
  wordArts: [],               // same shape as stickers — premade word-art graphics
  character: null,          // {img, scale, rotation} | null
  border: null,              // {img, src, label} | null — single preset, fixed above background
  nextStickerId: 1,
  nextShapeId: 1,
  nextWordArtId: 1,
  selected: null,           // {kind:'sticker', id} | {kind:'character'} | {kind:'background'} | null
  // Z-order of everything EXCEPT the background and border (which are always
  // fixed at the very back: color, then image, then border, then everything
  // in this list). Index 0 is the back-most of these, the last is front-most.
  layerOrder: [],           // [{kind:'character'}|{kind:'sticker'|'shape'|'wordart', id}|{kind:'text',id}]
  dragging:false, dragTarget:null, dragMode:'move', dragStartX:0, dragStartY:0, dragStartOffX:0, dragStartOffY:0,
  dragStartScale:1, dragStartRotation:0, dragStartDist:0, dragStartAngle:0,
  nextTextId: 1,
};

/* ── Z-ORDER (layerOrder) HELPERS ─────────────────────────────────── */
function pushLayer(descriptor){ state.layerOrder.push(descriptor); }
function removeLayerFromOrder(kind, id){
  state.layerOrder = state.layerOrder.filter(d => !(d.kind===kind && d.id===id));
}
// Topmost-first, for display in the Layers list (reverse of draw/z-order).
function layersVisualList(){ return state.layerOrder.slice().reverse(); }
function setLayersFromVisual(visualList){ state.layerOrder = visualList.slice().reverse(); }

/* ── STEP NAVIGATION ─────────────────────────── */
function goStep(name){
  document.querySelectorAll('.cr-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('step-'+name).classList.add('active');
  const idx = STEP_ORDER.indexOf(name);
  document.querySelectorAll('.cr-step').forEach(el=>{
    const i = STEP_ORDER.indexOf(el.dataset.step);
    el.classList.toggle('active', i===idx);
    el.classList.toggle('done', i<idx && i>=0);
  });
  window.scrollTo({top:0,behavior:'smooth'});
  if (name==='design'){ setupCanvas(); drawPreview(); renderCanvasBgDecor(); updateCanvasBorderRing(); }
  if (name==='submit'){ renderSubmitSummary(); }
}
window.goStep = goStep;

/* ── STEP 1: PRODUCT ─────────────────────────── */
function renderProductGrid(){
  const grid = document.getElementById('productGrid');
  grid.innerHTML = PRODUCTS.map(p=>`
    <div class="cr-product-card ${p.enabled?'':'disabled'}" onclick="${p.enabled?`selectProduct('${p.id}')`:''}">
      ${p.enabled?'':'<div class="cr-product-badge">Coming Soon</div>'}
      <div class="cr-product-icon">${p.icon}</div>
      <div class="cr-product-name">${p.label}</div>
    </div>`).join('');
}
function selectProduct(id){
  const p = PRODUCTS.find(p=>p.id===id);
  if (!p || !p.enabled) return;
  state.product = p;
  renderSizeGrid();
  goStep('size');
}
window.selectProduct = selectProduct;

/* ── STEP 2: SIZE ─────────────────────────────── */
function renderSizeGrid(){
  const grid = document.getElementById('sizeGrid');
  grid.innerHTML = SIZES.map(s=>`
    <div class="cr-size-card ${s.enabled?'':'disabled'}" onclick="${s.enabled?`selectSize(${s.mm})`:''}">
      ${s.enabled?'':'<div class="cr-product-badge">Unavailable</div>'}
      <div class="cr-size-ring" style="width:${24+s.mm*0.85}px;height:${24+s.mm*0.85}px"></div>
      <div class="cr-size-num">${s.mm}mm Circle</div>
      <div class="cr-size-tag">${s.tag}</div>
    </div>`).join('');
}
// Bleed/paper size is a fixed property of the chosen size (see SIZES above)
// — customers don't control it, so picking a size goes straight to Design.
function selectSize(mm){
  const s = SIZES.find(x=>x.mm===mm);
  if (!s || !s.enabled) return;
  state.size = s.mm;
  state.paperSize = s.paperMM;
  goStep('design');
}
window.selectSize = selectSize;

/* ── BLEED MATH (mm) ───────────────────────────── */
// Paper size (the full print/PVC-wrap sheet) is fixed per SIZES entry —
// bleed is just the gap between the cut line and that paper edge.
function bleedPerSide(){ return (state.paperSize - state.size) / 2; }
function artboardDiameter(){ return state.paperSize; }
// No exact "image size" spec on the chart, so keep important content a
// reasonable margin inside the cut line rather than right up against it.
function safeInset(){ return Math.max(1, bleedPerSide()*0.5); }

/* ── CANVAS SETUP ─────────────────────────────── */
function setupCanvas(){
  const canvas = document.getElementById('designCanvas');
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  document.getElementById('previewLabel').textContent =
    `${state.product.label} · ${state.size}mm Circle (${artboardDiameter().toFixed(1)}mm with bleed)`;
  renderDock();
  renderToolPanelContent();
  updateSubmitAvailability();
  if (!canvas._boundEvents){
    bindCanvasInteractions(canvas);
    canvas._boundEvents = true;
  }
  watchCanvasWrapSize();
  sizeCanvasStage();
  requestAnimationFrame(sizeCanvasStage);
  setTimeout(sizeCanvasStage, 60); // fallback in case rAF is throttled (e.g. background tab)
}

// Fits the canvas stage to the largest square available in cr-canvas-wrap,
// since the design step is a fixed no-scroll viewport (pin must always be visible).
// Shrunk by PIN_FILL_RATIO (applied equally to both dimensions, so it always
// stays square) to guarantee a margin around the pin for the decorative
// spinning border ring + floating stickers — without it the pin fills the
// wrap entirely on cramped phone viewports and they have nowhere to show.
const PIN_FILL_RATIO = 0.8;
function sizeCanvasStage(){
  const wrap = document.querySelector('.cr-canvas-wrap');
  const stage = document.getElementById('canvasStage');
  if (!wrap || !stage) return;
  const side = Math.max(120, Math.min(wrap.clientWidth, wrap.clientHeight) * PIN_FILL_RATIO);
  stage.style.width = side + 'px';
  stage.style.height = side + 'px';
}
window.addEventListener('resize', ()=>{
  if (document.getElementById('step-design').classList.contains('active')) sizeCanvasStage();
});

const ICON_EXPAND   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3"/></svg>';
const ICON_COLLAPSE  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v3a2 2 0 01-2 2H4M15 3v3a2 2 0 002 2h3M9 21v-3a2 2 0 00-2-2H4M15 21v-3a2 2 0 012-2h3"/></svg>';

// Full-screen "isolate" mode: hides everything except the canvas so the pin
// has maximum room to drag/position elements precisely. The watermark stays
// visible because it's baked directly into the canvas drawing by drawPreview().
function toggleIsolateMode(){
  const app = document.querySelector('.cr-design-app');
  const btn = document.getElementById('isolateBtn');
  if (!app || !btn) return;
  const on = app.classList.toggle('isolate');
  btn.classList.toggle('active', on);
  btn.title = on ? 'Exit full-screen view' : 'Full-screen view';
  btn.innerHTML = on ? ICON_COLLAPSE : ICON_EXPAND;
  sizeCanvasStage();
  requestAnimationFrame(sizeCanvasStage);
}

// The settings panel's height changes constantly (different layers have
// different amounts of content), which shrinks/grows cr-canvas-wrap on every
// selection — a plain resize listener misses that. A ResizeObserver on the
// wrap itself catches every cause, so the stage (and the circle inside it)
// can never end up non-square.
let _canvasWrapObserver = null;
function watchCanvasWrapSize(){
  if (_canvasWrapObserver) return;
  const wrap = document.querySelector('.cr-canvas-wrap');
  if (!wrap || typeof ResizeObserver === 'undefined') return;
  _canvasWrapObserver = new ResizeObserver(() => sizeCanvasStage());
  _canvasWrapObserver.observe(wrap);
}

function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function capitalize(s){ return s[0].toUpperCase()+s.slice(1); }

/* ── ICONS (small inline line-style SVGs, reused by the layer strip) ── */
const ICON_BG        = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
const ICON_STICKER    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>';
const ICON_CHARACTER  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>';
const ICON_TEXT       = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h7"/></svg>';
const ICON_SHAPE      = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="16" r="3.5"/><rect x="13" y="12.5" width="7" height="7" rx="1.2"/><path d="M9 3l4 7H5z"/></svg>';
const ICON_WORDART    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l4-3 4 3 4-3 4 3v10l-4-3-4 3-4-3-4 3z"/></svg>';
const ICON_BORDER     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5" stroke-dasharray="2 2.4"/></svg>';
const ICON_PRINT      = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V4h12v5"/><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M6 16h12v5H6z"/></svg>';
const ICON_PLUS       = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_DUPLICATE  = '<svg class="cr-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>';
const ICON_CLOSE      = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
const ICON_UPLOAD      = '<svg class="cr-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5M4 21h16"/></svg>';
const ICON_PALETTE    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 100 18c1.1 0 1.5-.7 1.5-1.4 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.6-1.4 1.4-1.4H16a4 4 0 004-4c0-5-3.6-9-8-9z"/><circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.2" cy="10" r="1.1" fill="currentColor" stroke="none"/></svg>';
const ICON_OPACITY    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/></svg>';
const ICON_SIZE       = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
const ICON_ROTATE     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 1 2.6 5.9"/><path d="M4 17v-5h5"/></svg>';
const ICON_FONT       = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19l5-14 5 14M6.5 14h7"/><path d="M15 19l3-7 3 7M16.3 16.5h3.4"/></svg>';
const ICON_ARC        = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17a10 8 0 0 1 16 0"/></svg>';
const ICON_CURVE_STRAIGHT = '<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="4" y1="12" x2="36" y2="12"/></svg>';
const ICON_CURVE_TOP     = '<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M4 20 Q20 2 36 20"/></svg>';
const ICON_CURVE_BOTTOM  = '<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M4 4 Q20 22 36 4"/></svg>';
const ICON_PICKER_WHEEL  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 019 9M12 3a4.5 4.5 0 000 9 4.5 4.5 0 010 9"/></svg>';
const TEXT_COLOR_SWATCHES = ['#FFFFFF','#000000','#FF3B30','#FF9500','#FFCC00','#34C759','#007AFF','#5856D6','#FF2D92','#8B5A2B'];
const ICON_SWATCH     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/></svg>';
const ICON_SHADOW     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="12" height="12" rx="2"/><path d="M9 9h12v12H9z" opacity="0.45"/></svg>';
const ICON_EDIT       = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';
const ICON_TRASH      = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>';
const ICON_LAYERS     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>';
const ICON_GRIP       = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
const ICON_CHEVRON_L  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
const ICON_CHEVRON_R  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

/* ── LAYER SELECTION (tap on the pin OR tap a chip — same result) ── */
function layerKey(l){ return l ? l.kind + (l.id!=null ? ':'+l.id : '') : ''; }

function selectLayer(descriptor){
  const changingElement = layerKey(state.selected) !== layerKey(descriptor);
  state.selected = descriptor;
  if (changingElement) _activeTool = null; // close any open tool panel for the previous element
  renderDock();
  renderToolPanelContent();
  drawPreview();
}
window.selectLayer = selectLayer;

function deselectLayer(){
  state.selected = null;
  _activeTool = null;
  renderDock();
  renderToolPanelContent();
  drawPreview();
}
window.deselectLayer = deselectLayer;

const ICON_LOCK   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>';
const ICON_UNLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 017.6-1.8"/></svg>';

function bgChipThumb(){
  if (state.bg.imageOn && state.bg.img) return `<img src="${state.bg.img.src}" alt="">`;
  if (state.bg.colorOn && state.bg.color){
    const g = state.bg.color;
    const css = g.grad4 ? `linear-gradient(135deg,${g.grad4[0]},${g.grad4[3]})` : `linear-gradient(135deg,${g.grad[0]},${g.grad[1]})`;
    return `<span style="display:block;width:100%;height:100%;background:${css}"></span>`;
  }
  return ICON_BG;
}

function quickAddText(){ addTextLine(); }
window.quickAddText = quickAddText;

function quickAddSticker(){ addNew('sticker'); }
window.quickAddSticker = quickAddSticker;

function quickSelectCharacter(){
  if (state.character) selectLayer({ kind:'character' });
  else addNew('character');
}
window.quickSelectCharacter = quickSelectCharacter;

function quickSelectBackground(){ selectLayer({ kind:'background' }); }
window.quickSelectBackground = quickSelectBackground;

function quickSelectBorder(){ selectLayer({ kind:'border' }); }
window.quickSelectBorder = quickSelectBorder;

function quickAddShape(){ addNew('shape'); }
window.quickAddShape = quickAddShape;

function quickAddWordArt(){ addNew('wordart'); }
window.quickAddWordArt = quickAddWordArt;

/* ── BOTTOM DOCK (GoDaddy-style icon bar) ──────────────────────────
   Two swappable rows live in #dockArea:
   - Add-row (nothing selected): tap an element type to add/select it.
   - Tool-row (something selected): swipeable icons for that element's
     tools; a rising panel (openToolPanel) shows the control for
     whichever tool icon was tapped. ── */
let _activeTool = null;

function renderDock(){
  const dock = document.getElementById('dockArea');
  if (!dock) return;
  const isToolRow = !!state.selected;
  dock.innerHTML = isToolRow ? toolRowHtml() : addRowHtml();
  const prefix = isToolRow ? 'toolRow' : 'addRow';
  const scrollId = isToolRow ? 'toolRowScroll' : 'addRowScroll';
  requestAnimationFrame(()=>initDockScroll(prefix, scrollId));
}

// Left/right fade+arrow indicators for the horizontally-swipeable dock rows
// — only lit up when the row actually overflows, so short rows (e.g.
// Background's icon set) stay uncluttered. The arrows themselves (thick,
// high-contrast when active) are the only "there's more" signal now.
function scrollDockRow(scrollId, dir){
  const row = document.getElementById(scrollId);
  if (!row) return;
  row.scrollBy({ left: dir * row.clientWidth * 0.7, behavior:'smooth' });
}
window.scrollDockRow = scrollDockRow;

function updateDockScrollIndicators(prefix, scrollId){
  const row = document.getElementById(scrollId);
  const left = document.getElementById(prefix+'ArrowLeft');
  const right = document.getElementById(prefix+'ArrowRight');
  if (!row || !left || !right) return;
  const overflow = row.scrollWidth > row.clientWidth + 2;
  left.classList.toggle('cr-visible', overflow);
  right.classList.toggle('cr-visible', overflow);
  left.classList.toggle('active', overflow && row.scrollLeft > 4);
  right.classList.toggle('active', overflow && row.scrollLeft < row.scrollWidth - row.clientWidth - 4);
}

function initDockScroll(prefix, scrollId){
  const row = document.getElementById(scrollId);
  if (!row) return;
  row.addEventListener('scroll', ()=>updateDockScrollIndicators(prefix, scrollId));
  updateDockScrollIndicators(prefix, scrollId);
}

function addRowHtml(){
  const items = [
    { onclick:'quickSelectBackground()', icon: bgChipThumb(), label:'Background', thumb:true },
    { onclick:'quickSelectBorder()', icon: state.border ? `<img src="${state.border.img.src}" alt="">` : ICON_BORDER, label:'Border', thumb: !!state.border },
    { onclick:'quickSelectCharacter()', icon: state.character ? `<img src="${state.character.img.src}" alt="">` : ICON_CHARACTER, label:'Character', thumb: !!state.character },
    { onclick:'quickAddSticker()', icon: ICON_STICKER, label:'Sticker' },
    { onclick:'quickAddShape()', icon: ICON_SHAPE, label:'Shapes' },
    { onclick:'quickAddWordArt()', icon: ICON_WORDART, label:'Word Art' },
    { onclick:'quickAddText()', icon: ICON_TEXT, label:'Text' },
  ];
  const btns = items.map(it=>`
    <button class="cr-dock-btn" onclick="${it.onclick}">
      <span class="cr-dock-icon ${it.thumb?'cr-dock-icon-thumb':''}">${it.icon}</span>
      <span class="cr-dock-label">${it.label}</span>
    </button>`).join('');
  return `<div class="cr-dock-scroll-wrap">
    <button class="cr-dock-scroll-arrow" id="addRowArrowLeft" onclick="scrollDockRow('addRowScroll',-1)" aria-label="Scroll left">${ICON_CHEVRON_L}</button>
    <div class="cr-add-row" id="addRowScroll">${btns}</div>
    <button class="cr-dock-scroll-arrow" id="addRowArrowRight" onclick="scrollDockRow('addRowScroll',1)" aria-label="Scroll right">${ICON_CHEVRON_R}</button>
  </div>`;
}

function toolIconsForSelection(){
  const kind = state.selected.kind;
  if (kind==='background') return [
    { id:'photo', label:'Photo', icon:ICON_BG, panel:true },
    { id:'colors', label:'Colors', icon:ICON_PALETTE, panel:true },
    { id:'opacity', label:'Opacity', icon:ICON_OPACITY, panel:true },
    { id:'lock', label: state.bg.locked?'Locked':'Lock', icon: state.bg.locked?ICON_LOCK:ICON_UNLOCK, instant:"toggleLock('background')", on: state.bg.locked },
  ];
  if (kind==='character'){
    if (!state.character) return [
      { id:'presets', label:'Presets', icon:ICON_PALETTE, panel:true },
      { id:'replace', label:'Upload', icon:ICON_UPLOAD, instant:"promptUpload('character')" },
    ];
    return [
      { id:'replace', label:'Replace', icon:ICON_UPLOAD, instant:"promptUpload('character')" },
      { id:'size', label:'Size', icon:ICON_SIZE, panel:true },
      { id:'rotate', label:'Rotate', icon:ICON_ROTATE, panel:true },
      { id:'lock', label: state.character.locked?'Locked':'Lock', icon: state.character.locked?ICON_LOCK:ICON_UNLOCK, instant:"toggleLock('character')", on: state.character.locked },
      { id:'remove', label:'Remove', icon:ICON_TRASH, instant:'removeCharacter()', danger:true },
    ];
  }
  if (kind==='border') return [
    { id:'presets', label:'Presets', icon:ICON_PALETTE, panel:true },
    { id:'replace', label:'Upload', icon:ICON_UPLOAD, instant:"promptUpload('border')" },
    { id:'rotate', label:'Rotate', icon:ICON_ROTATE, panel:true },
    { id:'remove', label:'Remove', icon:ICON_TRASH, instant:'removeBorder()', danger:true },
  ];
  if (kind==='sticker' || kind==='shape' || kind==='wordart'){
    // Same pattern as border: pick from the library or upload your own.
    if (state.selected.id == null) return [
      { id:'presets', label:'Presets', icon:ICON_PALETTE, panel:true },
      { id:'replace', label:'Upload', icon:ICON_UPLOAD, instant:`promptUpload('${kind}')` },
    ];
    const el = placedArray(kind).find(x=>x.id===state.selected.id);
    if (!el) return [];
    const icons = [
      { id:'presets', label:'Presets', icon:ICON_PALETTE, panel:true },
      { id:'replace', label:'Upload', icon:ICON_UPLOAD, instant:`promptUpload('${kind}')` },
      { id:'size', label:'Size', icon:ICON_SIZE, panel:true },
      { id:'rotate', label:'Rotate', icon:ICON_ROTATE, panel:true },
      { id:'duplicate', label:'Duplicate', icon:ICON_DUPLICATE, instant:`duplicatePlaced('${kind}',${el.id})` },
    ];
    // Add-another shortcut — stickers only for now, so you can add a second
    // sticker without backing out to the main dock. (Say the word if you
    // want this on Shape/Word Art too.)
    if (kind==='sticker') icons.push({ id:'add', label:'Add', icon:ICON_PLUS, instant:"addNew('sticker')" });
    icons.push(
      { id:'lock', label: el.locked?'Locked':'Lock', icon: el.locked?ICON_LOCK:ICON_UNLOCK, instant:`toggleLock('${kind}',${el.id})`, on: el.locked },
      { id:'remove', label:'Remove', icon:ICON_TRASH, instant:`removePlaced('${kind}',${el.id})`, danger:true },
    );
    return icons;
  }
  if (kind==='text'){
    const t = state.textLines.find(x=>x.id===state.selected.id);
    if (!t) return [];
    return [
      { id:'edit', label:'Edit', icon:ICON_EDIT, panel:true },
      { id:'font', label:'Font', icon:ICON_FONT, panel:true },
      { id:'placement', label:'Style', icon:ICON_ARC, panel:true },
      { id:'color', label:'Color', icon:ICON_SWATCH, panel:true },
      { id:'size', label:'Size', icon:ICON_SIZE, panel:true },
      { id:'rotate', label:'Rotate', icon:ICON_ROTATE, panel:true },
      { id:'shadow', label:'Shadow', icon:ICON_SHADOW, instant:`toggleTextShadow(${t.id},${!t.shadow})`, on:t.shadow },
      { id:'lock', label: t.locked?'Locked':'Lock', icon: t.locked?ICON_LOCK:ICON_UNLOCK, instant:`toggleLock('text',${t.id})`, on: t.locked },
      { id:'remove', label:'Remove', icon:ICON_TRASH, instant:`removeTextLine(${t.id})`, danger:true },
    ];
  }
  return [];
}

function toolRowHtml(){
  const icons = toolIconsForSelection();
  const btns = icons.map(t => {
    const onclick = t.panel ? `openToolPanel('${t.id}')` : t.instant;
    const cls = ['cr-tool-btn', t.panel && _activeTool===t.id ? 'active' : '', t.on ? 'on' : '', t.danger ? 'danger' : ''].filter(Boolean).join(' ');
    return `<button class="${cls}" onclick="${escHtml(onclick)}">
      <span class="cr-tool-icon">${t.icon}</span>
      <span class="cr-tool-label">${t.label}</span>
    </button>`;
  }).join('');
  return `
    <button class="cr-tool-row-close" onclick="deselectLayer()" title="Done">${ICON_CLOSE}</button>
    <div class="cr-dock-scroll-wrap">
      <button class="cr-dock-scroll-arrow" id="toolRowArrowLeft" onclick="scrollDockRow('toolRowScroll',-1)" aria-label="Scroll left">${ICON_CHEVRON_L}</button>
      <div class="cr-tool-row-scroll" id="toolRowScroll">${btns}</div>
      <button class="cr-dock-scroll-arrow" id="toolRowArrowRight" onclick="scrollDockRow('toolRowScroll',1)" aria-label="Scroll right">${ICON_CHEVRON_R}</button>
    </div>`;
}

/* ── RISING TOOL PANEL (compact bottom sheet, one control at a time) ── */
function openToolPanel(toolId){
  _activeTool = (_activeTool===toolId) ? null : toolId;
  renderDock();
  renderToolPanelContent();
}
window.openToolPanel = openToolPanel;

function closeToolPanel(){
  _activeTool = null;
  renderDock();
  renderToolPanelContent();
}
window.closeToolPanel = closeToolPanel;

function renderToolPanelContent(){
  const wrap = document.getElementById('toolRisePanel');
  const body = document.getElementById('toolRiseBody');
  if (!wrap || !body) return;
  if (!state.selected || !_activeTool){ wrap.classList.remove('show'); body.innerHTML=''; return; }
  const kind = state.selected.kind;
  let html = '';
  if (kind==='background') html = bgToolPanelHtml(_activeTool);
  else if (kind==='border') html = borderToolPanelHtml(_activeTool);
  else if (kind==='character') html = characterToolPanelHtml(_activeTool);
  else if (kind==='sticker' || kind==='shape' || kind==='wordart') html = placedToolPanelHtml(kind, _activeTool, state.selected.id);
  else if (kind==='text') html = textToolPanelHtml(_activeTool, state.selected.id);
  if (!html){ wrap.classList.remove('show'); body.innerHTML=''; return; }
  body.innerHTML = html;
  wrap.classList.add('show');
}

/* ── BACKGROUND TOOL PANELS ───────────────────── */
function bgToolPanelHtml(tool){
  if (tool==='photo'){
    return `
      ${BACKGROUND_PRESETS.length ? `
        <div class="cr-field-label" style="margin-top:0">Presets</div>
        <div class="cr-preset-grid">${BACKGROUND_PRESETS.map((p,i)=>
          `<button class="cr-preset-thumb ${state.bg.img && state.bg.img.src===p.src ? 'active' : ''}" onclick="selectBgPreset(${i})"><img src="${p.src}" alt="${escHtml(p.label||'')}"></button>`
        ).join('')}</div>` : ''}
      <button type="button" class="cr-upload-btn" onclick="document.getElementById('bgFileInput').click()">
        ${ICON_UPLOAD}<span id="bgUploadLabelText">Choose a Photo</span>
      </button>
      ${state.bg.img ? `<label class="cr-checkbox-row"><input type="checkbox" ${state.bg.imageOn?'checked':''} onchange="toggleImageLayer(this.checked)">Show the photo</label>` : ''}
      <div id="bgWarning" class="cr-warning" style="display:none"></div>
      <div class="cr-hint">Drag directly on the pin to reposition · scroll or pinch to zoom.</div>`;
  }
  if (tool==='colors'){
    return `
      <div class="cr-gradient-grid">${GRADIENTS.map((g,i)=>{
        const css = g.grad4
          ? `conic-gradient(from 45deg, ${g.grad4[0]}, ${g.grad4[1]}, ${g.grad4[3]}, ${g.grad4[2]}, ${g.grad4[0]})`
          : `linear-gradient(135deg, ${g.grad[0]}, ${g.grad[1]})`;
        return `<button class="cr-gradient-swatch ${state.bg.color===g?'active':''}" style="background:${css}" title="${g.label}" onclick="selectGradient(${i})"></button>`;
      }).join('')}</div>
      ${state.bg.color ? `<label class="cr-checkbox-row"><input type="checkbox" ${state.bg.colorOn?'checked':''} onchange="toggleColorLayer(this.checked)">Show this color</label>` : ''}
      <div class="cr-hint">Turn on both a photo and a color to mix them — the color shows through anywhere the photo doesn't fully cover.</div>`;
  }
  if (tool==='opacity'){
    return `
      <div class="cr-field-label">Photo Opacity</div>
      <input type="range" min="0.1" max="1" step="0.05" value="${state.bg.opacity}" oninput="setBgOpacity(this.value)" class="cr-range">
      <div class="cr-hint">Only affects the photo layer — any color underneath stays fully visible.</div>`;
  }
  return '';
}

function selectGradient(i){
  state.bg.color = GRADIENTS[i];
  state.bg.colorOn = true;
  renderDock();
  renderToolPanelContent();
  drawPreview();
  updateSubmitAvailability();
}
window.selectGradient = selectGradient;

/* ── BORDER TOOL PANEL (single preset, fixed above the background) ── */
function borderToolPanelHtml(tool){
  if (tool==='presets'){
    if (!BORDER_PRESETS.length) return `<div class="cr-empty-hint">No border designs yet — check back soon!</div>`;
    return `<div class="cr-preset-grid">${BORDER_PRESETS.map((p,i)=>
      `<button class="cr-preset-thumb ${state.border && state.border.src===p.src ? 'active' : ''}" onclick="selectBorderPreset(${i})"><img src="${p.src}" alt="${escHtml(p.label||'')}"></button>`
    ).join('')}</div>`;
  }
  if (tool==='rotate'){
    const rotDeg = Math.round(((state.border && state.border.rotation)||0)*180/Math.PI);
    return `
      <div class="cr-field-label">Rotation <span class="cr-slider-val" id="borderRotVal">${rotDeg}°</span></div>
      <input type="range" class="cr-range cr-range-mid" min="-180" max="180" value="${rotDeg}"
        oninput="setBorderRotation(this.value); document.getElementById('borderRotVal').textContent=this.value+'°'">`;
  }
  return '';
}

function selectBorderPreset(i){
  const preset = BORDER_PRESETS[i];
  if (!preset) return;
  const prevRotation = state.border ? state.border.rotation : 0;
  const prevScale = state.border ? state.border.scale : 1;
  const img = new Image();
  img.crossOrigin = 'anonymous'; // raw.githubusercontent.com sends CORS headers — needed so the design canvas doesn't get tainted
  img.onload = () => {
    state.border = { img, src: preset.src, label: preset.label, rotation: prevRotation, scale: prevScale, xFrac: 0, yFrac: 0 };
    renderDock(); renderToolPanelContent(); drawPreview(); updateCanvasBorderRing();
  };
  img.src = preset.src;
}
window.selectBorderPreset = selectBorderPreset;

function removeBorder(){
  state.border = null;
  renderDock(); renderToolPanelContent(); drawPreview(); updateCanvasBorderRing();
}
window.removeBorder = removeBorder;

function setBorderRotation(deg){
  if (!state.border) return;
  state.border.rotation = (+deg) * Math.PI/180;
  drawPreview();
}
window.setBorderRotation = setBorderRotation;

function onBorderFileChosen(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const prevRotation = state.border ? state.border.rotation : 0;
    const prevScale = state.border ? state.border.scale : 1;
    const img = new Image();
    img.onload = () => {
      state.border = { img, src: ev.target.result, label: null, rotation: prevRotation, scale: prevScale, xFrac: 0, yFrac: 0 };
      renderDock(); renderToolPanelContent(); drawPreview(); updateCanvasBorderRing();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
window.onBorderFileChosen = onBorderFileChosen;

function toggleColorLayer(on){
  state.bg.colorOn = on;
  drawPreview();
  updateSubmitAvailability();
}
window.toggleColorLayer = toggleColorLayer;

function toggleImageLayer(on){
  state.bg.imageOn = on;
  drawPreview();
  updateSubmitAvailability();
}
window.toggleImageLayer = toggleImageLayer;

function onBgFileChosen(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => setBgImage(ev.target.result, false);
  reader.readAsDataURL(file);
}
window.onBgFileChosen = onBgFileChosen;

function loadBgFromLink(){
  const url = (document.getElementById('bgLinkInput').value||'').trim();
  if (!url) return;
  setBgImage(url, true);
}
window.loadBgFromLink = loadBgFromLink;

function selectBgPreset(i){
  const preset = BACKGROUND_PRESETS[i];
  if (!preset) return;
  setBgImage(preset.src, true); // raw.githubusercontent.com sends CORS headers, so this loads clean (untainted)
}
window.selectBgPreset = selectBgPreset;

function setBgImage(src, isExternal){
  if (!isExternal){
    const img = new Image();
    img.onload = () => applyBgImage(img, false);
    img.onerror = () => showBgWarning('Could not load that image.');
    img.src = src;
    return;
  }
  // External links: most image CDNs (e.g. Pinterest) don't send CORS headers,
  // so a crossOrigin='anonymous' request fails outright rather than just tainting.
  // Try CORS first (gives a clean, exportable image); fall back to a plain load
  // (displays fine, but can't be used in the final print — we warn about that).
  const corsImg = new Image();
  corsImg.crossOrigin = 'anonymous';
  corsImg.onload = () => {
    if (isCanvasTainted(corsImg)) loadPlain(); else applyBgImage(corsImg, false);
  };
  corsImg.onerror = loadPlain;
  corsImg.src = src;

  function loadPlain(){
    const img2 = new Image();
    img2.onload = () => {
      applyBgImage(img2, true);
      showBgWarning("This image can be previewed but can't be used for the final print (the host blocks cross-site access). For best results, upload the file instead.");
    };
    img2.onerror = () => showBgWarning('Could not load that image link. Check the URL or upload the file instead.');
    img2.src = src;
  }
}

function isCanvasTainted(img){
  try {
    const probe = document.createElement('canvas');
    probe.width = 1; probe.height = 1;
    const pctx = probe.getContext('2d');
    pctx.drawImage(img,0,0,1,1);
    pctx.getImageData(0,0,1,1);
    return false;
  } catch(e){ return true; }
}

function applyBgImage(img, tainted){
  state.bg.imageOn = true;
  state.bg.img = img;
  state.bg.tainted = tainted;
  state.bg.offsetXFrac = 0; state.bg.offsetYFrac = 0; state.bg.scale = 1;
  // A color is always applied underneath — at less than full opacity the
  // photo alone would look washed out with nothing behind it.
  if (!state.bg.color){
    state.bg.color = GRADIENTS[0];
    state.bg.colorOn = true;
  }
  renderDock();
  renderToolPanelContent();
  drawPreview();
  updateSubmitAvailability();
}

function showBgWarning(msg){
  const warnEl = document.getElementById('bgWarning');
  if (!warnEl) return;
  warnEl.style.display = 'block';
  warnEl.textContent = msg;
}

function setBgOpacity(val){
  state.bg.opacity = +val;
  drawPreview();
}
window.setBgOpacity = setBgOpacity;

// Keeps the background image fully covering the circular pin area — UNLESS
// a color layer is active underneath, in which case gaps are fine (the color
// shows through) so panning/zooming is free within generous bounds.
function clampBgTransform(){
  const img = state.bg.img;
  if (!img) return;
  const unit = 1 / Math.min(img.naturalWidth, img.naturalHeight);
  if (state.bg.colorOn){
    state.bg.scale = Math.max(0.3, Math.min(4, state.bg.scale));
    state.bg.offsetXFrac = Math.max(-0.7, Math.min(0.7, state.bg.offsetXFrac));
    state.bg.offsetYFrac = Math.max(-0.7, Math.min(0.7, state.bg.offsetYFrac));
    return;
  }
  state.bg.scale = Math.max(1, Math.min(4, state.bg.scale));
  const w = img.naturalWidth * unit * state.bg.scale;
  const h = img.naturalHeight * unit * state.bg.scale;
  const maxX = Math.max(0, (w - 1) / 2);
  const maxY = Math.max(0, (h - 1) / 2);
  state.bg.offsetXFrac = Math.max(-maxX, Math.min(maxX, state.bg.offsetXFrac));
  state.bg.offsetYFrac = Math.max(-maxY, Math.min(maxY, state.bg.offsetYFrac));
}

function presetsForKind(kind){
  if (kind==='character') return CHARACTER_PRESETS;
  if (kind==='border') return BORDER_PRESETS;
  if (PLACED_META[kind]) return placedPresets(kind);
  return [];
}

// Adding a sticker/shape/word art/character works exactly like Border:
// select the category (id:null = "nothing created yet"), which shows a
// [Presets, Upload] tool row; the Presets rising panel shows the grid
// inline, tapping a preset creates the element. No modal anywhere in this
// flow — the PNG-upload instructions modal only appears via the Upload icon.
function addNew(kind){
  if (kind==='character') selectLayer({ kind:'character' });
  else selectLayer({ kind, id:null });
  openToolPanel('presets');
}
window.addNew = addNew;

/* ── UPLOAD INSTRUCTIONS MODAL (with PNG/transparency infographic) ──
   Reached only via a tool row's Upload icon. */
const UPLOAD_INPUT_IDS = {
  sticker:'stickerFileInput', character:'characterFileInput', border:'borderFileInput',
  shape:'shapeFileInput', wordart:'wordartFileInput',
};

function promptUpload(kind){
  const noun = PLACED_META[kind] ? PLACED_META[kind].uploadNoun : kind;
  document.getElementById('uploadHintText').textContent =
    `Your ${noun} file should be a PNG with a transparent (no) background, so it blends cleanly into the design.`;
  document.getElementById('uploadHintInputId').value = UPLOAD_INPUT_IDS[kind] || 'bgFileInput';
  document.getElementById('uploadHintOverlay').classList.add('show');
}
window.promptUpload = promptUpload;

function closeUploadHint(){
  document.getElementById('uploadHintOverlay').classList.remove('show');
}
window.closeUploadHint = closeUploadHint;
function confirmUploadHint(){
  const inputId = document.getElementById('uploadHintInputId').value;
  closeUploadHint();
  document.getElementById(inputId).click();
}
window.confirmUploadHint = confirmUploadHint;

/* ── LAYERS TAB (drag to reorder; background is always fixed at the back) ──
   Reorderable rows use document-level pointermove/pointerup listeners rather
   than setPointerCapture, so the list can safely re-render on every step of
   the drag (capture is silently dropped once its element leaves the DOM). */
function openLayersModal(){
  renderLayersModal();
  document.getElementById('layersOverlay').classList.add('show');
}
window.openLayersModal = openLayersModal;
function closeLayersModal(){
  document.getElementById('layersOverlay').classList.remove('show');
}
window.closeLayersModal = closeLayersModal;

const PLACED_ICON = { sticker: ICON_STICKER, shape: ICON_SHAPE, wordart: ICON_WORDART };
function layerThumbFor(d){
  if (d.kind==='character') return state.character ? `<img src="${state.character.img.src}" alt="">` : ICON_CHARACTER;
  if (PLACED_META[d.kind]){ const el=placedArray(d.kind).find(x=>x.id===d.id); return el ? `<img src="${el.img.src}" alt="">` : PLACED_ICON[d.kind]; }
  return ICON_TEXT;
}
function layerLabelFor(d){
  if (d.kind==='character') return 'Character';
  if (PLACED_META[d.kind]){ const idx=placedArray(d.kind).findIndex(x=>x.id===d.id); return PLACED_META[d.kind].label+' '+(idx+1); }
  const t = state.textLines.find(x=>x.id===d.id);
  return (t && t.text ? t.text : 'Text').slice(0,18);
}
function layerLockedFor(d){
  if (d.kind==='character') return !!(state.character && state.character.locked);
  if (PLACED_META[d.kind]){ const el=placedArray(d.kind).find(x=>x.id===d.id); return !!(el && el.locked); }
  const t = state.textLines.find(x=>x.id===d.id);
  return !!(t && t.locked);
}

function renderLayersModal(){
  const list = document.getElementById('layersDragList');
  const fixed = document.getElementById('layersFixedList');
  if (!list || !fixed) return;
  const visual = layersVisualList();
  list.innerHTML = visual.length ? visual.map((d,i)=>`
    <div class="cr-layer-row draggable">
      <button class="cr-layer-row-handle" onpointerdown="startLayerDrag(event,${i})" title="Drag to reorder">${ICON_GRIP}</button>
      <span class="cr-layer-row-thumb" onclick='selectLayerFromModal(${JSON.stringify(d)})'>${layerThumbFor(d)}</span>
      <span class="cr-layer-row-label" onclick='selectLayerFromModal(${JSON.stringify(d)})'>${escHtml(layerLabelFor(d))}</span>
      <button class="cr-layer-row-lock ${layerLockedFor(d)?'locked':''}" onclick='toggleLock("${d.kind}"${d.id!=null?','+d.id:''});renderLayersModal()'>${layerLockedFor(d)?ICON_LOCK:ICON_UNLOCK}</button>
    </div>`).join('') : `<div class="cr-empty-hint">No layers yet — add text, a sticker, or a character to see them here.</div>`;

  const fixedRows = [];
  if (state.bg.imageOn && state.bg.img) fixedRows.push({ label:'Background Photo', thumb:`<img src="${state.bg.img.src}" alt="">` });
  if (state.bg.colorOn && state.bg.color){
    const g = state.bg.color;
    const css = g.grad4 ? `linear-gradient(135deg,${g.grad4[0]},${g.grad4[3]})` : `linear-gradient(135deg,${g.grad[0]},${g.grad[1]})`;
    fixedRows.push({ label:'Background Color', thumb:`<span style="display:block;width:100%;height:100%;background:${css}"></span>` });
  }
  if (state.border) fixedRows.push({ label:'Border', thumb:`<img src="${state.border.img.src}" alt="">` });
  fixed.innerHTML = fixedRows.length ? `
    <div class="cr-layers-fixed-label">Always at the back</div>
    ${fixedRows.map(r=>`
      <div class="cr-layer-row fixed">
        <span class="cr-layer-row-thumb">${r.thumb}</span>
        <span class="cr-layer-row-label">${r.label}</span>
        <span class="cr-layer-row-tag">Fixed</span>
      </div>`).join('')}` : '';
}

window.selectLayerFromModal = function(d){
  closeLayersModal();
  selectLayer(d.kind==='character' ? { kind:'character' } : { kind:d.kind, id:d.id });
};

// Drag reordering: the grabbed row follows the pointer 1:1 (its own
// transform, no transition), while every row it passes over slides smoothly
// into its displaced slot (CSS transition on the default .cr-layer-row
// rule) — a real "picking it up and shuffling the stack" feel rather than
// jumping straight to the final order on every step.
let _layerDrag = null;
function startLayerDrag(e, visualIndex){
  e.preventDefault();
  const rows = [...document.querySelectorAll('#layersDragList .cr-layer-row.draggable')];
  if (rows.length < 1) return;
  const dragEl = rows[visualIndex];
  const step = rows.length > 1
    ? (rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top)
    : dragEl.getBoundingClientRect().height + 6;

  _layerDrag = {
    order: layersVisualList(),
    originalIndex: visualIndex,
    currentTarget: visualIndex,
    startY: e.clientY,
    step: Math.max(30, step),
    rows,
    dragEl,
  };
  dragEl.classList.add('dragging');
  dragEl.style.transform = 'translateY(0px)';
  document.addEventListener('pointermove', onLayerDragMove);
  document.addEventListener('pointerup', endLayerDrag, { once:true });
}
window.startLayerDrag = startLayerDrag;

function onLayerDragMove(e){
  const d = _layerDrag;
  if (!d) return;
  const dy = e.clientY - d.startY;
  d.dragEl.style.transform = `translateY(${dy}px)`;

  const target = Math.max(0, Math.min(d.rows.length - 1, d.originalIndex + Math.round(dy / d.step)));
  d.currentTarget = target;

  d.rows.forEach((row, i) => {
    if (row === d.dragEl) return;
    let shift = 0;
    if (d.originalIndex < target && i > d.originalIndex && i <= target) shift = -d.step;
    else if (d.originalIndex > target && i >= target && i < d.originalIndex) shift = d.step;
    row.style.transform = shift ? `translateY(${shift}px)` : '';
  });
}
function endLayerDrag(){
  const d = _layerDrag;
  document.removeEventListener('pointermove', onLayerDragMove);
  if (!d) return;
  if (d.currentTarget !== d.originalIndex){
    const list = d.order;
    const [item] = list.splice(d.originalIndex, 1);
    list.splice(d.currentTarget, 0, item);
    setLayersFromVisual(list);
    drawPreview();
  }
  _layerDrag = null;
  renderLayersModal();
}

/* ── STICKER / SHAPE / WORD ART TOOL PANELS (shared) ──────────────── */
function placedToolPanelHtml(kind, tool, id){
  const noun = PLACED_META[kind].label.toLowerCase();

  // Pending — nothing created yet. Presets grid creates a new element when
  // tapped; there's nothing to show for any other tool in this state.
  if (id == null){
    if (tool!=='presets') return '';
    const presets = placedPresets(kind);
    if (!presets.length) return `<div class="cr-empty-hint">😢 No ${noun}s here yet — check back soon, or use Upload above.</div>`;
    return `<div class="cr-preset-grid">${presets.map((p,i)=>
      `<button class="cr-preset-thumb" onclick="addPlacedFromPreset('${kind}',${i})"><img src="${p.src}" alt="${escHtml(p.label||'')}"></button>`
    ).join('')}</div>`;
  }

  const el = placedArray(kind).find(x=>x.id===id);
  if (!el) return '';
  if (tool==='presets'){
    const presets = placedPresets(kind);
    if (!presets.length) return `<div class="cr-empty-hint">😢 No ${noun}s here yet — check back soon!</div>`;
    return `<div class="cr-preset-grid">${presets.map((p,i)=>
      `<button class="cr-preset-thumb ${el.img && el.img.src===p.src ? 'active' : ''}" onclick="swapPlacedImage('${kind}',${el.id},${i})"><img src="${p.src}" alt="${escHtml(p.label||'')}"></button>`
    ).join('')}</div>`;
  }
  if (tool==='size'){
    return `
      <div class="cr-field-label">Size</div>
      <input type="range" class="cr-range" min="0.4" max="2.5" step="0.1" value="${el.scale}" oninput="setPlacedScale('${kind}',${el.id},this.value)">
      <div class="cr-hint">Drag the ${noun} on the pin to reposition.</div>`;
  }
  if (tool==='rotate'){
    return `<div class="cr-hint" style="margin-top:2px">Use the blue handle that appears on the pin to rotate this ${noun}.</div>`;
  }
  return '';
}

// Swaps the currently-selected element's image in place (keeps its
// position/size/rotation) — same "pick a different one" idea as Border's
// Presets tool, just for the multi-instance sticker/shape/wordart kinds.
function swapPlacedImage(kind, id, i){
  const preset = placedPresets(kind)[i];
  const el = placedArray(kind).find(x=>x.id===id);
  if (!preset || !el) return;
  const img = new Image();
  img.crossOrigin = 'anonymous'; // raw.githubusercontent.com sends CORS headers — needed so the design canvas doesn't get tainted
  img.onload = () => { el.img = img; renderToolPanelContent(); drawPreview(); };
  img.src = preset.src;
}
window.swapPlacedImage = swapPlacedImage;

function addPlacedFromPreset(kind, i){
  const preset = placedPresets(kind)[i];
  if (!preset) return;
  const img = new Image();
  img.crossOrigin = 'anonymous'; // raw.githubusercontent.com sends CORS headers — needed so the design canvas doesn't get tainted
  img.onload = () => {
    const el = { id: nextPlacedId(kind), img, xFrac:0.15, yFrac:-0.15, scale:1, rotation:0, locked:false };
    placedArray(kind).push(el);
    pushLayer({ kind, id: el.id });
    selectLayer({ kind, id: el.id });
    renderCanvasBgDecor();
  };
  img.src = preset.src;
}
window.addPlacedFromPreset = addPlacedFromPreset;

// Shared by the file-input flow and the clipboard-paste flow — both end up
// with a Blob (a File is just a Blob with a name), so FileReader handles
// either the same way.
function addPlacedFromBlob(kind, blob){
  if (!blob) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const el = { id: nextPlacedId(kind), img, xFrac:0.15, yFrac:-0.15, scale:1, rotation:0, locked:false };
      placedArray(kind).push(el);
      pushLayer({ kind, id: el.id });
      selectLayer({ kind, id: el.id });
      renderCanvasBgDecor();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(blob);
}

function onPlacedFileChosen(kind, e){
  const file = e.target.files[0];
  addPlacedFromBlob(kind, file);
  e.target.value = '';
}
window.onPlacedFileChosen = onPlacedFileChosen;

// Paste-as-sticker — reads whatever image the customer copied elsewhere
// (e.g. iOS's long-press "Copy" on a photo) straight off the system
// clipboard. Must run directly from a user gesture (the button tap itself)
// for browsers to allow clipboard access at all. Not universally supported
// (older/some mobile browsers lack navigator.clipboard.read for images),
// so every failure path gets a plain-language explanation instead of a
// silent no-op.
async function pasteStickerFromClipboard(){
  if (!navigator.clipboard || !navigator.clipboard.read){
    alert("Paste isn't supported in this browser yet — use Upload instead.");
    return;
  }
  let items;
  try {
    items = await navigator.clipboard.read();
  } catch(e){
    alert("Couldn't access your clipboard. Copy a photo first (press and hold it, then Copy), then tap Paste again — your browser may also ask permission first.");
    return;
  }
  const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  for (const item of items){
    const type = item.types.find(t => IMAGE_TYPES.includes(t));
    if (type){
      const blob = await item.getType(type);
      addPlacedFromBlob('sticker', blob);
      return;
    }
  }
  alert('No photo found on your clipboard — copy one first, then tap Paste.');
}
window.pasteStickerFromClipboard = pasteStickerFromClipboard;

function duplicatePlaced(kind, id){
  const arr = placedArray(kind);
  const el = arr.find(x=>x.id===id);
  if (!el) return;
  const copy = {
    id: nextPlacedId(kind), img: el.img,
    xFrac: Math.max(-0.4, Math.min(0.4, el.xFrac + 0.08)),
    yFrac: Math.max(-0.4, Math.min(0.4, el.yFrac + 0.08)),
    scale: el.scale, rotation: el.rotation, locked: false,
  };
  arr.push(copy);
  pushLayer({ kind, id: copy.id });
  selectLayer({ kind, id: copy.id });
}
window.duplicatePlaced = duplicatePlaced;

function removePlaced(kind, id){
  const arr = placedArray(kind);
  const idx = arr.findIndex(x=>x.id===id);
  if (idx>=0) arr.splice(idx,1);
  removeLayerFromOrder(kind, id);
  if (state.selected && state.selected.kind===kind && state.selected.id===id) deselectLayer();
  else { renderDock(); drawPreview(); }
}
window.removePlaced = removePlaced;

function setPlacedScale(kind, id, val){
  const el = placedArray(kind).find(x=>x.id===id);
  if (!el) return;
  el.scale = +val;
  drawPreview();
}
window.setPlacedScale = setPlacedScale;

// Thin sticker-specific names kept so existing call sites (tool icons,
// panel HTML built before this refactor) don't need to change.
function duplicateSticker(id){ duplicatePlaced('sticker', id); }
window.duplicateSticker = duplicateSticker;
function addStickerFromPreset(i){ addPlacedFromPreset('sticker', i); }
window.addStickerFromPreset = addStickerFromPreset;
function onStickerFileChosen(e){ onPlacedFileChosen('sticker', e); }
window.onStickerFileChosen = onStickerFileChosen;
function removeSticker(id){ removePlaced('sticker', id); }
window.removeSticker = removeSticker;
function setStickerScale(id, val){ setPlacedScale('sticker', id, val); }
window.setStickerScale = setStickerScale;

/* ── CENTER CHARACTER TOOL PANELS (single, big, always centered) ── */
function characterToolPanelHtml(tool){
  const c = state.character;
  if (!c){
    if (tool!=='presets') return '';
    if (!CHARACTER_PRESETS.length) return `<div class="cr-empty-hint">😢 No characters here yet — check back soon, or use Upload above.</div>`;
    return `<div class="cr-preset-grid">${CHARACTER_PRESETS.map((p,i)=>
      `<button class="cr-preset-thumb" onclick="setCharacterFromPreset(${i})"><img src="${p.src}" alt="${escHtml(p.label||'')}"></button>`
    ).join('')}</div>`;
  }
  if (tool==='size'){
    const sizePct = Math.round(c.scale*100);
    return `
      <div class="cr-field-label">Size <span class="cr-slider-val" id="charSizeVal">${sizePct}%</span></div>
      <input type="range" class="cr-range cr-range-mid" min="1" max="199" value="${sizePct}"
        oninput="setCharacterScale(this.value/100); document.getElementById('charSizeVal').textContent=this.value+'%'">
      <div class="cr-hint">Position is always centered — slide left of center to shrink, right to grow.</div>`;
  }
  if (tool==='rotate'){
    const rotDeg = Math.round((c.rotation||0)*180/Math.PI);
    return `
      <div class="cr-field-label">Rotation <span class="cr-slider-val" id="charRotVal">${rotDeg}°</span></div>
      <input type="range" class="cr-range cr-range-mid" min="-180" max="180" value="${rotDeg}"
        oninput="setCharacterRotation(this.value); document.getElementById('charRotVal').textContent=this.value+'°'">`;
  }
  return '';
}

function toggleLock(kind, id){
  const el = kind==='background' ? state.bg
    : kind==='character' ? state.character
    : (kind==='sticker' || kind==='shape' || kind==='wordart') ? placedArray(kind).find(x=>x.id===id)
    : state.textLines.find(t=>t.id===id);
  if (!el) return;
  el.locked = !el.locked;
  renderDock();
}
window.toggleLock = toggleLock;
window.toggleIsolateMode = toggleIsolateMode;

function setCharacterFromPreset(i){
  const preset = CHARACTER_PRESETS[i];
  if (!preset) return;
  const img = new Image();
  img.crossOrigin = 'anonymous'; // raw.githubusercontent.com sends CORS headers — needed so the design canvas doesn't get tainted
  img.onload = () => {
    const isNew = !state.character;
    state.character = { img, scale:1, rotation:0, xFrac:0, yFrac:0, locked:false };
    if (isNew) pushLayer({ kind:'character' });
    selectLayer({kind:'character'});
    if (isNew) renderCanvasBgDecor();
  };
  img.src = preset.src;
}
window.setCharacterFromPreset = setCharacterFromPreset;

function onCharacterFileChosen(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const isNew = !state.character;
      state.character = { img, scale:1, rotation:0, xFrac:0, yFrac:0, locked:false };
      if (isNew) pushLayer({ kind:'character' });
      selectLayer({kind:'character'});
      if (isNew) renderCanvasBgDecor();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
window.onCharacterFileChosen = onCharacterFileChosen;

function removeCharacter(){
  state.character = null;
  removeLayerFromOrder('character', undefined);
  if (state.selected && state.selected.kind==='character') deselectLayer();
  else { renderDock(); drawPreview(); }
}
window.removeCharacter = removeCharacter;

function setCharacterScale(val){
  if (!state.character) return;
  state.character.scale = +val;
  drawPreview();
}
window.setCharacterScale = setCharacterScale;

function setCharacterRotation(deg){
  if (!state.character) return;
  state.character.rotation = (+deg) * Math.PI/180;
  drawPreview();
}
window.setCharacterRotation = setCharacterRotation;

/* ── TEXT PANEL ───────────────────────────────── */
function addTextLine(){
  const line = { id: state.nextTextId++, text:'Your Text', font:FONTS[0], color:'#FFFFFF', placement:'straight', size:1, arcRadiusMult:0.78, shadow:false, xFrac:0, yFrac:0, rotation:0, locked:false };
  state.textLines.push(line);
  pushLayer({ kind:'text', id: line.id });
  selectLayer({ kind:'text', id: line.id });
  openToolPanel('edit');
}
window.addTextLine = addTextLine;

function removeTextLine(id){
  state.textLines = state.textLines.filter(t=>t.id!==id);
  removeLayerFromOrder('text', id);
  if (state.selected && state.selected.kind==='text' && state.selected.id===id) deselectLayer();
  else { renderDock(); drawPreview(); }
}
window.removeTextLine = removeTextLine;

function updateTextLine(id, field, value){
  const line = state.textLines.find(t=>t.id===id);
  if (!line) return;
  line[field] = value;
  if (field==='size' || field==='text' || field==='placement' || field==='font'){
    clampTextSize(line);
    clampElementToCutLine(line);
    if (field==='size'){
      const slider = document.getElementById('textSizeSlider_'+id);
      if (slider) slider.value = line.size;
    }
  }
  if (field==='font' || field==='placement' || field==='color') renderToolPanelContent();
  drawPreview();
}
window.updateTextLine = updateTextLine;

function toggleTextShadow(id, on){
  const line = state.textLines.find(t=>t.id===id);
  if (!line) return;
  line.shadow = on;
  drawPreview();
}
window.toggleTextShadow = toggleTextShadow;

/* ── TEXT TOOL PANELS ─────────────────────────── */
function textToolPanelHtml(tool, id){
  const t = state.textLines.find(x=>x.id===id);
  if (!t) return '';
  if (tool==='edit'){
    return `
      <input type="text" class="cr-text-input" value="${escHtml(t.text)}" maxlength="24"
        oninput="updateTextLine(${t.id},'text',this.value)" placeholder="Your text">
      <div class="cr-hint">Drag the text directly on the pin to reposition it.</div>`;
  }
  if (tool==='font'){
    return `<div class="cr-font-grid">${FONTS.map((f,i)=>
      `<button class="cr-font-swatch ${t.font===f?'active':''}" style="font-family:'${escHtml(f)}'" onclick="updateTextLine(${t.id},'font',FONTS[${i}])">${escHtml(f)}</button>`
    ).join('')}</div>`;
  }
  if (tool==='placement'){
    const options = [
      { v:'straight',   label:'Straight',    icon:ICON_CURVE_STRAIGHT },
      { v:'top-arc',     label:'Top Arc',     icon:ICON_CURVE_TOP },
      { v:'bottom-arc',  label:'Bottom Arc',  icon:ICON_CURVE_BOTTOM },
    ];
    return `<div class="cr-curve-grid">${options.map(o=>
      `<button class="cr-curve-swatch ${t.placement===o.v?'active':''}" onclick="updateTextLine(${t.id},'placement','${o.v}')">
        <span class="cr-curve-icon">${o.icon}</span><span class="cr-curve-label">${o.label}</span>
      </button>`
    ).join('')}</div>`;
  }
  if (tool==='color'){
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : '#000000';
    const cur = (t.color||'').toLowerCase();
    return `<div class="cr-color-swatch-grid">
      ${TEXT_COLOR_SWATCHES.map(c=>
        `<button class="cr-color-swatch ${cur===c.toLowerCase()?'active':''}" style="background:${c}" onclick="updateTextLine(${t.id},'color','${c}')" title="${c}"></button>`
      ).join('')}
      <label class="cr-color-swatch cr-color-swatch-picker" title="Custom color">
        <input type="color" value="${safeColor}" oninput="updateTextLine(${t.id},'color',this.value)">
        ${ICON_PICKER_WHEEL}
      </label>
    </div>`;
  }
  if (tool==='size'){
    if (t.placement !== 'straight'){
      const sizePctArc = Math.round(t.size*100);
      return `
        <div class="cr-field-label">Font Size</div>
        <input type="number" class="cr-text-input" style="margin-bottom:0" min="1" step="1" inputmode="numeric"
          value="${sizePctArc}" oninput="setTextSizeRaw(${t.id},this.value)">
        <div class="cr-hint">No size limit — type any value. Use the pink handle on the pin to adjust how far out the curve sits, separately from font size.</div>`;
    }
    const sizePct = Math.round(t.size*100);
    return `
      <div class="cr-field-label">Size <span class="cr-slider-val" id="textSizeVal_${t.id}">${sizePct}%</span></div>
      <input type="range" class="cr-range cr-range-mid" min="1" max="199" value="${sizePct}"
        oninput="setTextSizePct(${t.id},this.value); document.getElementById('textSizeVal_${t.id}').textContent=this.value+'%'">
      <div class="cr-hint" style="margin-top:-2px">Or use the pink handle on the pin to resize freely past this slider's range.</div>`;
  }
  if (tool==='rotate'){
    return `<div class="cr-hint" style="margin-top:2px">Use the blue handle that appears on the pin to rotate this text.</div>`;
  }
  return '';
}

function setTextSizePct(id, pct){
  const t = state.textLines.find(x=>x.id===id);
  if (!t) return;
  t.size = (+pct)/100;
  clampTextSize(t);
  clampElementToCutLine(t);
  drawPreview();
}
window.setTextSizePct = setTextSizePct;

// Curved text's font-size field — deliberately uncapped (no clampTextSize
// call), since clampTextSize already no-ops for non-straight placements.
function setTextSizeRaw(id, pct){
  const t = state.textLines.find(x=>x.id===id);
  if (!t) return;
  const v = (+pct)/100;
  if (!isFinite(v) || v <= 0) return;
  t.size = v;
  clampElementToCutLine(t);
  drawPreview();
}
window.setTextSizeRaw = setTextSizeRaw;

function setTextRotation(id, deg){
  const t = state.textLines.find(x=>x.id===id);
  if (!t) return;
  t.rotation = (+deg) * Math.PI/180;
  drawPreview();
}
window.setTextRotation = setTextRotation;

/* ── CANVAS INTERACTIONS: drag bg, move/resize/rotate stickers+character ── */
// Locked elements are skipped entirely here — locking means "get out of the
// way of canvas taps," not just "can't be dragged." A locked element that
// still intercepted taps could block anything underneath it from ever being
// reachable (e.g. a large locked text box sitting over a small sticker).
function hitTestOneSticker(s, xFrac, yFrac){
  const r = STICKER_BASE_R * s.scale;
  return dist2(xFrac,yFrac,s.xFrac,s.yFrac) <= r*r;
}
function hitTestOneText(t, xFrac, yFrac){
  const ctx = document.getElementById('designCanvas').getContext('2d');
  const scalePxPerMM = CANVAS_PX / artboardDiameter();
  const cutRadiusPx = (state.size/2) * scalePxPerMM;
  ctx.font = `bold ${28*t.size}px "${t.font}", 'Nunito', sans-serif`;
  const width = ctx.measureText(t.text || 'Text').width;
  const height = 28*t.size*1.15;
  const rPx = t.placement==='straight' ? Math.hypot(width/2, height/2) : (cutRadiusPx*(t.arcRadiusMult||0.78)) + height/2;
  const rFrac = rPx / CANVAS_PX;
  return dist2(xFrac,yFrac,t.xFrac||0,t.yFrac||0) <= rFrac*rFrac;
}
// Walks state.layerOrder front-to-back so whichever element the user put on
// top (via the Layers tab) is the one a tap lands on, regardless of kind.
// Locked elements are skipped entirely — see the note above bindCanvasInteractions.
function hitTestTopmost(xFrac, yFrac){
  const list = state.layerOrder;
  for (let i = list.length - 1; i >= 0; i--){
    const d = list[i];
    if (d.kind==='text'){
      const t = state.textLines.find(x=>x.id===d.id);
      if (t && !t.locked && hitTestOneText(t, xFrac, yFrac)) return { kind:'text', el:t };
    } else if (d.kind==='sticker' || d.kind==='shape' || d.kind==='wordart'){
      const el = placedArray(d.kind).find(x=>x.id===d.id);
      if (el && !el.locked && hitTestOneSticker(el, xFrac, yFrac)) return { kind:d.kind, el };
    } else if (d.kind==='character'){
      if (state.character && !state.character.locked && dist2(xFrac,yFrac,0,0) <= Math.pow(elementRadiusFrac(state.character,'character'),2)){
        return { kind:'character', el:state.character };
      }
    }
  }
  return null;
}
function dist2(x1,y1,x2,y2){ const dx=x1-x2, dy=y1-y2; return dx*dx+dy*dy; }

function pointerFrac(canvas, e){
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX-rect.left)/rect.width - 0.5, y: (e.clientY-rect.top)/rect.height - 0.5 };
}

function startElementDrag(canvas, e, mode, el){
  const p = pointerFrac(canvas, e);
  state.dragging = true;
  state.dragTarget = el;
  state.dragMode = mode;
  state.dragIsText = state.textLines.includes(el); // text uses .size (or .arcRadiusMult if curved), stickers/character use .scale
  state.dragStartX = e.clientX; state.dragStartY = e.clientY;
  state.dragStartOffX = el.xFrac; state.dragStartOffY = el.yFrac;
  state.dragStartScale = state.dragIsText
    ? (el.placement && el.placement!=='straight' ? (el.arcRadiusMult||0.78) : el.size)
    : el.scale;
  state.dragStartRotation = el.rotation || 0;
  state.dragStartDist = Math.max(0.01, Math.hypot(p.x-el.xFrac, p.y-el.yFrac));
  state.dragStartAngle = Math.atan2(p.y-el.yFrac, p.x-el.xFrac);
  canvas.setPointerCapture(e.pointerId);
}

function bindCanvasInteractions(canvas){
  canvas.addEventListener('contextmenu', e=>e.preventDefault());
  canvas.addEventListener('dragstart', e=>e.preventDefault());

  canvas.addEventListener('pointerdown', e=>{
    const p = pointerFrac(canvas, e);
    const HANDLE_R = 0.05;

    // 1. Handles of the currently selected element take priority (skipped if locked).
    // Character is the one exception — always centered, no handles at all.
    // Border only gets the resize handle (it already has its own Rotate slider).
    // Curved text (top-arc/bottom-arc) keeps its resize handle too, but it
    // drives the curve's radius instead of font size — font size is its own
    // uncapped number field (see textToolPanelHtml), kept independent of it.
    {
      const { el, kind } = selectedElementAndKind();
      if (el && !el.locked && (kind==='sticker' || kind==='shape' || kind==='wordart' || kind==='text' || kind==='border')){
        const hp = handlePositions(el, kind);
        if (dist2(p.x,p.y,hp.resize.x,hp.resize.y) <= HANDLE_R*HANDLE_R){
          startElementDrag(canvas, e, 'resize', el); return;
        }
        if (kind!=='border' && dist2(p.x,p.y,hp.rotate.x,hp.rotate.y) <= HANDLE_R*HANDLE_R){
          startElementDrag(canvas, e, 'rotate', el); return;
        }
      }
    }

    // 2. Whichever element is topmost at this point, per the user's layer order.
    const hit = hitTestTopmost(p.x, p.y);
    if (hit){
      const d = hit.kind==='character' ? { kind:'character' } : { kind:hit.kind, id:hit.el.id };
      if (layerKey(state.selected)!==layerKey(d)) selectLayer(d);
      if (hit.kind!=='character') startElementDrag(canvas, e, 'move', hit.el); // character is always centered — select only, no move-drag
      return;
    }

    // 3. Nothing hit — fall back to the background layer, and drag the photo if there is one (unless locked)
    if (layerKey(state.selected)!=='background') selectLayer({ kind:'background' });
    if (state.bg.imageOn && state.bg.img && !state.bg.locked){
      state.dragging = true;
      state.dragTarget = 'bg';
      state.dragMode = 'move';
      state.dragStartX = e.clientX; state.dragStartY = e.clientY;
      state.dragStartOffX = state.bg.offsetXFrac; state.dragStartOffY = state.bg.offsetYFrac;
      canvas.setPointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener('pointermove', e=>{
    if (!state.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const p = pointerFrac(canvas, e);

    if (state.dragTarget==='bg'){
      const dxFrac = (e.clientX - state.dragStartX) / rect.width;
      const dyFrac = (e.clientY - state.dragStartY) / rect.height;
      state.bg.offsetXFrac = state.dragStartOffX + dxFrac;
      state.bg.offsetYFrac = state.dragStartOffY + dyFrac;
      clampBgTransform();
    } else if (state.dragTarget && state.dragMode==='move'){
      const dxFrac = (e.clientX - state.dragStartX) / rect.width;
      const dyFrac = (e.clientY - state.dragStartY) / rect.height;
      state.dragTarget.xFrac = state.dragStartOffX + dxFrac;
      state.dragTarget.yFrac = state.dragStartOffY + dyFrac;
      // Character never gets a 'move' drag (always centered) — this only
      // ever runs for sticker/shape/wordart/text, all of which should be
      // held back from leaving the cut line entirely.
      clampElementToCutLine(state.dragTarget);
    } else if (state.dragTarget && state.dragMode==='resize'){
      const dist = Math.hypot(p.x-state.dragTarget.xFrac, p.y-state.dragTarget.yFrac);
      const ratio = dist/state.dragStartDist;
      if (state.dragIsText && state.dragTarget.placement !== 'straight'){
        // Curved text: the handle adjusts how far the curve sits from
        // center, independent of the font-size number field.
        state.dragTarget.arcRadiusMult = Math.max(0.2, Math.min(2.5, state.dragStartScale * ratio));
      } else if (state.dragIsText){
        state.dragTarget.size = Math.max(0.3, Math.min(5, state.dragStartScale * ratio));
        clampTextSize(state.dragTarget);
        clampElementToCutLine(state.dragTarget);
      } else if (state.dragTarget === state.border){
        // Small tweak range only — this compensates for asset borders that
        // aren't perfectly circular, not a general resize.
        state.dragTarget.scale = Math.max(0.7, Math.min(1.3, state.dragStartScale * ratio));
      } else {
        state.dragTarget.scale = Math.max(0.3, Math.min(3, state.dragStartScale * ratio));
      }
    } else if (state.dragTarget && state.dragMode==='rotate'){
      const angle = Math.atan2(p.y-state.dragTarget.yFrac, p.x-state.dragTarget.xFrac);
      state.dragTarget.rotation = state.dragStartRotation + (angle - state.dragStartAngle);
    }
    drawPreview();
  });
  canvas.addEventListener('pointerup', ()=>{ state.dragging=false; state.dragTarget=null; });
  canvas.addEventListener('pointercancel', ()=>{ state.dragging=false; state.dragTarget=null; });

  const stickerOrCharSelected = () => state.selected && ['sticker','shape','wordart','character','text','border'].includes(state.selected.kind);

  canvas.addEventListener('wheel', e=>{
    if (!state.bg.imageOn || !state.bg.img || state.bg.locked || stickerOrCharSelected()) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    state.bg.scale = state.bg.scale*delta;
    clampBgTransform();
    drawPreview();
  }, { passive:false });

  // Basic pinch-to-zoom for touch (background only, when no sticker/character is selected)
  let pinchStartDist = null, pinchStartScale = 1;
  canvas.addEventListener('touchstart', e=>{
    if (e.touches.length===2){
      pinchStartDist = touchDist(e.touches);
      pinchStartScale = state.bg.scale;
    }
  }, { passive:true });
  canvas.addEventListener('touchmove', e=>{
    if (e.touches.length===2 && pinchStartDist && state.bg.imageOn && !state.bg.locked && !stickerOrCharSelected()){
      e.preventDefault();
      const d = touchDist(e.touches);
      state.bg.scale = pinchStartScale * (d/pinchStartDist);
      clampBgTransform();
      drawPreview();
    }
  }, { passive:false });
  canvas.addEventListener('touchend', ()=>{ pinchStartDist=null; });
}
function touchDist(touches){
  const dx = touches[0].clientX-touches[1].clientX, dy = touches[0].clientY-touches[1].clientY;
  return Math.sqrt(dx*dx+dy*dy);
}

/* ── DRAWING ──────────────────────────────────── */
// clipElements=false (live editor only — see drawPreview) skips the circular
// clip for the foreground pass so a sticker/text/etc dragged out toward the
// canvas edge stays visible instead of silently vanishing, making it easy to
// grab and pull back. Background/border stay clipped either way. Exports and
// the submit-step review thumbnail always keep the default (clipped) so the
// finished-look preview is accurate.
function drawDesignLayer(ctx, sizePx, opts){
  const clipElements = !opts || opts.clipElements !== false;
  const artboardPx = sizePx; // canvas itself represents the full artboard (incl bleed)
  ctx.clearRect(0,0,sizePx,sizePx);

  // Everything printable is physically round — clip the design layer
  // (background, border, and — when clipElements — everything else too)
  // to the pin's circular shape.
  ctx.save();
  ctx.beginPath();
  ctx.arc(artboardPx/2, artboardPx/2, artboardPx/2, 0, Math.PI*2);
  ctx.clip();

  drawBackground(ctx, artboardPx);  // back-most (color, then image)
  drawBorder(ctx, artboardPx);      // fixed just above background, below everything else
  if (clipElements) drawForegroundElements(ctx, artboardPx);

  ctx.restore();
  if (!clipElements) drawForegroundElements(ctx, artboardPx);
}

// Everything else draws in the user-defined stacking order (state.layerOrder,
// back-to-front), managed via the Layers tab.
function drawForegroundElements(ctx, artboardPx){
  state.layerOrder.forEach(d => {
    if (d.kind==='character') drawOneCharacter(ctx, artboardPx);
    else if (d.kind==='sticker' || d.kind==='shape' || d.kind==='wordart') drawOnePlaced(ctx, artboardPx, placedArray(d.kind).find(x=>x.id===d.id));
    else if (d.kind==='text') drawOneTextLine(ctx, artboardPx, state.textLines.find(t=>t.id===d.id));
  });
}

function drawBackground(ctx, artboardPx){
  if (state.bg.colorOn && state.bg.color){
    // Same diagonal-gradient algorithm as the kiosk avatar builder (morphii.js)
    const g = state.bg.color;
    const grad = ctx.createLinearGradient(0,0,artboardPx,artboardPx);
    if (g.grad4){
      const [tl,tr,bl,br] = g.grad4;
      grad.addColorStop(0,tl); grad.addColorStop(0.33,tr); grad.addColorStop(0.66,br); grad.addColorStop(1,bl);
    } else {
      grad.addColorStop(0,g.grad[0]); grad.addColorStop(1,g.grad[1]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,artboardPx,artboardPx);
  } else if (!state.bg.imageOn || !state.bg.img){
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,artboardPx,artboardPx);
  }

  if (state.bg.imageOn && state.bg.img){
    ctx.save();
    ctx.globalAlpha = state.bg.opacity;
    const img = state.bg.img;
    const baseScale = artboardPx / Math.min(img.naturalWidth, img.naturalHeight);
    const drawScale = baseScale * state.bg.scale;
    const w = img.naturalWidth * drawScale, h = img.naturalHeight * drawScale;
    const cx = artboardPx/2 + state.bg.offsetXFrac*artboardPx;
    const cy = artboardPx/2 + state.bg.offsetYFrac*artboardPx;
    ctx.drawImage(img, cx-w/2, cy-h/2, w, h);
    ctx.restore();
  }
}

const STICKER_BASE_R = 0.14;    // fraction of artboard diameter, at scale=1 — shared by sticker/shape/wordart
const CHARACTER_BASE_R = 0.275;

function drawOnePlaced(ctx, artboardPx, el){
  if (!el || !el.img) return;
  drawPlacedImage(ctx, artboardPx, el.img, el.xFrac, el.yFrac, STICKER_BASE_R*2*el.scale, el.rotation||0);
}

// Single full-circle decorative frame, fixed above the background — the
// asset should be authored as a square PNG with a transparent center so it
// overlays the pin edge-to-edge like a picture frame. Sized to the finished
// CUT diameter (not the paper/bleed diameter), so it always sits fully
// inside the cut line and automatically rescales for whatever size is picked.
function drawBorder(ctx, artboardPx){
  if (!state.border || !state.border.img) return;
  const cutFrac = (state.size / state.paperSize) * (state.border.scale||1);
  drawPlacedImage(ctx, artboardPx, state.border.img, 0, 0, cutFrac, state.border.rotation||0);
}

function drawOneCharacter(ctx, artboardPx){
  if (!state.character || !state.character.img) return;
  const c = state.character;
  drawPlacedImage(ctx, artboardPx, c.img, 0, 0, CHARACTER_BASE_R*2*c.scale, c.rotation||0);
}

function drawPlacedImage(ctx, artboardPx, img, xFrac, yFrac, dFrac, rotation){
  const d = artboardPx * dFrac;
  const cx = artboardPx/2 + xFrac*artboardPx;
  const cy = artboardPx/2 + yFrac*artboardPx;
  const ar = img.naturalWidth / img.naturalHeight;
  const w = ar >= 1 ? d : d*ar, h = ar >= 1 ? d/ar : d;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.drawImage(img, -w/2, -h/2, w, h);
  ctx.restore();
}

// The text's own bounding radius (in artboard-fraction units) — used for hit
// testing, position clamping, and sizing the resize/rotate handle ring.
function textFootprintFrac(t){
  const ctx = document.getElementById('designCanvas').getContext('2d');
  const scalePxPerMM = CANVAS_PX / artboardDiameter();
  const cutRadiusPx = (state.size/2) * scalePxPerMM;
  ctx.font = `bold ${28*t.size}px "${t.font}", 'Nunito', sans-serif`;
  const width = ctx.measureText(t.text || 'Text').width;
  const height = 28*t.size*1.15;
  const rPx = t.placement==='straight' ? Math.hypot(width/2, height/2) : (cutRadiusPx*(t.arcRadiusMult||0.78)) + height/2;
  return rPx / CANVAS_PX;
}

// Auto-shrinks a text line's size so it never renders past the safe-area
// circle — called whenever text/size/font/placement changes. Curved text
// (top-arc/bottom-arc) is exempt: those assets are often meant to run right
// up to (or past) the safe area on purpose, so the customer gets full manual
// control over size instead of an automatic shrink.
function clampTextSize(t){
  if (t.placement !== 'straight') return;
  const ctx = document.getElementById('designCanvas').getContext('2d');
  const scalePxPerMM = CANVAS_PX / artboardDiameter();
  const cutRadiusPx = (state.size/2) * scalePxPerMM;
  const safeRadiusPx = cutRadiusPx - safeInset()*scalePxPerMM;
  const text = t.text || 'Text';

  for (let i=0; i<20; i++){
    ctx.font = `bold ${28*t.size}px "${t.font}", 'Nunito', sans-serif`;
    const width = ctx.measureText(text).width;
    const height = 28*t.size*1.15;
    let overflowRatio;
    if (t.placement==='straight'){
      const halfDiag = Math.hypot(width/2, height/2);
      overflowRatio = halfDiag / safeRadiusPx;
    } else {
      const arcRadius = cutRadiusPx*0.78;
      const outerEdge = arcRadius + height/2;
      overflowRatio = outerEdge / safeRadiusPx;
    }
    if (overflowRatio <= 1.001) break;
    t.size = Math.max(0.3, t.size / overflowRatio);
  }
}

// Character/sticker/shape/wordart/text can be dragged freely, but their
// center point is clamped to the cut-line radius — that lets roughly half
// of the element spill past the cut line (some customers design that way
// on purpose) without letting it be dragged fully outside, where it'd be
// pointless (none of it would print) and easy to lose track of.
function clampElementToCutLine(el){
  const cutFrac = state.size / state.paperSize / 2;
  const dist = Math.hypot(el.xFrac, el.yFrac);
  if (dist > cutFrac && dist > 0){
    const ratio = cutFrac / dist;
    el.xFrac *= ratio; el.yFrac *= ratio;
  }
}

function drawOneTextLine(ctx, artboardPx, t){
  if (!t) return;
  const scalePxPerMM = artboardPx / artboardDiameter();
  const cutRadiusPx = (state.size/2) * scalePxPerMM;
  ctx.save();
  ctx.font = `bold ${28*t.size}px "${t.font}", 'Nunito', sans-serif`;
  ctx.fillStyle = t.color;
  if (t.shadow){
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
  }
  const cx = artboardPx/2 + (t.xFrac||0)*artboardPx;
  const cy = artboardPx/2 + (t.yFrac||0)*artboardPx;
  // Rotate the whole element (straight text or the entire arc) around its
  // own anchor point, matching how sticker/character rotation works.
  if (t.rotation){
    ctx.translate(cx, cy);
    ctx.rotate(t.rotation);
    ctx.translate(-cx, -cy);
  }
  if (t.placement==='straight'){
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(t.text, cx, cy);
  } else {
    drawArcText(ctx, t.text, cx, cy, cutRadiusPx*(t.arcRadiusMult||0.78), t.placement==='bottom-arc');
  }
  ctx.restore();
}

function drawArcText(ctx, text, cx, cy, radius, bottom){
  // Position sweep already goes left-to-right for both top and bottom arcs
  // (see angle formula below) — reversing characters here would mirror the
  // reading order, so the same left-to-right char order is used for both.
  const chars = text.split('');
  const widths = chars.map(c=>ctx.measureText(c).width + 2);
  const totalAngle = widths.reduce((a,w)=>a + w/radius, 0);
  let a = -totalAngle/2;
  ctx.textAlign = 'center'; ctx.textBaseline = bottom ? 'top' : 'bottom';
  chars.forEach((ch,i)=>{
    const half = (widths[i]/radius)/2;
    a += half;
    const angle = bottom ? (Math.PI - a) : a;
    const x = cx + radius*Math.sin(angle);
    const y = cy - radius*Math.cos(angle);
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(bottom ? (angle - Math.PI) : angle);
    ctx.fillText(ch,0,0);
    ctx.restore();
    a += half;
  });
}

/* ── SELECTION HANDLES (resize + rotate) — sticker/shape/wordart/text,
   character (no handles, always centered), border (resize handle only) ── */
function elementRadiusFrac(el, kind){
  if (kind==='character') return CHARACTER_BASE_R * el.scale;
  if (kind==='sticker' || kind==='shape' || kind==='wordart') return STICKER_BASE_R * el.scale;
  if (kind==='text')      return textFootprintFrac(el);
  if (kind==='border')    return (state.size/state.paperSize/2) * (el.scale||1);
  return 0.14;
}
function handlePositions(el, kind){
  const r = elementRadiusFrac(el, kind);
  const rot = el.rotation || 0;
  const resizeA = rot + Math.PI/4;
  const rotateA = rot - Math.PI/2;
  return {
    resize: { x: el.xFrac + r*1.15*Math.cos(resizeA), y: el.yFrac + r*1.15*Math.sin(resizeA) },
    rotate: { x: el.xFrac + r*1.6*Math.cos(rotateA),  y: el.yFrac + r*1.6*Math.sin(rotateA) },
  };
}
function selectedElementAndKind(){
  if (!state.selected) return {};
  const kind = state.selected.kind;
  const el = kind==='character' ? state.character
    : kind==='border' ? state.border
    : (kind==='sticker' || kind==='shape' || kind==='wordart') ? placedArray(kind).find(x=>x.id===state.selected.id)
    : kind==='text' ? state.textLines.find(t=>t.id===state.selected.id)
    : null;
  return { el, kind };
}
function drawSelectionHandles(ctx, artboardPx){
  const { el, kind } = selectedElementAndKind();
  const handleKinds = ['sticker','shape','wordart','text','border'];
  if (!el || !handleKinds.includes(kind)) return;
  const r = elementRadiusFrac(el, kind) * artboardPx;
  const cx = artboardPx/2 + el.xFrac*artboardPx, cy = artboardPx/2 + el.yFrac*artboardPx;
  const hp = handlePositions(el, kind);

  ctx.save();
  ctx.strokeStyle = '#8FAE7C'; ctx.lineWidth = 2; ctx.setLineDash([5,4]);
  ctx.beginPath(); ctx.arc(cx, cy, r*1.15, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);

  // For curved text this handle adjusts curve radius, not font size — see
  // the resize branch in bindCanvasInteractions.
  const sx = artboardPx/2 + hp.resize.x*artboardPx, sy = artboardPx/2 + hp.resize.y*artboardPx;
  drawHandleDot(ctx, sx, sy, '#FF6F91');

  // Border only gets the resize handle — it already has its own Rotate slider.
  if (kind!=='border'){
    const rx = artboardPx/2 + hp.rotate.x*artboardPx, ry = artboardPx/2 + hp.rotate.y*artboardPx;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(rx,ry); ctx.strokeStyle='rgba(143,174,124,0.6)'; ctx.lineWidth=1.5; ctx.stroke();
    drawHandleDot(ctx, rx, ry, '#4D8FE0');
  }
  ctx.restore();
}
function drawHandleDot(ctx, x, y, color){
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke();
}

// Dims the bleed ring (between the cut line and the paper/artboard edge) so
// it's visually obvious that area gets trimmed off and isn't part of the
// finished, visible pin — live-editing chrome only, not in exports.
function drawOutsideCutDim(ctx, sizePx){
  const scalePxPerMM = sizePx / artboardDiameter();
  const cutR = (state.size/2) * scalePxPerMM;
  const paperR = sizePx/2;
  const cx = sizePx/2, cy = sizePx/2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, paperR, 0, Math.PI*2);
  ctx.moveTo(cx+cutR, cy);
  ctx.arc(cx, cy, cutR, 0, Math.PI*2, true);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill('evenodd');
  ctx.restore();
}

function drawGuides(ctx, sizePx){
  const scalePxPerMM = sizePx / artboardDiameter();
  const cutR = (state.size/2) * scalePxPerMM;
  const safeR = cutR - safeInset()*scalePxPerMM;
  const cx = sizePx/2, cy = sizePx/2;

  ctx.save();
  ctx.strokeStyle = '#FF5E5B'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx,cy,cutR,0,Math.PI*2); ctx.stroke();

  ctx.strokeStyle = '#4DC8F0'; ctx.setLineDash([6,5]);
  ctx.beginPath(); ctx.arc(cx,cy,safeR,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}

function drawWatermark(ctx, sizePx){
  ctx.save();
  ctx.font = 'bold 13px Nunito, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.textAlign = 'center';
  ctx.translate(sizePx/2, sizePx/2);
  ctx.rotate(-Math.PI/6);
  ctx.translate(-sizePx/2, -sizePx/2);
  for (let y=-40; y<sizePx+40; y+=54){
    for (let x=-40; x<sizePx+80; x+=150){
      ctx.strokeText('MORPHII PREVIEW', x, y);
      ctx.fillText('MORPHII PREVIEW', x, y);
    }
  }
  ctx.restore();
}

function drawPreview(){
  const canvas = document.getElementById('designCanvas');
  const ctx = canvas.getContext('2d');
  drawDesignLayer(ctx, CANVAS_PX, { clipElements:false });
  drawOutsideCutDim(ctx, CANVAS_PX);
  drawGuides(ctx, CANVAS_PX);
  drawSelectionHandles(ctx, CANVAS_PX);
  drawWatermark(ctx, CANVAS_PX);
  updateCutlineWarning();
}

// True if any character/sticker/shape/wordart/text currently extends past
// the cut line — center position is clamped (see clampElementToCutLine),
// but resizing after the fact can still push the edge past it.
function anyElementOverlapsCutLine(){
  if (!state.paperSize) return false;
  const cutFrac = state.size / state.paperSize / 2;
  const overlaps = (el, kind) => {
    if (!el) return false;
    const dist = Math.hypot(el.xFrac||0, el.yFrac||0);
    return dist + elementRadiusFrac(el, kind) > cutFrac;
  };
  if (overlaps(state.character, 'character')) return true;
  if (state.textLines.some(t => overlaps(t, 'text'))) return true;
  for (const kind of ['sticker','shape','wordart']){
    if (placedArray(kind).some(el => overlaps(el, kind))) return true;
  }
  return false;
}

function updateCutlineWarning(){
  const el = document.getElementById('cutlineWarning');
  if (!el) return;
  el.style.display = anyElementOverlapsCutLine() ? 'block' : 'none';
}

// Watermarked but WITHOUT guides/handles — those are live-editing chrome and
// shouldn't appear in the submit-step review thumbnail or anywhere else the
// design is just being looked at rather than edited.
function renderWatermarkedPreview(canvas){
  const ctx = canvas.getContext('2d');
  drawDesignLayer(ctx, canvas.width);
  drawWatermark(ctx, canvas.width);
}

/* ── CLEAN EXPORT (no watermark/guides) — admin only ── */
function compositeCleanDesign(){
  const px = Math.round(artboardDiameter() * EXPORT_PPMM);
  const off = document.createElement('canvas');
  off.width = px; off.height = px;
  const ctx = off.getContext('2d');
  drawDesignLayer(ctx, px);
  return shrinkToFit(off, 900*1024); // keep well under Firestore's 1MB doc cap
}

function shrinkToFit(canvas, maxBytes){
  let quality = 0.92;
  let dataUrl = canvas.toDataURL('image/png');
  if (approxBytes(dataUrl) <= maxBytes) return dataUrl;
  // Fall back to JPEG at decreasing quality
  for (let q of [0.9,0.8,0.7,0.6]){
    dataUrl = canvas.toDataURL('image/jpeg', q);
    if (approxBytes(dataUrl) <= maxBytes) return dataUrl;
  }
  // Last resort: shrink resolution
  const small = document.createElement('canvas');
  small.width = Math.round(canvas.width*0.6);
  small.height = Math.round(canvas.height*0.6);
  small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
  return small.toDataURL('image/jpeg', 0.75);
}
function approxBytes(dataUrl){ return Math.round(dataUrl.length*0.75); }

/* ── SUBMIT ───────────────────────────────────── */
function updateSubmitAvailability(){
  const blocked = state.bg.imageOn && state.bg.tainted;
  const btn = document.getElementById('toSubmitBtn');
  if (btn) btn.disabled = blocked;
  const note = document.getElementById('nextDisabledNote');
  if (note) note.style.display = blocked ? 'block' : 'none';
}

function renderSubmitSummary(){
  const wrap = document.getElementById('submitSummary');
  const off = document.createElement('canvas');
  off.width = CANVAS_PX; off.height = CANVAS_PX;
  renderWatermarkedPreview(off);
  const thumb = off.toDataURL('image/png');
  wrap.innerHTML = `
    <img src="${thumb}" alt="Your design preview">
    <div style="font-size:12px;font-weight:800;color:var(--ink-dim)">
      ${state.product.label}<br>${state.size}mm Circle
    </div>`;
}

// 6 chars from a 32-symbol alphabet (no 0/O/1/I to avoid ambiguity) ≈ 1 billion
// combinations — collision risk is negligible at any realistic order volume,
// so no Firestore uniqueness check is needed (customers can't read the orders
// collection anyway; the security rules only allow admin reads).
function generateSaveCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

async function submitDesign(){
  const errEl = document.getElementById('submitError');
  errEl.style.display = 'none';
  const name = document.getElementById('custName').value.trim();
  const email = document.getElementById('custEmail').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  const notes = document.getElementById('custNotes').value.trim();

  if (!name || !email){
    errEl.textContent = 'Please fill in your name and email.';
    errEl.style.display = 'block';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    errEl.textContent = 'Please enter a valid email address.';
    errEl.style.display = 'block';
    return;
  }
  if (!state.bg.colorOn && !state.bg.imageOn){
    errEl.textContent = 'Please add a background before submitting.';
    errEl.style.display = 'block';
    return;
  }
  if (state.bg.imageOn && state.bg.tainted){
    errEl.textContent = "That image link can't be used — please go back and upload the file instead.";
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true; btn.textContent = 'Submitting…';
  try {
    const designDataUrl = compositeCleanDesign();
    const saveCode = generateSaveCode();
    await submitOrder({
      product: state.product.id,
      productLabel: state.product.label,
      size: state.size,
      paperSize: state.paperSize,
      designDataUrl,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      notes,
      saveCode,
    });
    const emailResult = await sendConfirmationEmail({
      to_email: email,
      to_name: name,
      code: saveCode,
      product: state.product.label,
      size: state.size + 'mm',
    });
    showDoneScreen(saveCode, emailResult);
  } catch(e){
    errEl.textContent = 'Something went wrong submitting your design: ' + e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = '✓ Submit My Design';
  }
}
window.submitDesign = submitDesign;

function showDoneScreen(code, emailResult){
  document.getElementById('saveCodeDisplay').textContent = code;
  document.getElementById('emailStatusNote').textContent = (emailResult && emailResult.sent)
    ? "We've also emailed this code to you — if you don't see it in a few minutes, please check your Spam or Junk folder."
    : "We couldn't send the confirmation email automatically — please screenshot or write down your code now.";
  goStep('done');
}

/* ── ASSET LIBRARY (stickers/shapes/word-art/borders/background/character
   presets) — any image file pushed to assets/pins/<category>/ on GitHub is
   automatically live here (that push is the only access control — only
   repo collaborators can do it). Default label is the filename, cleaned
   up; the admin's Assets page can override specific labels (stored in
   Firestore, morphii_config/assetLabels) without touching GitHub. The
   admin page never gates which files show up — it's monitoring/labeling
   only. See assets/pins/README.md. ── */
const PINS_REPO_CONTENTS_BASE = 'https://api.github.com/repos/campingchairph/morphii/contents/assets/pins/';
const PINS_RAW_BASE = 'https://raw.githubusercontent.com/campingchairph/morphii/main/assets/pins/';
// category folder -> preset array it feeds (holders shares Shapes' gallery)
const ASSET_CATEGORY_TARGETS = {
  stickers: () => STICKER_PRESETS,
  shapes: () => SHAPE_PRESETS,
  holders: () => SHAPE_PRESETS,
  texts: () => WORDART_PRESETS,
  borders: () => BORDER_PRESETS,
  background: () => BACKGROUND_PRESETS,
  characters: () => CHARACTER_PRESETS,
};

function assetLabelFromFilename(name){
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}

async function loadPinAssetManifest(){
  let overrides = {};
  try { overrides = await getAssetLabelOverrides(); } catch(e){}
  await Promise.all(Object.keys(ASSET_CATEGORY_TARGETS).map(async cat => {
    try {
      const res = await fetch(PINS_REPO_CONTENTS_BASE + cat);
      if (!res.ok) return; // folder missing/empty — that category just stays empty
      const items = await res.json();
      const target = ASSET_CATEGORY_TARGETS[cat]();
      items
        .filter(it => it.type==='file' && /\.(png|jpe?g|webp|gif)$/i.test(it.name))
        .forEach(it => {
          const url = PINS_RAW_BASE + cat + '/' + it.name;
          target.push({ label: overrides[url] || assetLabelFromFilename(it.name), src: url });
        });
    } catch(e){
      // offline or GitHub unreachable — that category's presets just stay empty
    }
  }));
  renderCanvasBgDecor(); // in case the design step is already open when presets finish loading
}

// Purely decorative — 15 random stickers from the library, floating/
// spinning behind the pin so the design screen doesn't feel static.
// Re-randomized every time the design step is entered (see goStep).
// The floating background pool is whatever the customer has actually added
// to their pin (stickers/shapes/word art/character) — falls back to random
// library presets before they've added anything, so the backdrop isn't empty.
function decorAssetPool(){
  const srcs = [];
  ['sticker','shape','wordart'].forEach(kind => {
    placedArray(kind).forEach(el => { if (el.img && el.img.src) srcs.push(el.img.src); });
  });
  if (state.character && state.character.img && state.character.img.src) srcs.push(state.character.img.src);
  if (srcs.length) return srcs;
  return STICKER_PRESETS.map(p=>p.src);
}

// "Bubbles" physics for the decorative background stickers — each one has
// its own position/velocity and bounces elastically off the wrap edges,
// the pin, and every other sticker (real circle-circle collision), so they
// drift around without ever sitting inside one another.
let _bgPhysics = { items: [], raf: null, w: 0, h: 0, pinCx: 0, pinCy: 0, pinR: 0, lastT: 0 };

function stopBgPhysics(){
  if (_bgPhysics.raf) cancelAnimationFrame(_bgPhysics.raf);
  _bgPhysics.raf = null;
  _bgPhysics.items = [];
}

function renderCanvasBgDecor(){
  const wrap = document.getElementById('canvasBgDecor');
  const stage = document.getElementById('canvasStage');
  if (!wrap || !stage) return;
  stopBgPhysics();
  const pool = decorAssetPool();
  if (!pool.length){ wrap.innerHTML = ''; return; }

  const wrapRect = wrap.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  if (!wrapRect.width || !wrapRect.height || !stageRect.width) return; // not laid out yet

  // Keep every sticker outside the pin's circle (plus its spinning border
  // ring) — previously these were positioned by raw %, so most of them
  // landed underneath the opaque pin and were invisible.
  const pinCx = stageRect.left - wrapRect.left + stageRect.width/2;
  const pinCy = stageRect.top  - wrapRect.top  + stageRect.height/2;
  const pinR  = Math.max(stageRect.width, stageRect.height)/2 * 1.15;

  wrap.innerHTML = '';
  const items = [];
  for (let i=0; i<15; i++){
    const src = pool[Math.floor(Math.random()*pool.length)];
    const size = 26 + Math.random()*34; // 26-60px
    const r = size/2;
    let x, y, tries = 0;
    do {
      x = r + Math.random()*Math.max(1, wrapRect.width - size);
      y = r + Math.random()*Math.max(1, wrapRect.height - size);
      tries++;
    } while (
      (Math.hypot(x-pinCx, y-pinCy) < pinR + r || items.some(o => Math.hypot(x-o.x, y-o.y) < r+o.r))
      && tries < 80
    );

    const el = document.createElement('img');
    el.className = 'cr-bg-sticker';
    el.src = src;
    el.alt = '';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    wrap.appendChild(el);

    const angle = Math.random()*Math.PI*2;
    const speed = 10 + Math.random()*16; // px/sec — gentle drift, not frantic
    items.push({
      el, x, y, r,
      vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
      rot: Math.random()*360, rotSpeed: (Math.random()<0.5?-1:1) * (4+Math.random()*6),
    });
  }

  _bgPhysics.items = items;
  _bgPhysics.w = wrapRect.width; _bgPhysics.h = wrapRect.height;
  _bgPhysics.pinCx = pinCx; _bgPhysics.pinCy = pinCy; _bgPhysics.pinR = pinR;
  _bgPhysics.lastT = performance.now();
  _bgPhysics.raf = requestAnimationFrame(tickBgPhysics);
}

function tickBgPhysics(t){
  const p = _bgPhysics;
  if (!p.items.length) return;
  const dt = Math.min(0.05, (t - p.lastT)/1000); // cap so a backgrounded tab doesn't cause a big jump on return
  p.lastT = t;

  p.items.forEach(it => {
    it.x += it.vx*dt;
    it.y += it.vy*dt;
    it.rot += it.rotSpeed*dt;
  });

  // walls
  p.items.forEach(it => {
    if (it.x - it.r < 0){ it.x = it.r; it.vx = Math.abs(it.vx); }
    else if (it.x + it.r > p.w){ it.x = p.w - it.r; it.vx = -Math.abs(it.vx); }
    if (it.y - it.r < 0){ it.y = it.r; it.vy = Math.abs(it.vy); }
    else if (it.y + it.r > p.h){ it.y = p.h - it.r; it.vy = -Math.abs(it.vy); }
  });

  // bounce off the pin — treated as a static, immovable circle
  p.items.forEach(it => {
    const dx = it.x - p.pinCx, dy = it.y - p.pinCy;
    const dist = Math.hypot(dx, dy);
    const minDist = p.pinR + it.r;
    if (dist > 0 && dist < minDist){
      const nx = dx/dist, ny = dy/dist;
      it.x = p.pinCx + nx*minDist;
      it.y = p.pinCy + ny*minDist;
      const vDotN = it.vx*nx + it.vy*ny;
      if (vDotN < 0){ it.vx -= 2*vDotN*nx; it.vy -= 2*vDotN*ny; }
    }
  });

  // sticker-vs-sticker collisions — equal-mass elastic bounce, so they
  // behave like bubbles that physically can't overlap.
  for (let i=0; i<p.items.length; i++){
    for (let j=i+1; j<p.items.length; j++){
      const a = p.items[i], b = p.items[j];
      const dx = b.x-a.x, dy = b.y-a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.r+b.r;
      if (dist > 0 && dist < minDist){
        const nx = dx/dist, ny = dy/dist;
        const overlap = (minDist-dist)/2;
        a.x -= nx*overlap; a.y -= ny*overlap;
        b.x += nx*overlap; b.y += ny*overlap;
        const avn = a.vx*nx + a.vy*ny;
        const bvn = b.vx*nx + b.vy*ny;
        a.vx += (bvn-avn)*nx; a.vy += (bvn-avn)*ny;
        b.vx += (avn-bvn)*nx; b.vy += (avn-bvn)*ny;
      }
    }
  }

  p.items.forEach(it => {
    it.el.style.transform = `translate(${(it.x-it.r).toFixed(1)}px,${(it.y-it.r).toFixed(1)}px) rotate(${it.rot.toFixed(1)}deg)`;
  });

  p.raf = requestAnimationFrame(tickBgPhysics);
}

// Whatever border the customer picked, echoed bigger as a slow-spinning
// ring just outside the pin. Sized from the pin's real rendered size so it
// stays correct across viewports.
// Only toggles visibility and the image src — actual sizing is a CSS %
// of .cr-canvas-stage (see .cr-canvas-border-ring), so it's always exactly
// in sync with the pin's current size with no JS bookkeeping needed.
function updateCanvasBorderRing(){
  const ring = document.getElementById('canvasBorderRing');
  if (!ring) return;
  if (!state.border || !state.border.src){
    ring.style.display = 'none';
    return;
  }
  if (ring.src !== state.border.src) ring.src = state.border.src;
  ring.style.display = 'block';
}
window.updateCanvasBorderRing = updateCanvasBorderRing;

// Admin-added fonts (orders-admin.html → Fonts) — stored in Firestore
// (morphii_config/fonts), loaded into the FONTS list the text tool offers.
async function loadCustomFonts(){
  try {
    const list = await getCustomFonts();
    list.forEach(f => {
      if (!f || !f.name || !f.url || FONTS.includes(f.name)) return;
      if (!document.querySelector(`link[data-font-url="${f.url}"]`)){
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = f.url;
        link.dataset.fontUrl = f.url;
        document.head.appendChild(link);
      }
      FONTS.push(f.name);
    });
  } catch(e){
    // not configured / offline — text tool just keeps the built-in fonts
  }
}

/* ── INIT ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', ()=>{
  applyCachedCatalogConfig(); // last-known admin settings, before the first paint — no flash
  renderProductGrid();
  loadPinAssetManifest();
  loadCustomFonts();
  loadCatalogConfig();
});

// Keeps the spinning border ring's size correct if the viewport (and so
// the pin's rendered size) changes — e.g. rotating a phone.
window.addEventListener('resize', ()=>{ updateCanvasBorderRing(); });

// Lets the admin toggle product types and sizes on/off (e.g. temporarily
// out of stock) from orders-admin.html without a code deploy. Any id not
// present in the Firestore doc just keeps its hardcoded default `enabled`
// value above, so this is purely additive/overriding.
const CATALOG_CACHE_KEY = 'morphii_catalog_cache_v1';

function applyCatalogOverrides(cfg){
  Object.entries(cfg.products||{}).forEach(([id, enabled]) => {
    const p = PRODUCTS.find(x=>x.id===id);
    if (p) p.enabled = !!enabled;
  });
  Object.entries(cfg.sizes||{}).forEach(([mm, enabled]) => {
    const s = SIZES.find(x=>x.mm===Number(mm));
    if (s) s.enabled = !!enabled;
  });
}

// Synchronous — applied before the very first render so returning
// customers see the correct product/size availability immediately instead
// of the hardcoded defaults flashing briefly while Firestore responds.
function applyCachedCatalogConfig(){
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (raw) applyCatalogOverrides(JSON.parse(raw));
  } catch(e){ /* corrupt cache or storage unavailable — just skip it */ }
}

async function loadCatalogConfig(){
  if (typeof getCatalogConfig !== 'function') return; // firebase-config.js not loaded/configured
  const cfg = await getCatalogConfig();
  applyCatalogOverrides(cfg);
  try { localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(cfg)); } catch(e){ /* storage full/unavailable — not critical */ }
  renderProductGrid();
  if (state.product) renderSizeGrid();
}
