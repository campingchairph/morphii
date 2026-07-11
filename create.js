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

const SIZES = [
  { inches:1.25, tag:'Promo & branding' },
  { inches:1.50, tag:'Versatile size' },
  { inches:2.25, tag:'Most popular' },
  { inches:3.00, tag:'Large & bold' },
];

const STEP_ORDER = ['product','size','print','design','submit','done'];
const CANVAS_PX   = 480;   // fixed on-screen render resolution
const EXPORT_DPI  = 220;   // export resolution for the clean (admin-facing) design
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

// Preset sticker/character libraries — empty for now, assets to be added later
// (either hardcoded here or via the admin asset library once that's built).
// Uploading your own PNG always works regardless of what's in these lists.
const STICKER_PRESETS = [];
const CHARACTER_PRESETS = [];

const state = {
  product: null,
  size: null,
  bleedMode: 'wrap',
  bg: {
    // Color and image are independent layers that can be mixed (color shows
    // through wherever the image doesn't fully cover, or through transparent
    // PNG areas) — each has its own on/off checkbox.
    colorOn:false, color:null,             // one of GRADIENTS
    imageOn:false, img:null, tainted:false, opacity:1,
    offsetXFrac:0, offsetYFrac:0, scale:1,
  },
  textLines: [],
  stickers: [],             // [{id, img, xFrac, yFrac, scale, rotation}]
  character: null,          // {img, scale, rotation} | null
  nextStickerId: 1,
  selected: null,           // {kind:'sticker', id} | {kind:'character'} | null
  dragging:false, dragTarget:null, dragMode:'move', dragStartX:0, dragStartY:0, dragStartOffX:0, dragStartOffY:0,
  dragStartScale:1, dragStartRotation:0, dragStartDist:0, dragStartAngle:0,
  nextTextId: 1,
};

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
  if (name==='print'){ renderPrintStep(); }
  if (name==='design'){ setupCanvas(); drawPreview(); }
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
  state.product = PRODUCTS.find(p=>p.id===id);
  renderSizeGrid();
  goStep('size');
}
window.selectProduct = selectProduct;

/* ── STEP 2: SIZE ─────────────────────────────── */
function renderSizeGrid(){
  const grid = document.getElementById('sizeGrid');
  grid.innerHTML = SIZES.map(s=>`
    <div class="cr-size-card" onclick="selectSize(${s.inches})">
      <div class="cr-size-ring" style="width:${34+s.inches*14}px;height:${34+s.inches*14}px"></div>
      <div class="cr-size-num">${s.inches.toFixed(2)}" Circle</div>
      <div class="cr-size-tag">${s.tag}</div>
    </div>`).join('');
}
function selectSize(inches){
  state.size = inches;
  goStep('print');
}
window.selectSize = selectSize;

/* ── BLEED MATH ───────────────────────────────── */
// "5% of size" / "0.0313in trim" describe the TOTAL bleed added to the
// artboard diameter, so per-side is half of that.
function bleedPerSide(){
  const total = state.bleedMode==='wrap' ? state.size*0.05 : 0.0313;
  return +(total/2).toFixed(4);
}
function artboardDiameter(){ return state.size + 2*bleedPerSide(); }
function safeInset(){
  return state.bleedMode==='wrap' ? bleedPerSide()*2 : 0.03;
}
function setBleedMode(mode){
  state.bleedMode = mode;
  // Font sizes/positions were fit to the old safe area — re-check them against the new one.
  state.textLines.forEach(t => { clampTextSize(t); clampTextPosition(t); });
  renderPrintStep();
  drawPreview();
}
window.setBleedMode = setBleedMode;

function renderPrintStep(){
  const el = document.getElementById('printStepBody');
  if (!el) return;
  el.innerHTML = printPanelHtml();
}

/* ── CANVAS SETUP ─────────────────────────────── */
function setupCanvas(){
  const canvas = document.getElementById('designCanvas');
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  document.getElementById('previewLabel').textContent =
    `${state.product.label} · ${state.size.toFixed(2)}" Circle (${artboardDiameter().toFixed(2)}" with bleed)`;
  if (!state.selected) state.selected = { kind:'background' };
  renderLayerStrip();
  renderSettingsPanel();
  updateSubmitAvailability();
  if (!canvas._boundEvents){
    bindCanvasInteractions(canvas);
    canvas._boundEvents = true;
  }
  const strip = document.getElementById('layerStrip');
  if (strip && !strip._boundScroll){
    strip.addEventListener('scroll', updateLayerStripOverflowArrow, { passive:true });
    strip._boundScroll = true;
  }
  watchCanvasWrapSize();
  sizeCanvasStage();
  requestAnimationFrame(sizeCanvasStage);
  setTimeout(sizeCanvasStage, 60); // fallback in case rAF is throttled (e.g. background tab)
}

// Fits the canvas stage to the largest square available in cr-canvas-wrap,
// since the design step is a fixed no-scroll viewport (pin must always be visible).
function sizeCanvasStage(){
  const wrap = document.querySelector('.cr-canvas-wrap');
  const stage = document.getElementById('canvasStage');
  if (!wrap || !stage) return;
  const side = Math.max(120, Math.min(wrap.clientWidth, wrap.clientHeight));
  stage.style.width = side + 'px';
  stage.style.height = side + 'px';
}
window.addEventListener('resize', ()=>{
  if (document.getElementById('step-design').classList.contains('active')) sizeCanvasStage();
});

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
const ICON_PRINT      = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V4h12v5"/><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M6 16h12v5H6z"/></svg>';
const ICON_PLUS       = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_CLOSE      = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
const ICON_UPLOAD      = '<svg class="cr-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5M4 21h16"/></svg>';

/* ── LAYER SELECTION (tap on the pin OR tap a chip — same result) ── */
function layerKey(l){ return l ? l.kind + (l.id!=null ? ':'+l.id : '') : ''; }

function selectLayer(descriptor){
  state.selected = descriptor;
  renderLayerStrip();
  renderSettingsPanel();
  drawPreview();
}
window.selectLayer = selectLayer;

const ICON_LOCK   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>';
const ICON_UNLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 017.6-1.8"/></svg>';

function renderLayerStrip(){
  const strip = document.getElementById('layerStrip');
  if (!strip) return;
  const activeKey = layerKey(state.selected);
  const chips = [];

  chips.push({ d:{kind:'background'}, label:'Background', thumb: bgChipThumb(), lockable:false });
  chips.push({ d:{kind:'character'}, label:'Character', thumb: state.character ? `<img src="${state.character.img.src}" alt="">` : ICON_CHARACTER, lockable: !!state.character, locked: state.character?.locked });
  state.stickers.forEach((s,i)=> chips.push({ d:{kind:'sticker', id:s.id}, label:'Sticker '+(i+1), thumb:`<img src="${s.img.src}" alt="">`, lockable:true, locked:s.locked }));
  state.textLines.forEach((t,i)=> chips.push({ d:{kind:'text', id:t.id}, label: (t.text||'Text').slice(0,10), thumb: ICON_TEXT, lockable:true, locked:t.locked }));

  // Lockable chips are <div role=button> instead of <button> so they can
  // contain a real nested <button> for the lock toggle (invalid inside <button>).
  strip.innerHTML = chips.map(c => {
    const lockBtn = c.lockable
      ? `<button class="cr-chip-lock-toggle ${c.locked?'locked':''}" onclick='event.stopPropagation();toggleLock("${c.d.kind}"${c.d.id!=null?','+c.d.id:''})' title="${c.locked?'Unlock':'Lock in place'}">${c.locked?ICON_LOCK:ICON_UNLOCK}</button>`
      : '';
    return `
    <div class="cr-layer-chip ${activeKey===layerKey(c.d)?'active':''}" role="button" tabindex="0" onclick='selectLayer(${JSON.stringify(c.d)})'>
      ${lockBtn}
      <span class="cr-layer-thumb">${c.thumb}</span>
      <span class="cr-layer-label">${escHtml(c.label)}</span>
    </div>`;
  }).join('') + `
    <button class="cr-layer-chip cr-layer-add" onclick="quickAddText()">
      <span class="cr-layer-thumb">${ICON_PLUS}</span>
      <span class="cr-layer-label">Add Text</span>
    </button>
    <button class="cr-layer-chip cr-layer-add" onclick="promptUpload('sticker')">
      <span class="cr-layer-thumb">${ICON_PLUS}</span>
      <span class="cr-layer-label">Add Sticker</span>
    </button>`;

  updateLayerStripOverflowArrow();
}

function updateLayerStripOverflowArrow(){
  const strip = document.getElementById('layerStrip');
  const arrow = document.getElementById('layerStripArrow');
  if (!strip || !arrow) return;
  const hasOverflow = strip.scrollWidth > strip.clientWidth + 2;
  const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2;
  arrow.classList.toggle('show', hasOverflow && !atEnd);
}

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

/* ── SETTINGS PANEL (inline, below the pin — not a popup) ─────────── */
function renderSettingsPanel(){
  const panel = document.getElementById('settingsPanel');
  if (!panel) return;
  if (!state.selected){ panel.innerHTML = ''; return; }
  switch (state.selected.kind){
    case 'background': panel.innerHTML = bgPanelHtml(); break;
    case 'character':  panel.innerHTML = characterPanelHtml(); break;
    case 'sticker':    panel.innerHTML = stickerPanelHtml(state.selected.id); break;
    case 'text':       panel.innerHTML = textPanelHtml(state.selected.id); break;
    default:           panel.innerHTML = '';
  }
}

/* ── BACKGROUND PANEL ─────────────────────────── */
let _bgActiveTab = 'upload';
function setBgTab(which){
  _bgActiveTab = which;
  renderSettingsPanel();
}
window.setBgTab = setBgTab;

function bgPanelHtml(){
  const tab = _bgActiveTab;
  let tabBody = '';
  if (tab==='upload'){
    tabBody = `
      <button type="button" class="cr-upload-btn" onclick="promptUpload('background')">
        ${ICON_UPLOAD}<span id="bgUploadLabelText">Choose a Photo</span>
      </button>
      ${state.bg.img ? `<label class="cr-checkbox-row"><input type="checkbox" ${state.bg.imageOn?'checked':''} onchange="toggleImageLayer(this.checked)">Show the photo</label>` : ''}`;
  } else if (tab==='link'){
    tabBody = `
      <input type="text" id="bgLinkInput" placeholder="https://example.com/image.jpg" class="cr-text-input">
      <button class="cr-btn-secondary" onclick="loadBgFromLink()">Load Image</button>
      ${state.bg.img ? `<label class="cr-checkbox-row"><input type="checkbox" ${state.bg.imageOn?'checked':''} onchange="toggleImageLayer(this.checked)">Show the photo</label>` : ''}`;
  } else {
    tabBody = `
      <div class="cr-gradient-grid">${GRADIENTS.map((g,i)=>{
        const css = g.grad4
          ? `conic-gradient(from 45deg, ${g.grad4[0]}, ${g.grad4[1]}, ${g.grad4[3]}, ${g.grad4[2]}, ${g.grad4[0]})`
          : `linear-gradient(135deg, ${g.grad[0]}, ${g.grad[1]})`;
        return `<button class="cr-gradient-swatch ${state.bg.color===g?'active':''}" style="background:${css}" title="${g.label}" onclick="selectGradient(${i})"></button>`;
      }).join('')}</div>
      ${state.bg.color ? `<label class="cr-checkbox-row"><input type="checkbox" ${state.bg.colorOn?'checked':''} onchange="toggleColorLayer(this.checked)">Show this color</label>` : ''}`;
  }

  return `
    <div class="cr-bg-tabs">
      <button class="cr-bg-tab ${tab==='upload'?'active':''}" onclick="setBgTab('upload')">Upload</button>
      <button class="cr-bg-tab ${tab==='link'?'active':''}" onclick="setBgTab('link')">Image Link</button>
      <button class="cr-bg-tab ${tab==='gradient'?'active':''}" onclick="setBgTab('gradient')">Colors</button>
    </div>
    ${tabBody}
    <div id="bgWarning" class="cr-warning" style="display:none"></div>
    <div class="cr-hint">Turn on both a photo and a color to mix them — the color shows through anywhere the photo doesn't fully cover.</div>
    <div class="cr-field-label" style="margin-top:16px">Opacity</div>
    <input type="range" min="0.1" max="1" step="0.05" value="${state.bg.opacity}" oninput="setBgOpacity(this.value)" class="cr-range">
    <div class="cr-hint">Drag the photo to reposition · scroll or pinch to zoom</div>`;
}

function selectGradient(i){
  state.bg.color = GRADIENTS[i];
  state.bg.colorOn = true;
  renderLayerStrip();
  renderSettingsPanel();
  drawPreview();
  updateSubmitAvailability();
}
window.selectGradient = selectGradient;

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
  renderLayerStrip();
  renderSettingsPanel();
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

/* ── UPLOAD INSTRUCTIONS MODAL (with PNG/transparency infographic) ── */
function promptUpload(kind){
  document.getElementById('uploadHintText').textContent =
    `Your ${kind} file should be a PNG with a transparent (no) background, so it blends cleanly into the design.`;
  document.getElementById('uploadHintInputId').value =
    kind==='sticker' ? 'stickerFileInput' : kind==='character' ? 'characterFileInput' : 'bgFileInput';
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

/* ── STICKERS PANEL (freely placed, drag anywhere on the pin) ────── */
function stickerPanelHtml(id){
  const s = state.stickers.find(x=>x.id===id);
  if (!s) return `<div class="cr-empty-hint">This sticker was removed.</div>`;
  return `
    <div class="cr-preset-grid">${STICKER_PRESETS.length
      ? STICKER_PRESETS.map((p,i)=>`<button class="cr-preset-thumb" onclick="addStickerFromPreset(${i})"><img src="${p.src}" alt="${escHtml(p.label||'')}"></button>`).join('')
      : `<div class="cr-empty-hint">More stickers coming soon!</div>`}</div>
    <button type="button" class="cr-upload-btn" style="margin-top:12px" onclick="promptUpload('sticker')">
      ${ICON_UPLOAD}<span>Replace with a New Upload</span>
    </button>
    <div class="cr-field-label" style="margin-top:16px">Size</div>
    <input type="range" class="cr-range" min="0.4" max="2.5" step="0.1" value="${s.scale}" oninput="setStickerScale(${s.id},this.value)">
    <div class="cr-hint">Drag the sticker on the pin to reposition · use the handles to resize/rotate</div>
    ${lockRowHtml('sticker', s.id, s.locked)}
    <button class="cr-text-line-remove" style="margin-top:10px" onclick="removeSticker(${s.id})">Remove this sticker</button>`;
}

function addStickerFromPreset(i){
  const preset = STICKER_PRESETS[i];
  if (!preset) return;
  const img = new Image();
  img.onload = () => {
    const s = { id: state.nextStickerId++, img, xFrac:0.15, yFrac:-0.15, scale:1, rotation:0, locked:false };
    state.stickers.push(s);
    selectLayer({ kind:'sticker', id:s.id });
  };
  img.src = preset.src;
}
window.addStickerFromPreset = addStickerFromPreset;

function onStickerFileChosen(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const s = { id: state.nextStickerId++, img, xFrac:0.15, yFrac:-0.15, scale:1, rotation:0, locked:false };
      state.stickers.push(s);
      selectLayer({ kind:'sticker', id:s.id });
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
window.onStickerFileChosen = onStickerFileChosen;

function removeSticker(id){
  state.stickers = state.stickers.filter(s=>s.id!==id);
  if (state.selected && state.selected.kind==='sticker' && state.selected.id===id) state.selected = { kind:'background' };
  renderLayerStrip();
  renderSettingsPanel();
  drawPreview();
}
window.removeSticker = removeSticker;

function setStickerScale(id, val){
  const s = state.stickers.find(x=>x.id===id);
  if (!s) return;
  s.scale = +val;
  drawPreview();
}
window.setStickerScale = setStickerScale;

/* ── CENTER CHARACTER PANEL (single, big, always centered) ───────── */
function characterPanelHtml(){
  if (!state.character){
    return `
      <div class="cr-preset-grid">${CHARACTER_PRESETS.length
        ? CHARACTER_PRESETS.map((c,i)=>`<button class="cr-preset-thumb" onclick="setCharacterFromPreset(${i})"><img src="${c.src}" alt="${escHtml(c.label||'')}"></button>`).join('')
        : `<div class="cr-empty-hint">More characters coming soon! Upload your own below.</div>`}</div>
      <button type="button" class="cr-upload-btn" style="margin-top:12px" onclick="promptUpload('character')">
        ${ICON_UPLOAD}<span>Upload Your Own Character</span>
      </button>
      <div class="cr-hint">A bigger character or logo that sits in the middle of your pin.</div>`;
  }
  return `
    <img src="${state.character.img.src}" alt="" style="width:64px;height:64px;object-fit:contain;border-radius:12px;background:var(--cream-deep);display:block;margin-bottom:12px">
    <button type="button" class="cr-upload-btn" onclick="promptUpload('character')">
      ${ICON_UPLOAD}<span>Replace with a New Upload</span>
    </button>
    <div class="cr-field-label" style="margin-top:16px">Size</div>
    <input type="range" class="cr-range" min="0.5" max="2" step="0.1" value="${state.character.scale}" oninput="setCharacterScale(this.value)">
    <div class="cr-hint">Tap it on the pin to select, then use the handles to resize/rotate — position is always centered</div>
    ${lockRowHtml('character', null, state.character.locked)}
    <button class="cr-text-line-remove" style="margin-top:10px" onclick="removeCharacter()">Remove character</button>`;
}

function lockRowHtml(kind, id, locked){
  return `<button class="cr-lock-btn ${locked?'locked':''}" onclick="toggleLock('${kind}'${id!=null?','+id:''})">
    ${locked?ICON_LOCK:ICON_UNLOCK}<span>${locked?'Locked — tap to unlock':'Lock this in place'}</span>
  </button>`;
}
function toggleLock(kind, id){
  const el = kind==='character' ? state.character
    : kind==='sticker' ? state.stickers.find(s=>s.id===id)
    : state.textLines.find(t=>t.id===id);
  if (!el) return;
  el.locked = !el.locked;
  renderLayerStrip();
  renderSettingsPanel();
}
window.toggleLock = toggleLock;

function setCharacterFromPreset(i){
  const preset = CHARACTER_PRESETS[i];
  if (!preset) return;
  const img = new Image();
  img.onload = () => { state.character = { img, scale:1, rotation:0, xFrac:0, yFrac:0, locked:false }; selectLayer({kind:'character'}); };
  img.src = preset.src;
}
window.setCharacterFromPreset = setCharacterFromPreset;

function onCharacterFileChosen(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => { state.character = { img, scale:1, rotation:0, xFrac:0, yFrac:0, locked:false }; selectLayer({kind:'character'}); };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
window.onCharacterFileChosen = onCharacterFileChosen;

function removeCharacter(){
  state.character = null;
  if (state.selected && state.selected.kind==='character') state.selected = { kind:'background' };
  renderLayerStrip();
  renderSettingsPanel();
  drawPreview();
}
window.removeCharacter = removeCharacter;

function setCharacterScale(val){
  if (!state.character) return;
  state.character.scale = +val;
  drawPreview();
}
window.setCharacterScale = setCharacterScale;

/* ── TEXT PANEL ───────────────────────────────── */
function addTextLine(){
  const line = { id: state.nextTextId++, text:'Your Text', font:FONTS[0], color:'#FFFFFF', placement:'straight', size:1, shadow:false, xFrac:0, yFrac:0, locked:false };
  state.textLines.push(line);
  selectLayer({ kind:'text', id: line.id });
}
window.addTextLine = addTextLine;

function removeTextLine(id){
  state.textLines = state.textLines.filter(t=>t.id!==id);
  if (state.selected && state.selected.kind==='text' && state.selected.id===id) state.selected = { kind:'background' };
  renderLayerStrip();
  renderSettingsPanel();
  drawPreview();
}
window.removeTextLine = removeTextLine;

function updateTextLine(id, field, value){
  const line = state.textLines.find(t=>t.id===id);
  if (!line) return;
  line[field] = value;
  if (field==='size' || field==='text' || field==='placement' || field==='font'){
    clampTextSize(line);
    clampTextPosition(line);
    if (field==='size'){
      const slider = document.getElementById('textSizeSlider_'+id);
      if (slider) slider.value = line.size;
    }
  }
  if (field==='text' || field==='placement'){
    // layer strip label / thumbnail may need to reflect the new text
    renderLayerStrip();
  }
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

const TEXT_COLORS = [
  '#1E2A20','#FFFFFF','#FF6F91','#8FAE7C','#F2B441','#4D8FE0','#B25CE0','#E05C5C',
  '#FF9E00','#00B894','#0984E3','#D63384','#6C5CE7','#00CEC9','#E17055','#2D3436',
];

function textPanelHtml(id){
  const t = state.textLines.find(x=>x.id===id);
  if (!t) return `<div class="cr-empty-hint">This text line was removed.</div>`;
  return `
    <input type="text" class="cr-text-input" style="margin-bottom:10px" value="${escHtml(t.text)}" maxlength="24"
      oninput="updateTextLine(${t.id},'text',this.value)">
    <div class="cr-text-line-row">
      <select class="cr-select" onchange="updateTextLine(${t.id},'placement',this.value)">
        <option value="straight" ${t.placement==='straight'?'selected':''}>Straight</option>
        <option value="top-arc" ${t.placement==='top-arc'?'selected':''}>Top Arc</option>
        <option value="bottom-arc" ${t.placement==='bottom-arc'?'selected':''}>Bottom Arc</option>
      </select>
      <select class="cr-select" onchange="updateTextLine(${t.id},'font',this.value)">
        ${FONTS.map(f=>`<option value="${f}" ${t.font===f?'selected':''}>${f}</option>`).join('')}
      </select>
    </div>
    <div class="cr-field-label" style="margin-top:10px">Size</div>
    <input type="range" id="textSizeSlider_${t.id}" class="cr-range" min="0.5" max="2.2" step="0.1" value="${t.size}"
      oninput="updateTextLine(${t.id},'size',+this.value)">
    <div class="cr-hint" style="margin-top:-6px">Size auto-shrinks so text always stays inside the safe area.</div>
    <div class="cr-field-label" style="margin-top:10px">Color</div>
    <div class="cr-swatch-row">
      ${TEXT_COLORS.map(c=>`<button class="cr-swatch ${t.color===c?'active':''}" style="background:${c}" onclick="updateTextLine(${t.id},'color','${c}');renderSettingsPanel()"></button>`).join('')}
    </div>
    <label class="cr-checkbox-row">
      <input type="checkbox" ${t.shadow?'checked':''} onchange="toggleTextShadow(${t.id},this.checked)">
      Drop shadow
    </label>
    <div class="cr-hint" style="margin-top:10px">Drag the text directly on the pin to reposition it.</div>
    ${lockRowHtml('text', t.id, t.locked)}
    <button class="cr-text-line-remove" style="margin-top:10px" onclick="removeTextLine(${t.id})">Remove this text line</button>`;
}

/* ── PRINT SETTINGS PANEL ─────────────────────── */
function printPanelHtml(){
  return `
    <div class="cr-bleed-row">
      <button class="cr-bleed-btn ${state.bleedMode==='wrap'?'active':''}" onclick="setBleedMode('wrap')">
        <div class="cr-bleed-name">Wrap</div>
        <div class="cr-bleed-sub">5% of size</div>
      </button>
      <button class="cr-bleed-btn ${state.bleedMode==='diecut'?'active':''}" onclick="setBleedMode('diecut')">
        <div class="cr-bleed-name">Die-Cut</div>
        <div class="cr-bleed-sub">0.0313" trim</div>
      </button>
    </div>
    <div class="cr-bleed-note">${bleedNoteText()}</div>`;
}
function bleedNoteText(){
  return state.bleedMode==='wrap'
    ? `Wrap Mode: artwork extends past the blue safe line to the red cut line (${bleedPerSide().toFixed(3)}" bleed per side). That extra area wraps around the pin shell during assembly.`
    : `Die-Cut Mode: artwork is cut to exact size along the red line (${bleedPerSide().toFixed(4)}" trim). Keep important content inside the blue safe line.`;
}

/* ── CANVAS INTERACTIONS: drag bg, move/resize/rotate stickers+character ── */
function hitTestSticker(xFrac, yFrac){
  for (let i = state.stickers.length - 1; i >= 0; i--){
    const s = state.stickers[i];
    const r = STICKER_BASE_R * s.scale;
    if (dist2(xFrac,yFrac,s.xFrac,s.yFrac) <= r*r) return s;
  }
  return null;
}
// Text is drawn last (topmost), so it's checked first when tapping the canvas.
function hitTestText(xFrac, yFrac){
  const ctx = document.getElementById('designCanvas').getContext('2d');
  const scalePxPerInch = CANVAS_PX / artboardDiameter();
  const cutRadiusPx = (state.size/2) * scalePxPerInch;
  for (let i = state.textLines.length - 1; i >= 0; i--){
    const t = state.textLines[i];
    ctx.font = `bold ${28*t.size}px "${t.font}", 'Nunito', sans-serif`;
    const width = ctx.measureText(t.text || 'Text').width;
    const height = 28*t.size*1.15;
    const rPx = t.placement==='straight' ? Math.hypot(width/2, height/2) : (cutRadiusPx*0.78) + height/2;
    const rFrac = rPx / CANVAS_PX;
    if (dist2(xFrac,yFrac,t.xFrac||0,t.yFrac||0) <= rFrac*rFrac) return t;
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
  state.dragStartX = e.clientX; state.dragStartY = e.clientY;
  state.dragStartOffX = el.xFrac; state.dragStartOffY = el.yFrac;
  state.dragStartScale = el.scale;
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

    // 1. Handles of the currently selected element take priority (skipped if locked)
    if (state.selected && (state.selected.kind==='sticker' || state.selected.kind==='character')){
      const isChar = state.selected.kind==='character';
      const el = isChar ? state.character : state.stickers.find(s=>s.id===state.selected.id);
      if (el && !el.locked){
        const hp = handlePositions(el, isChar);
        if (dist2(p.x,p.y,hp.resize.x,hp.resize.y) <= HANDLE_R*HANDLE_R){
          startElementDrag(canvas, e, 'resize', el); return;
        }
        if (dist2(p.x,p.y,hp.rotate.x,hp.rotate.y) <= HANDLE_R*HANDLE_R){
          startElementDrag(canvas, e, 'rotate', el); return;
        }
      }
    }

    // 2. Text (topmost layer), then stickers, then the center character
    const textHit = hitTestText(p.x, p.y);
    if (textHit){
      if (layerKey(state.selected)!==layerKey({kind:'text',id:textHit.id})) selectLayer({ kind:'text', id: textHit.id });
      if (!textHit.locked) startElementDrag(canvas, e, 'move', textHit);
      return;
    }
    const sticker = hitTestSticker(p.x, p.y);
    if (sticker){
      if (layerKey(state.selected)!==layerKey({kind:'sticker',id:sticker.id})) selectLayer({ kind:'sticker', id: sticker.id });
      if (!sticker.locked) startElementDrag(canvas, e, 'move', sticker);
      return;
    }
    if (state.character && dist2(p.x,p.y,0,0) <= Math.pow(elementRadiusFrac(state.character,true),2)){
      if (layerKey(state.selected)!==layerKey({kind:'character'})) selectLayer({ kind:'character' });
      return; // character position is always centered — select only, no move-drag
    }

    // 3. Nothing hit — fall back to the background layer, and drag the photo if there is one
    if (layerKey(state.selected)!=='background') selectLayer({ kind:'background' });
    if (state.bg.imageOn && state.bg.img){
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
      if (state.textLines.includes(state.dragTarget)) clampTextPosition(state.dragTarget);
    } else if (state.dragTarget && state.dragMode==='resize'){
      const dist = Math.hypot(p.x-state.dragTarget.xFrac, p.y-state.dragTarget.yFrac);
      state.dragTarget.scale = Math.max(0.3, Math.min(3, state.dragStartScale * (dist/state.dragStartDist)));
    } else if (state.dragTarget && state.dragMode==='rotate'){
      const angle = Math.atan2(p.y-state.dragTarget.yFrac, p.x-state.dragTarget.xFrac);
      state.dragTarget.rotation = state.dragStartRotation + (angle - state.dragStartAngle);
    }
    drawPreview();
  });
  canvas.addEventListener('pointerup', ()=>{ state.dragging=false; state.dragTarget=null; });
  canvas.addEventListener('pointercancel', ()=>{ state.dragging=false; state.dragTarget=null; });

  const stickerOrCharSelected = () => state.selected && (state.selected.kind==='sticker' || state.selected.kind==='character');

  canvas.addEventListener('wheel', e=>{
    if (!state.bg.imageOn || !state.bg.img || stickerOrCharSelected()) return;
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
    if (e.touches.length===2 && pinchStartDist && state.bg.imageOn && !stickerOrCharSelected()){
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
function drawDesignLayer(ctx, sizePx){
  const artboardPx = sizePx; // canvas itself represents the full artboard (incl bleed)
  ctx.clearRect(0,0,sizePx,sizePx);

  // Everything printable is physically round — clip the whole design layer
  // (background, stickers, character, text) to the pin's circular shape.
  ctx.save();
  ctx.beginPath();
  ctx.arc(artboardPx/2, artboardPx/2, artboardPx/2, 0, Math.PI*2);
  ctx.clip();

  drawBackground(ctx, artboardPx);
  drawCharacter(ctx, artboardPx);   // center character sits below stickers
  drawStickers(ctx, artboardPx);    // stickers layer on top
  drawTextLines(ctx, artboardPx);

  ctx.restore();
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

const STICKER_BASE_R = 0.14;    // fraction of artboard diameter, at scale=1
const CHARACTER_BASE_R = 0.275;

function drawStickers(ctx, artboardPx){
  state.stickers.forEach(s=>{
    if (!s.img) return;
    drawPlacedImage(ctx, artboardPx, s.img, s.xFrac, s.yFrac, STICKER_BASE_R*2*s.scale, s.rotation||0);
  });
}

function drawCharacter(ctx, artboardPx){
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

// Auto-shrinks a text line's size so it never renders past the safe-area
// circle — called whenever text/size/font/placement changes.
function clampTextSize(t){
  const ctx = document.getElementById('designCanvas').getContext('2d');
  const scalePxPerInch = CANVAS_PX / artboardDiameter();
  const cutRadiusPx = (state.size/2) * scalePxPerInch;
  const safeRadiusPx = cutRadiusPx - safeInset()*scalePxPerInch;
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

// Text can be dragged off-center, but never far enough that it would spill
// past the safe area — clamps xFrac/yFrac given the text's current footprint.
function clampTextPosition(t){
  const ctx = document.getElementById('designCanvas').getContext('2d');
  const scalePxPerInch = CANVAS_PX / artboardDiameter();
  const cutRadiusPx = (state.size/2) * scalePxPerInch;
  const safeRadiusPx = cutRadiusPx - safeInset()*scalePxPerInch;
  const text = t.text || 'Text';
  ctx.font = `bold ${28*t.size}px "${t.font}", 'Nunito', sans-serif`;
  const width = ctx.measureText(text).width;
  const height = 28*t.size*1.15;

  let footprintPx;
  if (t.placement==='straight'){
    footprintPx = Math.hypot(width/2, height/2);
  } else {
    footprintPx = (cutRadiusPx*0.78) + height/2;
  }
  const maxOffsetPx = Math.max(0, safeRadiusPx - footprintPx);
  const maxOffsetFrac = maxOffsetPx / CANVAS_PX;
  const dist = Math.hypot(t.xFrac, t.yFrac);
  if (dist > maxOffsetFrac && dist > 0){
    const ratio = maxOffsetFrac / dist;
    t.xFrac *= ratio; t.yFrac *= ratio;
  }
}

function drawTextLines(ctx, artboardPx){
  const scalePxPerInch = artboardPx / artboardDiameter();
  const cutRadiusPx = (state.size/2) * scalePxPerInch;
  state.textLines.forEach(t=>{
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
    if (t.placement==='straight'){
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(t.text, cx, cy);
    } else {
      drawArcText(ctx, t.text, cx, cy, cutRadiusPx*0.78, t.placement==='bottom-arc');
    }
    ctx.restore();
  });
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

/* ── SELECTION HANDLES (resize + rotate) ─────── */
function elementRadiusFrac(el, isCharacter){
  return (isCharacter ? CHARACTER_BASE_R : STICKER_BASE_R) * el.scale;
}
function handlePositions(el, isCharacter){
  const r = elementRadiusFrac(el, isCharacter);
  const rot = el.rotation || 0;
  const resizeA = rot + Math.PI/4;
  const rotateA = rot - Math.PI/2;
  return {
    resize: { x: el.xFrac + r*1.15*Math.cos(resizeA), y: el.yFrac + r*1.15*Math.sin(resizeA) },
    rotate: { x: el.xFrac + r*1.6*Math.cos(rotateA),  y: el.yFrac + r*1.6*Math.sin(rotateA) },
  };
}
function drawSelectionHandles(ctx, artboardPx){
  if (!state.selected) return;
  if (state.selected.kind!=='sticker' && state.selected.kind!=='character') return;
  const isChar = state.selected.kind==='character';
  const el = isChar ? state.character : state.stickers.find(s=>s.id===state.selected.id);
  if (!el) return;
  const r = elementRadiusFrac(el, isChar) * artboardPx;
  const cx = artboardPx/2 + el.xFrac*artboardPx, cy = artboardPx/2 + el.yFrac*artboardPx;
  const hp = handlePositions(el, isChar);

  ctx.save();
  ctx.strokeStyle = '#8FAE7C'; ctx.lineWidth = 2; ctx.setLineDash([5,4]);
  ctx.beginPath(); ctx.arc(cx, cy, r*1.15, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);

  const rx = artboardPx/2 + hp.rotate.x*artboardPx, ry = artboardPx/2 + hp.rotate.y*artboardPx;
  const sx = artboardPx/2 + hp.resize.x*artboardPx, sy = artboardPx/2 + hp.resize.y*artboardPx;

  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(rx,ry); ctx.strokeStyle='rgba(143,174,124,0.6)'; ctx.lineWidth=1.5; ctx.stroke();

  drawHandleDot(ctx, sx, sy, '#FF6F91');
  drawHandleDot(ctx, rx, ry, '#4D8FE0');
  ctx.restore();
}
function drawHandleDot(ctx, x, y, color){
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke();
}

function drawGuides(ctx, sizePx){
  const scalePxPerInch = sizePx / artboardDiameter();
  const cutR = (state.size/2) * scalePxPerInch;
  const safeR = cutR - safeInset()*scalePxPerInch;
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
  drawDesignLayer(ctx, CANVAS_PX);
  drawGuides(ctx, CANVAS_PX);
  drawSelectionHandles(ctx, CANVAS_PX);
  drawWatermark(ctx, CANVAS_PX);
}

/* ── CLEAN EXPORT (no watermark/guides) — admin only ── */
function compositeCleanDesign(){
  const px = Math.round(artboardDiameter() * EXPORT_DPI);
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
  const thumb = document.getElementById('designCanvas').toDataURL('image/png');
  wrap.innerHTML = `
    <img src="${thumb}" alt="Your design preview">
    <div style="font-size:12px;font-weight:800;color:var(--ink-dim)">
      ${state.product.label}<br>${state.size.toFixed(2)}" Circle · ${state.bleedMode==='wrap'?'Wrap':'Die-Cut'} bleed
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
      bleedMode: state.bleedMode,
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
      size: state.size.toFixed(2),
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
    ? "We've also emailed this code to you."
    : "We couldn't send the confirmation email automatically — please screenshot or write down your code now.";
  goStep('done');
}

/* ── DEVTOOLS DETECTION (deterrent-level only) ──
   Cannot reliably block a determined user — this only
   discourages casual screenshot/inspect attempts. */
function watchDevtools(){
  const threshold = 160;
  setInterval(()=>{
    const shield = document.getElementById('devtoolsShield');
    if (!shield) return;
    const open = (window.outerWidth - window.innerWidth > threshold) ||
                 (window.outerHeight - window.innerHeight > threshold);
    shield.classList.toggle('show', open && document.getElementById('step-design')?.classList.contains('active'));
  }, 800);
}

/* ── INIT ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', ()=>{
  renderProductGrid();
  watchDevtools();
});
