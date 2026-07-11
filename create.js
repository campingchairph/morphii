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

const STEP_ORDER = ['product','size','design','submit','done'];
const CANVAS_PX   = 480;   // fixed on-screen render resolution
const EXPORT_DPI  = 220;   // export resolution for the clean (admin-facing) design
const FONTS = ['Fredoka One','Nunito','Cute Jellyfish','Cute Stitch','Cute Roti','Cute Maple'];

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
  goStep('design');
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
  document.getElementById('bleedWrapBtn').classList.toggle('active', mode==='wrap');
  document.getElementById('bleedDiecutBtn').classList.toggle('active', mode==='diecut');
  updateBleedNote();
  drawPreview();
}
window.setBleedMode = setBleedMode;
function updateBleedNote(){
  const note = document.getElementById('bleedNote');
  if (state.bleedMode==='wrap'){
    note.textContent = `Wrap Mode: artwork extends past the blue safe line to the red cut line (${bleedPerSide().toFixed(3)}" bleed per side). That extra area wraps around the pin shell during assembly.`;
  } else {
    note.textContent = `Die-Cut Mode: artwork is cut to exact size along the red line (${bleedPerSide().toFixed(4)}" trim). Keep important content inside the blue safe line.`;
  }
}

/* ── CANVAS SETUP ─────────────────────────────── */
function setupCanvas(){
  const canvas = document.getElementById('designCanvas');
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  document.getElementById('previewLabel').textContent =
    `${state.product.label} · ${state.size.toFixed(2)}" Circle (${artboardDiameter().toFixed(2)}" with bleed)`;
  updateBleedNote();
  if (!canvas._boundEvents){
    bindCanvasInteractions(canvas);
    canvas._boundEvents = true;
  }
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

/* ── BOTTOM SHEETS ────────────────────────────── */
const SHEET_NAMES = ['bg','stickers','character','text','print'];
function openSheet(name){
  document.getElementById('sheetOverlay').classList.add('show');
  SHEET_NAMES.forEach(n=>{
    document.getElementById('sheet'+n[0].toUpperCase()+n.slice(1)).classList.toggle('show', n===name);
  });
  if (name==='bg'){ renderGradientGrid(); syncBgOpacitySlider(); syncBgLayerToggles(); }
  if (name==='stickers') renderStickerSheet();
  if (name==='character') renderCharacterSheet();
}
function syncBgOpacitySlider(){
  const el = document.getElementById('bgOpacitySlider');
  if (el) el.value = state.bg.opacity;
}
window.openSheet = openSheet;
function closeSheet(){
  document.getElementById('sheetOverlay').classList.remove('show');
}
window.closeSheet = closeSheet;

/* ── BACKGROUND: UPLOAD / LINK / GRADIENT ────── */
function setBgTab(which){
  ['upload','link','gradient'].forEach(w=>{
    document.getElementById('bgTab'+capitalize(w)).classList.toggle('active', w===which);
    document.getElementById('bg'+capitalize(w)+'Pane').style.display = w===which ? 'block' : 'none';
  });
}
window.setBgTab = setBgTab;
function capitalize(s){ return s[0].toUpperCase()+s.slice(1); }

function renderGradientGrid(){
  const grid = document.getElementById('gradientGrid');
  if (!grid.dataset.rendered){
    grid.dataset.rendered = '1';
    grid.innerHTML = GRADIENTS.map((g,i)=>{
      const css = g.grad4
        ? `conic-gradient(from 45deg, ${g.grad4[0]}, ${g.grad4[1]}, ${g.grad4[3]}, ${g.grad4[2]}, ${g.grad4[0]})`
        : `linear-gradient(135deg, ${g.grad[0]}, ${g.grad[1]})`;
      return `<button class="cr-gradient-swatch" data-i="${i}" style="background:${css}" title="${g.label}" onclick="selectGradient(${i})"></button>`;
    }).join('');
  }
  grid.querySelectorAll('.cr-gradient-swatch').forEach(el=>{
    el.classList.toggle('active', GRADIENTS[+el.dataset.i]===state.bg.color);
  });
}

function selectGradient(i){
  state.bg.color = GRADIENTS[i];
  state.bg.colorOn = true;
  renderGradientGrid();
  syncBgLayerToggles();
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

function syncBgLayerToggles(){
  const colorRow = document.getElementById('colorLayerRow');
  const imageRow = document.getElementById('imageLayerRow');
  if (colorRow) colorRow.style.display = state.bg.color ? 'flex' : 'none';
  const colorChk = document.getElementById('colorLayerChk');
  if (colorChk) colorChk.checked = state.bg.colorOn;
  if (imageRow) imageRow.style.display = state.bg.img ? 'flex' : 'none';
  const imageChk = document.getElementById('imageLayerChk');
  if (imageChk) imageChk.checked = state.bg.imageOn;
}

function onBgFileChosen(e){
  const file = e.target.files[0];
  if (!file) return;
  const labelEl = document.getElementById('bgUploadLabelText');
  if (labelEl) labelEl.textContent = file.name.length > 26 ? file.name.slice(0,23)+'…' : file.name;
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
  const warnEl = document.getElementById('bgWarning');
  warnEl.style.display = 'none';
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
  syncBgLayerToggles();
  drawPreview();
  updateSubmitAvailability();
}

function showBgWarning(msg){
  const warnEl = document.getElementById('bgWarning');
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

/* ── UPLOAD INSTRUCTIONS MODAL ────────────────── */
function promptUpload(kind){
  document.getElementById('uploadHintText').textContent =
    `Your ${kind} file should be a PNG with a transparent (no) background, so it blends cleanly into the design.`;
  document.getElementById('uploadHintInputId').value = kind==='sticker' ? 'stickerFileInput' : 'characterFileInput';
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

/* ── STICKERS (freely placed, drag anywhere on the pin) ── */
function renderStickerSheet(){
  const presetsEl = document.getElementById('stickerPresets');
  presetsEl.innerHTML = STICKER_PRESETS.length
    ? STICKER_PRESETS.map((s,i)=>`<button class="cr-preset-thumb" onclick="addStickerFromPreset(${i})"><img src="${s.src}" alt="${escHtml(s.label||'')}"></button>`).join('')
    : `<div class="cr-empty-hint">More stickers coming soon! Upload your own below in the meantime.</div>`;
  renderPlacedStickerList();
}

function addStickerFromPreset(i){
  const preset = STICKER_PRESETS[i];
  if (!preset) return;
  const img = new Image();
  img.onload = () => {
    state.stickers.push({ id: state.nextStickerId++, img, xFrac:0.15, yFrac:-0.15, scale:1, rotation:0 });
    renderPlacedStickerList();
    drawPreview();
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
      state.stickers.push({ id: state.nextStickerId++, img, xFrac:0.15, yFrac:-0.15, scale:1, rotation:0 });
      renderPlacedStickerList();
      drawPreview();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
window.onStickerFileChosen = onStickerFileChosen;

function removeSticker(id){
  state.stickers = state.stickers.filter(s=>s.id!==id);
  if (state.selected && state.selected.kind==='sticker' && state.selected.id===id) state.selected = null;
  renderPlacedStickerList();
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

function renderPlacedStickerList(){
  const el = document.getElementById('placedStickerList');
  if (!el) return;
  if (!state.stickers.length){
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `<div class="cr-hint" style="margin:12px 0 8px">Drag stickers directly on the pin to reposition.</div>` +
    state.stickers.map(s=>`
      <div class="cr-placed-row">
        <img class="cr-placed-thumb" src="${s.img.src}" alt="">
        <input type="range" min="0.4" max="2.5" step="0.1" value="${s.scale}" oninput="setStickerScale(${s.id},this.value)">
        <button class="cr-remove-btn" onclick="removeSticker(${s.id})">Remove</button>
      </div>`).join('');
}

/* ── CENTER CHARACTER (single, big, always centered) ── */
function renderCharacterSheet(){
  const presetsEl = document.getElementById('characterPresets');
  presetsEl.innerHTML = CHARACTER_PRESETS.length
    ? CHARACTER_PRESETS.map((c,i)=>`<button class="cr-preset-thumb" onclick="setCharacterFromPreset(${i})"><img src="${c.src}" alt="${escHtml(c.label||'')}"></button>`).join('')
    : `<div class="cr-empty-hint">More characters coming soon! Upload your own below in the meantime.</div>`;
  renderCharacterControls();
}

function setCharacterFromPreset(i){
  const preset = CHARACTER_PRESETS[i];
  if (!preset) return;
  const img = new Image();
  img.onload = () => { state.character = { img, scale:1, rotation:0, xFrac:0, yFrac:0 }; renderCharacterControls(); drawPreview(); };
  img.src = preset.src;
}
window.setCharacterFromPreset = setCharacterFromPreset;

function onCharacterFileChosen(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => { state.character = { img, scale:1, rotation:0, xFrac:0, yFrac:0 }; renderCharacterControls(); drawPreview(); };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
window.onCharacterFileChosen = onCharacterFileChosen;

function removeCharacter(){
  state.character = null;
  if (state.selected && state.selected.kind==='character') state.selected = null;
  renderCharacterControls();
  drawPreview();
}
window.removeCharacter = removeCharacter;

function setCharacterScale(val){
  if (!state.character) return;
  state.character.scale = +val;
  drawPreview();
}
window.setCharacterScale = setCharacterScale;

function renderCharacterControls(){
  const el = document.getElementById('characterControls');
  if (!el) return;
  if (!state.character){ el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="cr-placed-row">
      <img class="cr-placed-thumb" src="${state.character.img.src}" alt="">
      <input type="range" min="0.5" max="2" step="0.1" value="${state.character.scale}" oninput="setCharacterScale(this.value)">
      <button class="cr-remove-btn" onclick="removeCharacter()">Remove</button>
    </div>`;
}

/* ── TEXT LINES ───────────────────────────────── */
function addTextLine(){
  const line = { id: state.nextTextId++, text:'Your Text', font:FONTS[0], color:'#FFFFFF', placement:'straight', size:1, shadow:false };
  state.textLines.push(line);
  renderTextLines();
  drawPreview();
}
window.addTextLine = addTextLine;

function removeTextLine(id){
  state.textLines = state.textLines.filter(t=>t.id!==id);
  renderTextLines();
  drawPreview();
}
window.removeTextLine = removeTextLine;

function updateTextLine(id, field, value){
  const line = state.textLines.find(t=>t.id===id);
  if (!line) return;
  line[field] = value;
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

function renderTextLines(){
  const wrap = document.getElementById('textLinesWrap');
  if (!state.textLines.length){
    wrap.innerHTML = `<div class="cr-empty-hint">No text yet — add a line below.</div>`;
    return;
  }
  wrap.innerHTML = state.textLines.map(t=>`
    <div class="cr-text-line">
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
      <div class="cr-field-label" style="margin-top:2px">Size</div>
      <input type="range" class="cr-range" min="0.5" max="2.2" step="0.1" value="${t.size}" oninput="updateTextLine(${t.id},'size',+this.value)">
      <div class="cr-swatch-row">
        ${TEXT_COLORS.map(c=>`<button class="cr-swatch ${t.color===c?'active':''}" style="background:${c}" onclick="updateTextLine(${t.id},'color','${c}');renderTextLines()"></button>`).join('')}
      </div>
      <label class="cr-checkbox-row">
        <input type="checkbox" ${t.shadow?'checked':''} onchange="toggleTextShadow(${t.id},this.checked)">
        Drop shadow
      </label>
      <button class="cr-text-line-remove" onclick="removeTextLine(${t.id})">Remove line</button>
    </div>`).join('');
}

function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── CANVAS INTERACTIONS: drag bg, move/resize/rotate stickers+character ── */
function hitTestSticker(xFrac, yFrac){
  for (let i = state.stickers.length - 1; i >= 0; i--){
    const s = state.stickers[i];
    const r = STICKER_BASE_R * s.scale;
    if (dist2(xFrac,yFrac,s.xFrac,s.yFrac) <= r*r) return s;
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

    // 1. Handles of the currently selected element take priority
    if (state.selected){
      const isChar = state.selected.kind==='character';
      const el = isChar ? state.character : state.stickers.find(s=>s.id===state.selected.id);
      if (el){
        const hp = handlePositions(el, isChar);
        if (dist2(p.x,p.y,hp.resize.x,hp.resize.y) <= HANDLE_R*HANDLE_R){
          startElementDrag(canvas, e, 'resize', el); return;
        }
        if (dist2(p.x,p.y,hp.rotate.x,hp.rotate.y) <= HANDLE_R*HANDLE_R){
          startElementDrag(canvas, e, 'rotate', el); return;
        }
      }
    }

    // 2. Stickers (topmost first), then the center character
    const sticker = hitTestSticker(p.x, p.y);
    if (sticker){
      state.selected = { kind:'sticker', id: sticker.id };
      startElementDrag(canvas, e, 'move', sticker);
      drawPreview();
      return;
    }
    if (state.character && dist2(p.x,p.y,0,0) <= Math.pow(elementRadiusFrac(state.character,true),2)){
      state.selected = { kind:'character' };
      drawPreview();
      return; // character position is fixed — select only, no move-drag
    }

    // 3. Nothing hit — deselect, and fall back to dragging the background image
    const hadSelection = !!state.selected;
    state.selected = null;
    if (hadSelection) drawPreview();
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

  canvas.addEventListener('wheel', e=>{
    if (!state.bg.imageOn || !state.bg.img || state.selected) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    state.bg.scale = state.bg.scale*delta;
    clampBgTransform();
    drawPreview();
  }, { passive:false });

  // Basic pinch-to-zoom for touch (background only, when nothing selected)
  let pinchStartDist = null, pinchStartScale = 1;
  canvas.addEventListener('touchstart', e=>{
    if (e.touches.length===2){
      pinchStartDist = touchDist(e.touches);
      pinchStartScale = state.bg.scale;
    }
  }, { passive:true });
  canvas.addEventListener('touchmove', e=>{
    if (e.touches.length===2 && pinchStartDist && state.bg.imageOn && !state.selected){
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
    if (t.placement==='straight'){
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(t.text, artboardPx/2, artboardPx/2);
    } else {
      drawArcText(ctx, t.text, artboardPx/2, artboardPx/2, cutRadiusPx*0.78, t.placement==='bottom-arc');
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
  document.getElementById('toSubmitBtn').disabled = state.bg.imageOn && state.bg.tainted;
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

async function submitDesign(){
  const errEl = document.getElementById('submitError');
  errEl.style.display = 'none';
  const name = document.getElementById('custName').value.trim();
  const contact = document.getElementById('custContact').value.trim();
  const shopee = document.getElementById('custShopee').value.trim();
  const notes = document.getElementById('custNotes').value.trim();

  if (!name || !contact){
    errEl.textContent = 'Please fill in your name and contact info.';
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
    await submitOrder({
      product: state.product.id,
      productLabel: state.product.label,
      size: state.size,
      bleedMode: state.bleedMode,
      designDataUrl,
      customerName: name,
      customerContact: contact,
      shopeeOrderId: shopee,
      notes,
    });
    goStep('done');
  } catch(e){
    errEl.textContent = 'Something went wrong submitting your design: ' + e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = '✓ Submit My Design';
  }
}
window.submitDesign = submitDesign;

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
