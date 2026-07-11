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

const state = {
  product: null,
  size: null,
  bleedMode: 'wrap',
  bg: { img:null, tainted:false, offsetXFrac:0, offsetYFrac:0, scale:1 },
  textLines: [],
  dragging:false, dragStartX:0, dragStartY:0, dragStartOffX:0, dragStartOffY:0,
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
}

/* ── BACKGROUND: UPLOAD / LINK ───────────────── */
function setBgTab(which){
  document.getElementById('bgTabUpload').classList.toggle('active', which==='upload');
  document.getElementById('bgTabLink').classList.toggle('active', which==='link');
  document.getElementById('bgUploadPane').style.display = which==='upload' ? 'block' : 'none';
  document.getElementById('bgLinkPane').style.display   = which==='link'   ? 'block' : 'none';
}
window.setBgTab = setBgTab;

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
  const warnEl = document.getElementById('bgWarning');
  warnEl.style.display = 'none';
  const img = new Image();
  if (isExternal) img.crossOrigin = 'anonymous';
  img.onload = () => {
    state.bg.img = img;
    state.bg.tainted = false;
    state.bg.offsetXFrac = 0; state.bg.offsetYFrac = 0; state.bg.scale = 1;
    if (isExternal){
      // Probe for a tainted canvas (cross-origin image without CORS headers)
      try {
        const probe = document.createElement('canvas');
        probe.width = 1; probe.height = 1;
        probe.getContext('2d').drawImage(img,0,0,1,1);
        probe.getContext('2d').getImageData(0,0,1,1);
      } catch(err){
        state.bg.tainted = true;
        warnEl.style.display = 'block';
        warnEl.textContent = "This image link can't be used for printing (the host doesn't allow cross-site access). Please upload the file instead.";
      }
    }
    drawPreview();
    updateSubmitAvailability();
  };
  img.onerror = () => {
    warnEl.style.display = 'block';
    warnEl.textContent = 'Could not load that image link. Check the URL or upload the file instead.';
  };
  img.src = src;
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

function renderTextLines(){
  const wrap = document.getElementById('textLinesWrap');
  wrap.innerHTML = state.textLines.map(t=>`
    <div class="cr-text-line">
      <input type="text" class="cr-text-input" style="margin-bottom:6px" value="${escHtml(t.text)}" maxlength="24"
        oninput="updateTextLine(${t.id},'text',this.value)">
      <div class="cr-text-line-row">
        <select onchange="updateTextLine(${t.id},'placement',this.value)">
          <option value="straight" ${t.placement==='straight'?'selected':''}>Straight</option>
          <option value="top-arc" ${t.placement==='top-arc'?'selected':''}>Top Arc</option>
          <option value="bottom-arc" ${t.placement==='bottom-arc'?'selected':''}>Bottom Arc</option>
        </select>
        <select onchange="updateTextLine(${t.id},'font',this.value)">
          ${FONTS.map(f=>`<option value="${f}" ${t.font===f?'selected':''}>${f}</option>`).join('')}
        </select>
        <input type="color" value="${t.color}" onchange="updateTextLine(${t.id},'color',this.value)">
      </div>
      <button class="cr-text-line-remove" onclick="removeTextLine(${t.id})">✕ Remove</button>
    </div>`).join('');
}

function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── CANVAS DRAG / ZOOM ──────────────────────── */
function bindCanvasInteractions(canvas){
  canvas.addEventListener('contextmenu', e=>e.preventDefault());
  canvas.addEventListener('dragstart', e=>e.preventDefault());

  canvas.addEventListener('pointerdown', e=>{
    if (!state.bg.img) return;
    state.dragging = true;
    state.dragStartX = e.clientX; state.dragStartY = e.clientY;
    state.dragStartOffX = state.bg.offsetXFrac; state.dragStartOffY = state.bg.offsetYFrac;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e=>{
    if (!state.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const dxFrac = (e.clientX - state.dragStartX) / rect.width;
    const dyFrac = (e.clientY - state.dragStartY) / rect.height;
    state.bg.offsetXFrac = state.dragStartOffX + dxFrac;
    state.bg.offsetYFrac = state.dragStartOffY + dyFrac;
    drawPreview();
  });
  canvas.addEventListener('pointerup', e=>{ state.dragging=false; });
  canvas.addEventListener('pointercancel', ()=>{ state.dragging=false; });

  canvas.addEventListener('wheel', e=>{
    if (!state.bg.img) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    state.bg.scale = Math.min(4, Math.max(0.3, state.bg.scale*delta));
    drawPreview();
  }, { passive:false });

  // Basic pinch-to-zoom for touch
  let pinchStartDist = null, pinchStartScale = 1;
  canvas.addEventListener('touchstart', e=>{
    if (e.touches.length===2){
      pinchStartDist = touchDist(e.touches);
      pinchStartScale = state.bg.scale;
    }
  }, { passive:true });
  canvas.addEventListener('touchmove', e=>{
    if (e.touches.length===2 && pinchStartDist){
      e.preventDefault();
      const d = touchDist(e.touches);
      state.bg.scale = Math.min(4, Math.max(0.3, pinchStartScale * (d/pinchStartDist)));
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
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,sizePx,sizePx);

  if (state.bg.img){
    const img = state.bg.img;
    const baseScale = artboardPx / Math.min(img.naturalWidth, img.naturalHeight);
    const drawScale = baseScale * state.bg.scale;
    const w = img.naturalWidth * drawScale, h = img.naturalHeight * drawScale;
    const cx = artboardPx/2 + state.bg.offsetXFrac*artboardPx;
    const cy = artboardPx/2 + state.bg.offsetYFrac*artboardPx;
    ctx.drawImage(img, cx-w/2, cy-h/2, w, h);
  }

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
  const chars = bottom ? text.split('').reverse() : text.split('');
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
  if (!state.bg.img){
    errEl.textContent = 'Please add a background image before submitting.';
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
