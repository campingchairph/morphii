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
    type: 'none',           // 'none' | 'image' | 'gradient'
    img:null, tainted:false, opacity:1,
    offsetXFrac:0, offsetYFrac:0, scale:1,
    gradient: null,          // one of GRADIENTS
  },
  textLines: [],
  stickers: [],             // [{id, img, xFrac, yFrac, scale}]
  character: null,          // {img, scale} | null
  nextStickerId: 1,
  dragging:false, dragTarget:null, dragStartX:0, dragStartY:0, dragStartOffX:0, dragStartOffY:0,
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
  if (name==='bg'){ renderGradientGrid(); syncBgOpacitySlider(); }
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
  if (grid.dataset.rendered) return;
  grid.dataset.rendered = '1';
  grid.innerHTML = GRADIENTS.map((g,i)=>{
    const css = g.grad4
      ? `conic-gradient(from 45deg, ${g.grad4[0]}, ${g.grad4[1]}, ${g.grad4[3]}, ${g.grad4[2]}, ${g.grad4[0]})`
      : `linear-gradient(135deg, ${g.grad[0]}, ${g.grad[1]})`;
    return `<button class="cr-gradient-swatch" style="background:${css}" title="${g.label}" onclick="selectGradient(${i})"></button>`;
  }).join('');
}

function selectGradient(i){
  state.bg.type = 'gradient';
  state.bg.gradient = GRADIENTS[i];
  state.bg.tainted = false;
  drawPreview();
  updateSubmitAvailability();
}
window.selectGradient = selectGradient;

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
  state.bg.type = 'image';
  state.bg.img = img;
  state.bg.tainted = tainted;
  state.bg.offsetXFrac = 0; state.bg.offsetYFrac = 0; state.bg.scale = 1;
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

// Keeps the background image always fully covering the circular pin area —
// clamps pan offset (in artboard-fraction units) and forbids zooming below
// the "just covers" scale of 1, so dragging/zooming can never leave a gap.
function clampBgTransform(){
  const img = state.bg.img;
  if (!img) return;
  state.bg.scale = Math.max(1, Math.min(4, state.bg.scale));
  const unit = 1 / Math.min(img.naturalWidth, img.naturalHeight);
  const w = img.naturalWidth * unit * state.bg.scale;
  const h = img.naturalHeight * unit * state.bg.scale;
  const maxX = Math.max(0, (w - 1) / 2);
  const maxY = Math.max(0, (h - 1) / 2);
  state.bg.offsetXFrac = Math.max(-maxX, Math.min(maxX, state.bg.offsetXFrac));
  state.bg.offsetYFrac = Math.max(-maxY, Math.min(maxY, state.bg.offsetYFrac));
}

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
    state.stickers.push({ id: state.nextStickerId++, img, xFrac:0, yFrac:0, scale:1 });
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
      state.stickers.push({ id: state.nextStickerId++, img, xFrac:0, yFrac:0, scale:1 });
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
  img.onload = () => { state.character = { img, scale:1 }; renderCharacterControls(); drawPreview(); };
  img.src = preset.src;
}
window.setCharacterFromPreset = setCharacterFromPreset;

function onCharacterFileChosen(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => { state.character = { img, scale:1 }; renderCharacterControls(); drawPreview(); };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
window.onCharacterFileChosen = onCharacterFileChosen;

function removeCharacter(){
  state.character = null;
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
  const line = { id: state.nextTextId++, text:'Your Text', font:'Fredoka One', color:'#FFFFFF', placement:'straight', size:1 };
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

const TEXT_COLORS = ['#1E2A20','#FFFFFF','#FF6F91','#8FAE7C','#F2B441','#4D8FE0','#B25CE0','#E05C5C'];

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
      <div class="cr-swatch-row">
        ${TEXT_COLORS.map(c=>`<button class="cr-swatch ${t.color===c?'active':''}" style="background:${c}" onclick="updateTextLine(${t.id},'color','${c}');renderTextLines()"></button>`).join('')}
      </div>
      <button class="cr-text-line-remove" onclick="removeTextLine(${t.id})">Remove line</button>
    </div>`).join('');
}

function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── CANVAS DRAG / ZOOM ──────────────────────── */
// Finds the topmost sticker under a point (in canvas-fraction coords, -0.5..0.5 from center).
function hitTestSticker(xFrac, yFrac){
  for (let i = state.stickers.length - 1; i >= 0; i--){
    const s = state.stickers[i];
    const r = 0.14 * s.scale; // approximate placed-sticker radius, in artboard fractions
    const dx = xFrac - s.xFrac, dy = yFrac - s.yFrac;
    if (dx*dx + dy*dy <= r*r) return s;
  }
  return null;
}

function bindCanvasInteractions(canvas){
  canvas.addEventListener('contextmenu', e=>e.preventDefault());
  canvas.addEventListener('dragstart', e=>e.preventDefault());

  canvas.addEventListener('pointerdown', e=>{
    const rect = canvas.getBoundingClientRect();
    const xFrac = (e.clientX - rect.left) / rect.width - 0.5;
    const yFrac = (e.clientY - rect.top) / rect.height - 0.5;
    const sticker = hitTestSticker(xFrac, yFrac);
    if (sticker){
      state.dragTarget = sticker;
    } else if (state.bg.type==='image' && state.bg.img){
      state.dragTarget = 'bg';
    } else {
      return;
    }
    state.dragging = true;
    state.dragStartX = e.clientX; state.dragStartY = e.clientY;
    if (state.dragTarget==='bg'){
      state.dragStartOffX = state.bg.offsetXFrac; state.dragStartOffY = state.bg.offsetYFrac;
    } else {
      state.dragStartOffX = state.dragTarget.xFrac; state.dragStartOffY = state.dragTarget.yFrac;
    }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e=>{
    if (!state.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const dxFrac = (e.clientX - state.dragStartX) / rect.width;
    const dyFrac = (e.clientY - state.dragStartY) / rect.height;
    if (state.dragTarget==='bg'){
      state.bg.offsetXFrac = state.dragStartOffX + dxFrac;
      state.bg.offsetYFrac = state.dragStartOffY + dyFrac;
      clampBgTransform();
    } else if (state.dragTarget){
      state.dragTarget.xFrac = state.dragStartOffX + dxFrac;
      state.dragTarget.yFrac = state.dragStartOffY + dyFrac;
    }
    drawPreview();
  });
  canvas.addEventListener('pointerup', ()=>{ state.dragging=false; state.dragTarget=null; });
  canvas.addEventListener('pointercancel', ()=>{ state.dragging=false; state.dragTarget=null; });

  canvas.addEventListener('wheel', e=>{
    if (state.bg.type!=='image' || !state.bg.img) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    state.bg.scale = state.bg.scale*delta;
    clampBgTransform();
    drawPreview();
  }, { passive:false });

  // Basic pinch-to-zoom for touch (background only)
  let pinchStartDist = null, pinchStartScale = 1;
  canvas.addEventListener('touchstart', e=>{
    if (e.touches.length===2){
      pinchStartDist = touchDist(e.touches);
      pinchStartScale = state.bg.scale;
    }
  }, { passive:true });
  canvas.addEventListener('touchmove', e=>{
    if (e.touches.length===2 && pinchStartDist && state.bg.type==='image'){
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
  drawStickers(ctx, artboardPx);
  drawCharacter(ctx, artboardPx);
  drawTextLines(ctx, artboardPx);

  ctx.restore();
}

function drawBackground(ctx, artboardPx){
  ctx.save();
  ctx.globalAlpha = state.bg.opacity;
  if (state.bg.type==='image' && state.bg.img){
    const img = state.bg.img;
    const baseScale = artboardPx / Math.min(img.naturalWidth, img.naturalHeight);
    const drawScale = baseScale * state.bg.scale;
    const w = img.naturalWidth * drawScale, h = img.naturalHeight * drawScale;
    const cx = artboardPx/2 + state.bg.offsetXFrac*artboardPx;
    const cy = artboardPx/2 + state.bg.offsetYFrac*artboardPx;
    ctx.drawImage(img, cx-w/2, cy-h/2, w, h);
  } else if (state.bg.type==='gradient' && state.bg.gradient){
    // Same diagonal-gradient algorithm as the kiosk avatar builder (morphii.js)
    const g = state.bg.gradient;
    const grad = ctx.createLinearGradient(0,0,artboardPx,artboardPx);
    if (g.grad4){
      const [tl,tr,bl,br] = g.grad4;
      grad.addColorStop(0,tl); grad.addColorStop(0.33,tr); grad.addColorStop(0.66,br); grad.addColorStop(1,bl);
    } else {
      grad.addColorStop(0,g.grad[0]); grad.addColorStop(1,g.grad[1]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,artboardPx,artboardPx);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,artboardPx,artboardPx);
  }
  ctx.restore();
}

function drawStickers(ctx, artboardPx){
  state.stickers.forEach(s=>{
    if (!s.img) return;
    const d = artboardPx * 0.28 * s.scale; // placed-sticker footprint
    const cx = artboardPx/2 + s.xFrac*artboardPx;
    const cy = artboardPx/2 + s.yFrac*artboardPx;
    const ar = s.img.naturalWidth / s.img.naturalHeight;
    const w = ar >= 1 ? d : d*ar, h = ar >= 1 ? d/ar : d;
    ctx.drawImage(s.img, cx-w/2, cy-h/2, w, h);
  });
}

function drawCharacter(ctx, artboardPx){
  if (!state.character || !state.character.img) return;
  const img = state.character.img;
  const d = artboardPx * 0.55 * state.character.scale; // big, centered
  const ar = img.naturalWidth / img.naturalHeight;
  const w = ar >= 1 ? d : d*ar, h = ar >= 1 ? d/ar : d;
  ctx.drawImage(img, artboardPx/2 - w/2, artboardPx/2 - h/2, w, h);
}

function drawTextLines(ctx, artboardPx){
  const scalePxPerInch = artboardPx / artboardDiameter();
  const cutRadiusPx = (state.size/2) * scalePxPerInch;
  state.textLines.forEach(t=>{
    ctx.font = `bold ${28*t.size}px "${t.font}", 'Nunito', sans-serif`;
    ctx.fillStyle = t.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    if (t.placement==='straight'){
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.strokeText(t.text, artboardPx/2, artboardPx/2);
      ctx.fillText(t.text, artboardPx/2, artboardPx/2);
    } else {
      drawArcText(ctx, t.text, artboardPx/2, artboardPx/2, cutRadiusPx*0.78, t.placement==='bottom-arc');
    }
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
  ctx.save();
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
    ctx.strokeText(ch,0,0);
    ctx.fillText(ch,0,0);
    ctx.restore();
    a += half;
  });
  ctx.restore();
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
  document.getElementById('toSubmitBtn').disabled = state.bg.tainted;
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
  if (state.bg.type==='none'){
    errEl.textContent = 'Please add a background before submitting.';
    errEl.style.display = 'block';
    return;
  }
  if (state.bg.tainted){
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
