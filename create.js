/* ═══════════════════════════════════════════════
   MORPHII CREATE — Online Custom Pin Designer
   ═══════════════════════════════════════════════ */

// `tools` restricts which dock add-row icons a product offers (kind ids:
// background/border/character/sticker/shape/wordart/text) — omit it (as on
// every product below except the three new ones) for the full unrestricted
// set every product had before this existed.
// catalogState is one of 'enabled' (available), 'disabled' (visible, greyed
// out, "Coming Soon" badge — for stuff not built yet), or 'hidden' (not
// rendered in the grid at all). The admin's catalog toggles in
// orders-admin.html override this per id at runtime — see
// applyCatalogOverrides() below; these are just the hardcoded defaults.
const PRODUCTS = [
  { id:'lapel-pin',    label:'Lapel Pins',              icon:'📌', catalogState:'enabled' },
  { id:'challenge-coin', label:'Challenge Coins',        icon:'🪙', catalogState:'enabled' },
  { id:'medal',        label:'Medals',                  icon:'🏅', catalogState:'enabled' },
  { id:'golf-marker',  label:'Golf Ball Markers',        icon:'⛳', catalogState:'enabled' },
  // `assetGroup` isolates a product's sticker/border/background/character/
  // shape/word-art presets into their own assets/pins/<assetGroup>/<category>/
  // folders instead of the shared pool everything else pulls from — see
  // applyAssetGroup() below. Products without it (every one above) keep
  // pulling from the shared folders exactly as before this existed.
  { id:'election',     label:'Election Pins',           icon:'🗳️', catalogState:'enabled',
    tools:['background','border','character','sticker','text','shape'], assetGroup:'election' },
  { id:'ph-souvenir',  label:'Philippine Souvenir Pins', icon:'🇵🇭', catalogState:'enabled',
    tools:['background','border','character','sticker','text'], assetGroup:'ph-souvenir' },
  { id:'wedding',      label:'Wedding Pins',            icon:'💍', catalogState:'enabled', assetGroup:'wedding' },
  { id:'patch',        label:'Patches',                 icon:'🧵', catalogState:'disabled' },
  { id:'keychain',     label:'Keychains',                icon:'🔑', catalogState:'disabled' },
  { id:'ai-marker',    label:'AI Ball Marker Generator', icon:'🤖', catalogState:'disabled' },
  { id:'lanyard',      label:'Lanyards & ID Badges',     icon:'🪪', catalogState:'disabled' },
  { id:'belt-buckle',  label:'Belt Buckles',             icon:'🎗️', catalogState:'disabled' },
  { id:'luggage-tag',  label:'Luggage Tags',             icon:'🏷️', catalogState:'disabled' },
];

/* ── ELECTION PIN TEMPLATES — premade designs the customer fills a short
   form for, generated onto the normal editable canvas (see
   applyElectionTemplate() near the design-generation code). Each `elements`
   entry is applied in listed order (back to front). `field` pulls straight
   from the form; `composite` is a "${field}" template string combining more
   than one; `text` is a fixed literal. Position/scale are approximate —
   the customer can drag, resize, recolor, or delete anything afterward,
   same as a from-scratch design. `photo` elements always render dead-center
   (the Character slot's xFrac/yFrac are stored but drawOneCharacter() never
   reads them — a pre-existing constraint, not new here) — their xFrac/yFrac
   below are kept only as position notes for a future off-center photo slot,
   `scale` is the only field that actually takes effect. ── */
const PH_BLUE = '#0038A8', PH_RED = '#CE1126', PH_GOLD = '#FCD116', PH_WHITE = '#FFFFFF';
const ELECTION_TEMPLATES = [
  { id:'sash-classic', label:'Sash Classic',
    description:'Blue pin with a diagonal sash carrying your name.',
    fields:['photo','name','position','slogan'],
    background:{color:PH_BLUE},
    elements:[
      {type:'shape', shapeId:'band', color:PH_GOLD, xFrac:-0.22, yFrac:-0.32, scale:0.55, rotation:25},
      {type:'shape', shapeId:'band', color:PH_GOLD, xFrac:0.22, yFrac:-0.18, scale:0.5, rotation:25},
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:-0.3, yFrac:-0.08, scale:0.16},
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:0.32, yFrac:0.02, scale:0.14},
      {type:'photo', xFrac:0, yFrac:-0.24, scale:1.1},
      {type:'shape', shapeId:'band', color:PH_RED, xFrac:0, yFrac:0.1, scale:1.7, rotation:-12},
      {type:'text', field:'position', xFrac:0, yFrac:0.03, color:PH_GOLD, size:0.045, rotation:-12},
      {type:'text', field:'name', xFrac:0, yFrac:0.12, color:PH_WHITE, size:0.075, rotation:-12},
      {type:'text', field:'slogan', xFrac:0, yFrac:0.42, color:PH_WHITE, size:0.035, placement:'bottom-arc'},
    ] },
  { id:'sunburst', label:'Sunburst',
    description:'Gold sunburst with a blue center medallion.',
    fields:['photo','name','position','voteNumber'],
    background:{color:PH_GOLD},
    elements:[
      {type:'shape', shapeId:'circle', color:PH_RED, xFrac:0, yFrac:0, scale:1.9},
      {type:'shape', shapeId:'circle', color:PH_BLUE, xFrac:0, yFrac:0, scale:1.35},
      {type:'photo', xFrac:0, yFrac:-0.14, scale:0.62},
      {type:'text', field:'name', xFrac:0, yFrac:0.14, color:PH_WHITE, size:0.06},
      {type:'text', composite:'${position} · #${voteNumber}', xFrac:0, yFrac:0.22, color:PH_GOLD, size:0.035},
    ] },
  { id:'big-ballot-number', label:'Big Ballot Number',
    description:'Your vote number front and center.',
    fields:['voteNumber','name','slogan'],
    background:{color:PH_RED},
    elements:[
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:0.32, yFrac:-0.32, scale:0.16},
      {type:'text', text:'OFFICIAL CANDIDATE', xFrac:0.14, yFrac:-0.4, color:PH_GOLD, size:0.026},
      {type:'text', field:'slogan', xFrac:0, yFrac:-0.18, color:PH_WHITE, size:0.04},
      {type:'text', field:'voteNumber', prefix:'#', xFrac:0, yFrac:0.02, color:PH_WHITE, size:0.22},
      {type:'shape', shapeId:'band', color:PH_GOLD, xFrac:0, yFrac:0.22, scale:0.7},
      {type:'text', field:'name', xFrac:0, yFrac:0.32, color:PH_WHITE, size:0.06},
    ] },
  { id:'ph-flag', label:'Philippine Flag',
    description:'Accurate flag colors and layout.',
    fields:['photo','name','position'],
    background:{color:PH_BLUE},
    elements:[
      {type:'shape', shapeId:'band', color:PH_RED, xFrac:0, yFrac:0.28, scale:2.3},
      {type:'shape', shapeId:'triangle', color:PH_WHITE, xFrac:-0.28, yFrac:0, scale:1.5, rotation:90},
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:-0.34, yFrac:-0.13, scale:0.08},
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:-0.34, yFrac:0.13, scale:0.08},
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:-0.44, yFrac:0, scale:0.08},
      {type:'shape', shapeId:'circle', color:PH_GOLD, xFrac:-0.28, yFrac:0, scale:0.12},
      {type:'photo', xFrac:0.22, yFrac:-0.05, scale:0.7},
      {type:'shape', shapeId:'pill', color:PH_GOLD, xFrac:0.22, yFrac:0.28, scale:0.75},
      {type:'text', field:'name', xFrac:0.22, yFrac:0.28, color:PH_BLUE, size:0.04},
      {type:'text', field:'position', xFrac:0.22, yFrac:0.38, color:PH_WHITE, size:0.03},
    ] },
  { id:'star-ring', label:'Star Ring',
    description:'A ring of stars with your number watermarked behind.',
    fields:['voteNumber','photo','name','position'],
    background:{color:PH_WHITE},
    elements:[
      {type:'shape', shapeId:'circle', color:PH_BLUE, xFrac:0, yFrac:0, scale:2.0},
      {type:'shape', shapeId:'circle', color:PH_WHITE, xFrac:0, yFrac:0, scale:1.86},
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:0, yFrac:-0.38, scale:0.13},
      {type:'shape', shapeId:'star', color:PH_RED, xFrac:0.27, yFrac:-0.27, scale:0.1},
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:0.38, yFrac:0, scale:0.13},
      {type:'shape', shapeId:'star', color:PH_RED, xFrac:0.27, yFrac:0.27, scale:0.1},
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:0, yFrac:0.38, scale:0.13},
      {type:'shape', shapeId:'star', color:PH_RED, xFrac:-0.27, yFrac:0.27, scale:0.1},
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:-0.38, yFrac:0, scale:0.13},
      {type:'shape', shapeId:'star', color:PH_RED, xFrac:-0.27, yFrac:-0.27, scale:0.1},
      {type:'text', field:'voteNumber', prefix:'#', xFrac:0, yFrac:0, color:'#EDEDED', size:0.24},
      {type:'photo', xFrac:0, yFrac:-0.08, scale:0.55},
      {type:'text', field:'name', xFrac:0, yFrac:0.18, color:PH_BLUE, size:0.05},
      {type:'text', field:'position', xFrac:0, yFrac:0.25, color:PH_RED, size:0.032},
    ] },
  { id:'bold-portrait', label:'Bold Portrait',
    description:'One large photo with a bold position pill.',
    fields:['photo','name','position','slogan'],
    background:{color:PH_BLUE},
    elements:[
      {type:'shape', shapeId:'band', color:PH_GOLD, xFrac:0.1, yFrac:-0.42, scale:0.4, rotation:8},
      {type:'shape', shapeId:'band', color:PH_GOLD, xFrac:-0.15, yFrac:-0.38, scale:0.35, rotation:8},
      {type:'shape', shapeId:'band', color:PH_RED, xFrac:0, yFrac:-0.35, scale:1.9, rotation:-6},
      {type:'text', field:'slogan', xFrac:0, yFrac:-0.32, color:PH_WHITE, size:0.03},
      {type:'photo', xFrac:0, yFrac:-0.02, scale:1.1},
      {type:'text', field:'name', xFrac:0, yFrac:0.28, color:PH_WHITE, size:0.065},
      {type:'shape', shapeId:'pill', color:PH_GOLD, xFrac:0, yFrac:0.37, scale:0.95},
      {type:'text', field:'position', xFrac:0, yFrac:0.37, color:PH_BLUE, size:0.032},
    ] },
  { id:'slogan-focus', label:'Slogan Focus',
    description:'Your campaign slogan as the headline.',
    fields:['slogan','name','photo','position'],
    background:{color:PH_GOLD},
    elements:[
      {type:'shape', shapeId:'band', color:PH_RED, xFrac:-0.25, yFrac:-0.3, scale:0.4, rotation:20},
      {type:'shape', shapeId:'band', color:PH_RED, xFrac:0.25, yFrac:-0.15, scale:0.35, rotation:20},
      {type:'shape', shapeId:'star', color:PH_WHITE, xFrac:0.3, yFrac:0.3, scale:0.1},
      {type:'shape', shapeId:'star', color:PH_WHITE, xFrac:-0.3, yFrac:0.32, scale:0.09},
      {type:'text', field:'slogan', xFrac:0, yFrac:-0.34, color:PH_RED, size:0.05},
      {type:'shape', shapeId:'pill', color:PH_WHITE, xFrac:0, yFrac:-0.02, scale:0.9},
      {type:'text', field:'name', xFrac:0, yFrac:-0.02, color:PH_RED, size:0.05},
      {type:'photo', xFrac:0, yFrac:0.2, scale:0.55},
      {type:'text', field:'position', xFrac:0, yFrac:0.4, color:PH_BLUE, size:0.032},
      {type:'shape', shapeId:'triangle', color:PH_BLUE, xFrac:-0.28, yFrac:0.42, scale:0.14},
      {type:'shape', shapeId:'triangle', color:PH_RED, xFrac:0, yFrac:0.44, scale:0.14},
      {type:'shape', shapeId:'triangle', color:PH_BLUE, xFrac:0.28, yFrac:0.42, scale:0.14},
    ] },
  { id:'flag-stripe', label:'Flag Stripe',
    description:'Photo on top, name and number in flag-colored stripes.',
    fields:['photo','position','name','voteNumber'],
    background:{color:PH_WHITE},
    elements:[
      {type:'photo', xFrac:0.04, yFrac:-0.2, scale:1.1},
      {type:'shape', shapeId:'band', color:PH_RED, xFrac:0.04, yFrac:0.16, scale:1.55, rotation:-8},
      {type:'text', field:'position', xFrac:0.04, yFrac:0.13, color:PH_WHITE, size:0.032, rotation:-8},
      {type:'shape', shapeId:'band', color:PH_BLUE, xFrac:0.04, yFrac:0.3, scale:1.55, rotation:-8},
      {type:'text', field:'name', xFrac:0.04, yFrac:0.3, color:PH_WHITE, size:0.045, rotation:-8},
      {type:'text', field:'voteNumber', prefix:'#', xFrac:-0.4, yFrac:0, color:PH_RED, size:0.06, rotation:90},
    ] },
  { id:'photo-seal', label:'Photo Seal',
    description:'A formal seal with your number watermarked behind.',
    fields:['voteNumber','photo','name','position','year'],
    background:{color:PH_WHITE},
    elements:[
      {type:'shape', shapeId:'circle', color:PH_BLUE, xFrac:0, yFrac:0, scale:2.0},
      {type:'shape', shapeId:'circle', color:PH_WHITE, xFrac:0, yFrac:0, scale:1.9},
      {type:'shape', shapeId:'circle', color:PH_BLUE, xFrac:0, yFrac:0, scale:1.82},
      {type:'shape', shapeId:'circle', color:PH_WHITE, xFrac:0, yFrac:0, scale:1.76},
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:-0.36, yFrac:-0.36, scale:0.1},
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:0.36, yFrac:-0.36, scale:0.1},
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:-0.36, yFrac:0.36, scale:0.1},
      {type:'shape', shapeId:'star', color:PH_GOLD, xFrac:0.36, yFrac:0.36, scale:0.1},
      {type:'text', field:'voteNumber', prefix:'#', xFrac:0, yFrac:0, color:'#EAEAEA', size:0.24},
      {type:'photo', xFrac:0, yFrac:-0.1, scale:0.55},
      {type:'text', field:'name', xFrac:0, yFrac:0.18, color:PH_BLUE, size:0.05},
      {type:'text', composite:'${position} · ${year}', xFrac:0, yFrac:0.26, color:PH_RED, size:0.032},
    ] },
];
const ELECTION_FIELD_META = {
  photo:      { label:'Photo',       type:'photo' },
  name:       { label:'Name',        type:'text', placeholder:'Juan Dela Cruz' },
  position:   { label:'Position',    type:'text', placeholder:'FOR MAYOR' },
  voteNumber: { label:'Vote Number', type:'text', placeholder:'15' },
  slogan:     { label:'Slogan',      type:'text', placeholder:'Serbisyong Tapat' },
  year:       { label:'Year',        type:'text', placeholder:'2028' },
};

/* ── ELECTION TEMPLATE PICKER + FILL-IN FORM ─────
   Picker card grid -> short form for just that template's fields -> one
   generator builds the real, fully-editable elements onto the normal
   design canvas and drops the customer straight into Design. Nothing here
   is a special "locked" mode — after generating it's just an ordinary
   in-progress pin, same as building one from scratch. ── */
let _activeTemplateId = null;
let _templateFormPhotoDataUrl = null;

function renderTemplateGrid(){
  const grid = document.getElementById('templateGrid');
  if (!grid) return;
  grid.innerHTML = ELECTION_TEMPLATES.map(t => `
    <div class="cr-product-card" onclick="openTemplateForm('${t.id}')">
      <div class="cr-product-icon">🗳️</div>
      <div class="cr-product-name">${t.label}</div>
      <div class="cr-template-desc">${escHtml(t.description)}</div>
    </div>`).join('');
}
window.renderTemplateGrid = renderTemplateGrid;

function startElectionFromScratch(){
  resetDesignForTemplate();
  goStep('design');
}
window.startElectionFromScratch = startElectionFromScratch;

function openTemplateForm(templateId){
  const t = ELECTION_TEMPLATES.find(x=>x.id===templateId);
  if (!t) return;
  _activeTemplateId = templateId;
  _templateFormPhotoDataUrl = null;
  document.getElementById('templateFormTitle').textContent = t.label;
  const body = document.getElementById('templateFormBody');
  body.innerHTML = t.fields.map(f=>{
    const meta = ELECTION_FIELD_META[f];
    if (meta.type==='photo'){
      return `
        <div class="cr-field-label">${meta.label}</div>
        <button type="button" class="cr-upload-btn" onclick="document.getElementById('templatePhotoInput').click()">
          ${ICON_UPLOAD}<span id="templatePhotoLabelText">Choose a Photo</span>
        </button>
        <input type="file" id="templatePhotoInput" accept="image/*" class="cr-visually-hidden" onchange="onTemplatePhotoChosen(event)">`;
    }
    return `
      <div class="cr-field-label">${meta.label}</div>
      <input type="text" class="cr-text-input" id="templateField_${f}" placeholder="${escHtml(meta.placeholder||'')}">`;
  }).join('');
  document.getElementById('templateFormOverlay').classList.add('show');
}
window.openTemplateForm = openTemplateForm;

function closeTemplateForm(){
  document.getElementById('templateFormOverlay').classList.remove('show');
}
window.closeTemplateForm = closeTemplateForm;

function onTemplatePhotoChosen(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    _templateFormPhotoDataUrl = ev.target.result;
    const label = document.getElementById('templatePhotoLabelText');
    if (label) label.textContent = file.name;
  };
  reader.readAsDataURL(file);
}
window.onTemplatePhotoChosen = onTemplatePhotoChosen;

async function generateFromTemplateForm(){
  const t = ELECTION_TEMPLATES.find(x=>x.id===_activeTemplateId);
  if (!t) return;
  const values = {};
  t.fields.forEach(f=>{
    if (f==='photo') return;
    const el = document.getElementById('templateField_'+f);
    values[f] = el ? el.value.trim() : '';
  });
  closeTemplateForm();
  await applyElectionTemplate(t, values, _templateFormPhotoDataUrl);
}
window.generateFromTemplateForm = generateFromTemplateForm;

// Clears every design element — used both by "Start from Scratch" and right
// before a template generates, so re-generating (or backing out and trying
// a different template) never mixes leftovers from a previous attempt.
function resetDesignForTemplate(){
  state.bg = { colorOn:false, color:null, imageOn:false, img:null, tainted:false, opacity:0.7, offsetXFrac:0, offsetYFrac:0, scale:1, locked:false };
  state.textLines = [];
  state.stickers = [];
  state.shapes = [];
  state.wordArts = [];
  state.letters = [];
  state.character = null;
  state.border = null;
  state.layerOrder = [];
  state.selected = null;
  state.nextStickerId = 1; state.nextShapeId = 1; state.nextWordArtId = 1; state.nextLetterId = 1; state.nextTextId = 1;
}

/* ── ADMIN PIN TEMPLATES (save the current design / load a saved one) ──
   A template is just a JSON snapshot of the design portion of `state`,
   stored in Firestore — see savePinTemplate/getPinTemplates in
   firebase-config.js. Image objects aren't serializable, so every img gets
   reduced to its .src URL going in, and rebuilt with `new Image()` coming
   back out. Ids are NOT preserved across the round-trip (they're reassigned
   via nextPlacedId/nextTextId on load, same as duplicatePlaced) — the
   snapshot keeps its own internal ids only so layerOrder can be rebuilt in
   the original front-to-back order via an old-id -> new-id map. ── */
function serializePlacedArray(kind){
  return placedArray(kind).map(el => {
    const out = { id: el.id, xFrac: el.xFrac, yFrac: el.yFrac, scale: el.scale, rotation: el.rotation||0, src: el.img.src };
    if (el.vectorShapeId){ out.vectorShapeId = el.vectorShapeId; out.color = el.color; }
    return out;
  });
}

function serializeCurrentDesign(){
  return {
    bg: {
      colorOn: state.bg.colorOn, color: state.bg.color,
      imageOn: !!(state.bg.imageOn && state.bg.img), src: state.bg.imageOn && state.bg.img ? state.bg.img.src : null,
      opacity: state.bg.opacity, offsetXFrac: state.bg.offsetXFrac, offsetYFrac: state.bg.offsetYFrac, scale: state.bg.scale,
    },
    textLines: state.textLines.map(t => ({ ...t })),
    stickers: serializePlacedArray('sticker'),
    shapes: serializePlacedArray('shape'),
    wordArts: serializePlacedArray('wordart'),
    letters: serializePlacedArray('letter'),
    character: state.character ? { scale: state.character.scale, rotation: state.character.rotation||0, src: state.character.img.src } : null,
    border: state.border ? {
      src: state.border.src || state.border.img.src, label: state.border.label || null,
      rotation: state.border.rotation||0, scale: state.border.scale||1,
      xFrac: state.border.xFrac||0, yFrac: state.border.yFrac||0,
    } : null,
    layerOrder: state.layerOrder.map(d => ({ ...d })),
  };
}

// Reloads every image-bearing element of one placed kind from a snapshot
// array, assigning each a fresh id (via nextPlacedId) and returning an
// old-id -> new-id map so layerOrder can be rebuilt afterward. Any image
// that fails to load (dead/expired src) is silently skipped — same
// "degrade gracefully" spirit as the asset-library fetches.
function loadPlacedArrayFromSnapshot(kind, list){
  const idMap = {};
  return Promise.all((list||[]).map(item => new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const el = { id: nextPlacedId(kind), img, xFrac: item.xFrac||0, yFrac: item.yFrac||0, scale: item.scale||1, rotation: item.rotation||0, locked:false };
      if (item.vectorShapeId){ el.vectorShapeId = item.vectorShapeId; el.color = item.color; }
      placedArray(kind).push(el);
      idMap[item.id] = el.id;
      resolve();
    };
    img.onerror = resolve;
    img.src = item.src;
  }))).then(() => idMap);
}

async function applyPinTemplateSnapshot(snap){
  resetDesignForTemplate();

  state.bg.colorOn = !!snap.bg.colorOn;
  state.bg.color = snap.bg.color || null;
  state.bg.opacity = snap.bg.opacity != null ? snap.bg.opacity : 0.7;
  state.bg.offsetXFrac = snap.bg.offsetXFrac || 0;
  state.bg.offsetYFrac = snap.bg.offsetYFrac || 0;
  state.bg.scale = snap.bg.scale || 1;
  if (snap.bg.imageOn && snap.bg.src){
    await new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { state.bg.img = img; state.bg.imageOn = true; resolve(); };
      img.onerror = resolve; // leaves bg.imageOn false — same as any other failed image
      img.src = snap.bg.src;
    });
  }

  const textIdMap = {};
  (snap.textLines||[]).forEach(t => {
    const newId = state.nextTextId++;
    textIdMap[t.id] = newId;
    const { id, ...rest } = t;
    state.textLines.push({ ...rest, id:newId, locked:false });
  });

  const idMaps = { text: textIdMap };
  idMaps.sticker = await loadPlacedArrayFromSnapshot('sticker', snap.stickers);
  idMaps.shape   = await loadPlacedArrayFromSnapshot('shape', snap.shapes);
  idMaps.wordart = await loadPlacedArrayFromSnapshot('wordart', snap.wordArts);
  idMaps.letter  = await loadPlacedArrayFromSnapshot('letter', snap.letters);

  if (snap.character){
    await new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { state.character = { img, scale: snap.character.scale||1, rotation: snap.character.rotation||0, xFrac:0, yFrac:0, locked:false }; resolve(); };
      img.onerror = resolve;
      img.src = snap.character.src;
    });
  }

  if (snap.border){
    await new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        state.border = { img, src: snap.border.src, label: snap.border.label||null, rotation: snap.border.rotation||0, scale: snap.border.scale||1, xFrac: snap.border.xFrac||0, yFrac: snap.border.yFrac||0 };
        resolve();
      };
      img.onerror = resolve;
      img.src = snap.border.src;
    });
  }

  // Rebuild z-order in the snapshot's original relative sequence, remapping
  // every id and silently dropping any entry whose image failed to load.
  state.layerOrder = (snap.layerOrder||[]).map(d => {
    if (d.kind==='character') return state.character ? { kind:'character' } : null;
    if (d.kind==='text') return textIdMap[d.id]!=null ? { kind:'text', id:textIdMap[d.id] } : null;
    if (idMaps[d.kind] && idMaps[d.kind][d.id]!=null) return { kind:d.kind, id:idMaps[d.kind][d.id] };
    return null;
  }).filter(Boolean);

  goStep('design');
}

// Small offscreen render for the template-browsing grid — reuses the same
// clean (no watermark, no handles) drawing path as compositeCleanDesign,
// just downsized and JPEG-compressed since it's only ever a thumbnail.
function generateTemplateThumbnail(){
  const THUMB_PX = 280;
  const c = document.createElement('canvas');
  c.width = THUMB_PX; c.height = THUMB_PX;
  drawDesignLayer(c.getContext('2d'), THUMB_PX);
  return c.toDataURL('image/jpeg', 0.75);
}

/* ── ADMIN: SAVE CURRENT DESIGN AS A TEMPLATE ────
   Reached only via #saveTemplateBtn, which stays hidden unless
   currentUserIsAdmin — see updateAdminUI(). No server-side gate beyond the
   Firestore security rule (admin-only write on morphii_pin_templates); this
   button is a convenience, not the access control. */
let PIN_TEMPLATES = []; // every admin-saved template, all products — loaded once, refreshed after save/delete
async function loadPinTemplates(){
  try { PIN_TEMPLATES = await getPinTemplates(); } catch(e){ PIN_TEMPLATES = []; }
}

function templatesForCurrentProduct(){
  return PIN_TEMPLATES.filter(t => state.product && t.productId === state.product.id);
}
// Distinct typeLabel values already used for this product, in first-seen
// order — this list IS "the types the admin added", no separate collection.
function pinTemplateTypesForCurrentProduct(){
  const seen = [];
  templatesForCurrentProduct().forEach(t => { if (t.typeLabel && !seen.includes(t.typeLabel)) seen.push(t.typeLabel); });
  return seen;
}

function openSaveTemplateModal(){
  if (!currentUserIsAdmin || !state.product) return;
  document.getElementById('saveTemplateName').value = '';
  document.getElementById('saveTemplateType').value = '';
  document.getElementById('saveTemplateTypeList').innerHTML = pinTemplateTypesForCurrentProduct()
    .map(t => `<option value="${escHtml(t)}">`).join('');
  document.getElementById('saveTemplateError').style.display = 'none';
  document.getElementById('saveTemplateOverlay').classList.add('show');
}
window.openSaveTemplateModal = openSaveTemplateModal;

function closeSaveTemplateModal(){
  document.getElementById('saveTemplateOverlay').classList.remove('show');
}
window.closeSaveTemplateModal = closeSaveTemplateModal;

async function confirmSaveTemplate(){
  const errEl = document.getElementById('saveTemplateError');
  errEl.style.display = 'none';
  const name = document.getElementById('saveTemplateName').value.trim();
  const typeLabel = document.getElementById('saveTemplateType').value.trim();
  if (!name || !typeLabel){
    errEl.textContent = 'Please fill in both a name and a type.';
    errEl.style.display = 'block';
    return;
  }
  const btn = document.getElementById('saveTemplateConfirmBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const payload = {
      productId: state.product.id,
      typeLabel, name,
      thumbnail: generateTemplateThumbnail(),
      size: state.size,
      snapshot: serializeCurrentDesign(),
      createdBy: (AUTH && AUTH.currentUser && AUTH.currentUser.email) || 'unknown',
    };
    // Firestore hard-caps a document at 1MB — most of that budget is any
    // custom-uploaded (base64) images baked into the snapshot, not the
    // thumbnail. Catch it here with a clear message rather than a cryptic
    // Firestore error, since there's no cheap way to shrink those further.
    if (JSON.stringify(payload).length > 900*1024){
      throw new Error("This design is too large to save as a template (likely from custom-uploaded photos) — try using library presets instead of uploads.");
    }
    await savePinTemplate(payload);
    await loadPinTemplates();
    closeSaveTemplateModal();
  } catch(e){
    errEl.textContent = e.message || 'Could not save template.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Save Template';
  }
}
window.confirmSaveTemplate = confirmSaveTemplate;

/* ── CUSTOMER: BROWSE ADMIN TEMPLATES (any non-Election product) ──
   Reached from selectSize() when templatesForCurrentProduct().length > 0.
   Two levels: type grid -> templates-within-type grid -> apply + Design.
   _pinTemplateTypesCache holds the CURRENT type list so click handlers can
   reference it by index (avoids escaping arbitrary admin-typed strings into
   inline onclick HTML). */
let _pinTemplateActiveType = null;
let _pinTemplateTypesCache = [];

function renderPinTemplateGrid(){
  const grid = document.getElementById('pinTemplateGrid');
  if (!grid) return;
  if (_pinTemplateActiveType == null){
    _pinTemplateTypesCache = pinTemplateTypesForCurrentProduct();
    grid.innerHTML = `<div class="cr-product-grid">${_pinTemplateTypesCache.map((typeLabel,i) => {
      const first = templatesForCurrentProduct().find(t=>t.typeLabel===typeLabel);
      return `
      <div class="cr-product-card" onclick="openPinTemplateTypeByIndex(${i})">
        ${first && first.thumbnail ? `<img class="cr-template-thumb" src="${first.thumbnail}" alt="">` : '<div class="cr-product-icon">🎨</div>'}
        <div class="cr-product-name">${escHtml(typeLabel)}</div>
      </div>`;
    }).join('')}</div>`;
    return;
  }
  const inType = templatesForCurrentProduct().filter(t=>t.typeLabel===_pinTemplateActiveType);
  grid.innerHTML = `
    <button class="cr-link-back" style="margin-bottom:12px" onclick="closePinTemplateType()">&larr; Back to template types</button>
    <div class="cr-product-grid">${inType.map(t => `
      <div class="cr-product-card">
        ${currentUserIsAdmin ? `<button class="cr-template-admin-del" title="Delete template" onclick="event.stopPropagation();deletePinTemplateConfirm('${t.id}')">${ICON_TRASH}</button>` : ''}
        <div onclick="usePinTemplate('${t.id}')">
          ${t.thumbnail ? `<img class="cr-template-thumb" src="${t.thumbnail}" alt="">` : '<div class="cr-product-icon">📌</div>'}
          <div class="cr-product-name">${escHtml(t.name)}</div>
        </div>
      </div>`).join('')}</div>`;
}
window.renderPinTemplateGrid = renderPinTemplateGrid;

function openPinTemplateTypeByIndex(i){
  _pinTemplateActiveType = _pinTemplateTypesCache[i];
  renderPinTemplateGrid();
}
window.openPinTemplateTypeByIndex = openPinTemplateTypeByIndex;

function closePinTemplateType(){
  _pinTemplateActiveType = null;
  renderPinTemplateGrid();
}
window.closePinTemplateType = closePinTemplateType;

function startPinDesignFromScratch(){
  resetDesignForTemplate();
  goStep('design');
}
window.startPinDesignFromScratch = startPinDesignFromScratch;

async function usePinTemplate(templateId){
  const t = PIN_TEMPLATES.find(x=>x.id===templateId);
  if (!t) return;
  await applyPinTemplateSnapshot(t.snapshot);
}
window.usePinTemplate = usePinTemplate;

async function deletePinTemplateConfirm(templateId){
  if (!currentUserIsAdmin) return;
  if (!confirm('Delete this template? This cannot be undone.')) return;
  try {
    await deletePinTemplate(templateId);
    PIN_TEMPLATES = PIN_TEMPLATES.filter(t=>t.id!==templateId);
    renderPinTemplateGrid();
  } catch(e){
    alert('Could not delete: ' + e.message);
  }
}
window.deletePinTemplateConfirm = deletePinTemplateConfirm;

function pushGeneratedShape(shapeId, color, xFrac, yFrac, scale, rotationDeg){
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const el = { id: state.nextShapeId++, img, xFrac, yFrac, scale, rotation:(rotationDeg||0)*Math.PI/180, locked:false, vectorShapeId:shapeId, color };
      state.shapes.push(el);
      pushLayer({ kind:'shape', id: el.id });
      resolve();
    };
    img.src = rasterizeVectorShape(shapeId, color);
  });
}

function pushGeneratedText(text, opts){
  if (!text) return;
  const line = {
    id: state.nextTextId++, text, font:FONTS[0], color:opts.color||'#000000',
    placement: opts.placement||'straight', size: opts.size||0.06, arcRadiusMult:0.78, shadow:false,
    xFrac: opts.xFrac||0, yFrac: opts.yFrac||0, rotation:(opts.rotation||0)*Math.PI/180, locked:false,
  };
  state.textLines.push(line);
  pushLayer({ kind:'text', id: line.id });
}

// Starts centered (xFrac/yFrac 0,0) like every other generated element —
// the customer can drag it afterward same as any other layer.
function setGeneratedPhoto(dataUrl, scale){
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      state.character = { img, scale, rotation:0, xFrac:0, yFrac:0, locked:false };
      pushLayer({ kind:'character' });
      resolve();
    };
    img.src = dataUrl;
  });
}

function fillTemplateString(str, values){
  return str.replace(/\$\{(\w+)\}/g, (_, key) => values[key] || '');
}

async function applyElectionTemplate(template, values, photoDataUrl){
  resetDesignForTemplate();
  state.bg.color = { grad:[template.background.color, template.background.color], label:'Custom' };
  state.bg.colorOn = true;

  for (const el of template.elements){
    if (el.type==='shape'){
      await pushGeneratedShape(el.shapeId, el.color, el.xFrac, el.yFrac, el.scale, el.rotation);
    } else if (el.type==='photo'){
      if (photoDataUrl) await setGeneratedPhoto(photoDataUrl, el.scale);
    } else if (el.type==='text'){
      let text;
      if (el.text != null) text = el.text;
      else if (el.composite) text = fillTemplateString(el.composite, values);
      else text = (el.prefix||'') + (values[el.field]||'');
      pushGeneratedText(text, el);
    }
  }

  goStep('design');
}
window.applyElectionTemplate = applyElectionTemplate;

// Standard badge-making sizes — mm (finished/cut diameter) + paperMM (the
// full print/PVC-wrap sheet diameter, incl. bleed) per the supplier's size
// chart. Paper size is a fixed property of each size now, not a customer
// choice (see the removed Print Settings step).
const SIZES = [
  { mm:25, paperMM:35.2, tag:'Smallest', catalogState:'enabled' },
  { mm:32, paperMM:44,   tag:'Compact',  catalogState:'enabled' },
  { mm:37, paperMM:48.8, tag:'Popular',  catalogState:'enabled' },
  { mm:44, paperMM:56.4, tag:'Standard', catalogState:'enabled' }, // ⚠ estimated (not legible on the chart) — confirm and update
  { mm:58, paperMM:70,   tag:'Large',    catalogState:'enabled' },
  { mm:75, paperMM:86.3, tag:'XL',       catalogState:'enabled' },
];

const STEP_ORDER = ['product','size','template','pinTemplates','design','submit','done'];
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

/* ── BUILT-IN VECTOR SHAPES ─────────────────────────────────────────
   Unlike the admin-uploaded SHAPE_PRESETS above (fixed PNGs), these are
   generated as flat SVG path data (100x100 box, centered at 50,50) so they
   can be recolored on demand — addVectorShape()/setShapeColor() rasterize
   the path onto an offscreen canvas at the chosen fill color and use that
   as the placed element's image, same as any uploaded/preset sticker. */
function circlePoints(cx, cy, r, n){
  n = n || 48;
  const pts = [];
  for (let i=0;i<n;i++){
    const a = i*360/n * Math.PI/180;
    pts.push([cx + r*Math.cos(a), cy + r*Math.sin(a)]);
  }
  return pts;
}
function regularPolygonPoints(n, r, rotDeg){
  rotDeg = rotDeg==null ? -90 : rotDeg;
  const pts = [];
  for (let i=0;i<n;i++){
    const a = (rotDeg + i*360/n) * Math.PI/180;
    pts.push([50 + r*Math.cos(a), 50 + r*Math.sin(a)]);
  }
  return pts;
}
function starPoints(n, outerR, innerR, rotDeg){
  rotDeg = rotDeg==null ? -90 : rotDeg;
  const pts = [];
  for (let i=0;i<n*2;i++){
    const r = i%2===0 ? outerR : innerR;
    const a = (rotDeg + i*360/(n*2)) * Math.PI/180;
    pts.push([50 + r*Math.cos(a), 50 + r*Math.sin(a)]);
  }
  return pts;
}
function wobblePoints(n, baseR, amp, freq){
  const pts = [];
  for (let i=0;i<n;i++){
    const a = i*360/n * Math.PI/180;
    const r = baseR + amp*Math.sin(freq*a);
    pts.push([50 + r*Math.cos(a), 50 + r*Math.sin(a)]);
  }
  return pts;
}
function heartPoints(){
  const pts = [];
  const N = 48;
  for (let i=0;i<N;i++){
    const t = i/N * Math.PI*2;
    const x = 16*Math.pow(Math.sin(t),3);
    const y = 13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t);
    pts.push([50 + x*2.15, 50 - y*2.15]);
  }
  return pts;
}
// Radius modulated by |cos| raised to a power — higher power pinches the
// valleys between lobes tighter, so it reads as separated petals rather
// than a soft wavy blob.
function flowerPoints(petals, outerR, innerR, n){
  n = n || petals*15;
  const pts = [];
  for (let i=0;i<n;i++){
    const theta = i/n * Math.PI*2;
    const wave = Math.pow(Math.abs(Math.cos(theta*petals/2)), 2);
    const r = innerR + (outerR-innerR)*wave;
    pts.push([50 + r*Math.cos(theta-Math.PI/2), 50 + r*Math.sin(theta-Math.PI/2)]);
  }
  return pts;
}
function brushStrokePoints(){
  const top = [], bot = [];
  const N = 12;
  for (let i=0;i<=N;i++){
    const t = i/N;
    const x = 8 + t*84;
    const half = (4 + 16*Math.sin(t*Math.PI)) / 2;
    const cy = 50 + 7*Math.sin(t*Math.PI*2.2);
    top.push([x, cy-half]);
    bot.push([x, cy+half]);
  }
  return top.concat(bot.reverse());
}
// Sharp-cornered closed path through a point ring — for polygons/stars.
function sharpPathD(pts){
  return 'M ' + pts.map(p=>p[0].toFixed(2)+','+p[1].toFixed(2)).join(' L ') + ' Z';
}
// Soft closed path — curves from each edge's midpoint to the next, using
// the shared vertex as the control point, so sharp point rings read as
// rounded blobs/petals instead of jagged polygons.
function smoothPathD(pts){
  const n = pts.length;
  const mid = (a,b) => [(a[0]+b[0])/2, (a[1]+b[1])/2];
  const m0 = mid(pts[n-1], pts[0]);
  let d = `M ${m0[0].toFixed(2)},${m0[1].toFixed(2)} `;
  for (let i=0;i<n;i++){
    const cur = pts[i], next = pts[(i+1)%n];
    const m = mid(cur, next);
    d += `Q ${cur[0].toFixed(2)},${cur[1].toFixed(2)} ${m[0].toFixed(2)},${m[1].toFixed(2)} `;
  }
  return d + 'Z';
}
// Several thin triangular spokes radiating from center, all wound the same
// direction so nonzero-rule fill merges them into one sparkle/asterisk.
function asteriskPathD(spokes, innerR, outerR, halfWidthDeg){
  let d = '';
  for (let i=0;i<spokes;i++){
    const baseDeg = i*360/spokes;
    const a1 = (baseDeg-halfWidthDeg)*Math.PI/180, a2 = (baseDeg+halfWidthDeg)*Math.PI/180, a0 = baseDeg*Math.PI/180;
    const p1 = [50+innerR*Math.cos(a1), 50+innerR*Math.sin(a1)];
    const tip = [50+outerR*Math.cos(a0), 50+outerR*Math.sin(a0)];
    const p2 = [50+innerR*Math.cos(a2), 50+innerR*Math.sin(a2)];
    d += `M ${p1[0].toFixed(2)},${p1[1].toFixed(2)} L ${tip[0].toFixed(2)},${tip[1].toFixed(2)} L ${p2[0].toFixed(2)},${p2[1].toFixed(2)} L 50,50 Z `;
  }
  return d;
}

const SHAPE_VECTOR_LIBRARY = [
  { id:'circle',    label:'Circle',        d: smoothPathD(regularPolygonPoints(48, 44)) },
  { id:'square',     label:'Square',        d: sharpPathD([[10,10],[90,10],[90,90],[10,90]]) },
  { id:'rounded',    label:'Rounded Square',d: smoothPathD([[14,14],[86,14],[86,86],[14,86]]) },
  { id:'triangle',   label:'Triangle',      d: sharpPathD(regularPolygonPoints(3, 44)) },
  { id:'diamond',    label:'Diamond',       d: sharpPathD(regularPolygonPoints(4, 44)) },
  { id:'pentagon',   label:'Pentagon',      d: sharpPathD(regularPolygonPoints(5, 44)) },
  { id:'hexagon',    label:'Hexagon',       d: sharpPathD(regularPolygonPoints(6, 44)) },
  { id:'star',       label:'Star',          d: sharpPathD(starPoints(5, 44, 17)) },
  { id:'ninjastar',  label:'Ninja Star',    d: sharpPathD(starPoints(4, 45, 9)) },
  { id:'heart',      label:'Heart',         d: sharpPathD(heartPoints()) },
  { id:'crescent',   label:'Arc',           d: smoothPathD(circlePoints(50,50,42)) + ' ' + smoothPathD(circlePoints(62,50,30)), fillRule:'evenodd' },
  { id:'blob1',      label:'Blob',          d: smoothPathD(blobPointsFrom([40,32,42,30,44,34,38,28])) },
  { id:'blob2',      label:'Blob 2',        d: smoothPathD(blobPointsFrom([36,44,30,40,26,42,34,38,28,40])) },
  { id:'flower',     label:'Flower',        d: sharpPathD(flowerPoints(5, 42, 8)) },
  { id:'asterisk',   label:'Asterisk',      d: asteriskPathD(8, 5, 44, 8) },
  { id:'brush',      label:'Paint Brush',   d: smoothPathD(brushStrokePoints()) },
  { id:'wobble',     label:'Wobble',        d: smoothPathD(wobblePoints(36, 38, 6, 7)) },
  { id:'band',       label:'Band',          d: sharpPathD([[3,38],[97,38],[97,62],[3,62]]) },
  { id:'pill',       label:'Pill',          d: sharpPathD(pillPoints(92, 30)) },
];
// A horizontal capsule (rectangle with fully-rounded semicircular ends), for
// name/position "plate" shapes — width/height are box units (100x100 box).
function pillPoints(width, height, n){
  n = n || 20;
  const r = height/2;
  const left = 50 - width/2 + r, right = 50 + width/2 - r;
  const pts = [];
  for (let i=0; i<=n; i++){ const a = (-90 + i*180/n) * Math.PI/180; pts.push([right + r*Math.cos(a), 50 + r*Math.sin(a)]); }
  for (let i=0; i<=n; i++){ const a = (90 + i*180/n) * Math.PI/180; pts.push([left + r*Math.cos(a), 50 + r*Math.sin(a)]); }
  return pts;
}
function blobPointsFrom(radii){
  const n = radii.length, pts = [];
  for (let i=0;i<n;i++){
    const a = i*360/n * Math.PI/180;
    pts.push([50 + radii[i]*Math.cos(a), 50 + radii[i]*Math.sin(a)]);
  }
  return pts;
}

function rasterizeVectorShape(shapeId, color, px){
  px = px || 800;
  const def = SHAPE_VECTOR_LIBRARY.find(s=>s.id===shapeId);
  if (!def) return null;
  const canvas = document.createElement('canvas');
  canvas.width = px; canvas.height = px;
  const ctx = canvas.getContext('2d');
  ctx.scale(px/100, px/100);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(def.d), def.fillRule || 'nonzero');
  return canvas.toDataURL('image/png');
}

// Sticker/Shape/Word Art are structurally identical placed-image elements
// ({id, img, xFrac, yFrac, scale, rotation, locked}) that only differ in
// which array holds them, which preset gallery feeds them, and their
// dock label/upload wording — so their CRUD is written once and shared.
const PLACED_META = {
  sticker: { label:'Sticker',  uploadNoun:'sticker' },
  shape:   { label:'Shape',    uploadNoun:'shape' },
  wordart: { label:'Word Art', uploadNoun:'word art graphic' },
  letter:  { label:'Letter',   uploadNoun:'letter' },
};
function placedArray(kind){
  if (kind==='sticker') return state.stickers;
  if (kind==='shape') return state.shapes;
  if (kind==='letter') return state.letters;
  return state.wordArts;
}
function placedPresets(kind){
  if (kind==='sticker') return STICKER_PRESETS;
  if (kind==='shape') return SHAPE_PRESETS;
  if (kind==='wordart') return WORDART_PRESETS;
  return []; // letter uses its own two-level LETTER_GROUPS picker, not the flat-preset system
}
function nextPlacedId(kind){
  if (kind==='sticker') return state.nextStickerId++;
  if (kind==='shape') return state.nextShapeId++;
  if (kind==='letter') return state.nextLetterId++;
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
  letters: [],                // same shape as stickers — letter graphics picked via LETTER_GROUPS
  character: null,          // {img, scale, rotation} | null
  border: null,              // {img, src, label} | null — single preset, fixed above background
  nextStickerId: 1,
  nextShapeId: 1,
  nextWordArtId: 1,
  nextLetterId: 1,
  selected: null,           // {kind:'sticker', id} | {kind:'character'} | {kind:'background'} | null
  // Z-order of everything EXCEPT the background and border (which are always
  // fixed at the very back: color, then image, then border, then everything
  // in this list). Index 0 is the back-most of these, the last is front-most.
  layerOrder: [],           // [{kind:'character'}|{kind:'sticker'|'shape'|'wordart', id}|{kind:'text',id}]
  dragging:false, dragTarget:null, dragStartX:0, dragStartY:0, dragStartOffX:0, dragStartOffY:0,
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
  if (name==='template'){ renderTemplateGrid(); }
  if (name==='pinTemplates'){ _pinTemplateActiveType = null; renderPinTemplateGrid(); }
  if (name==='design'){ setupCanvas(); drawPreview(); renderCanvasBgDecor(); updateCanvasBorderRing(); updateAdminUI(); }
  if (name==='submit'){ renderSubmitSummary(); }
}
window.goStep = goStep;

/* ── STEP 1: PRODUCT ─────────────────────────── */
// catalogResolved goes true the moment PRODUCTS/SIZES reflect real truth —
// either an instant cache hit (applyCachedCatalogConfig, before first
// paint) or the live Firestore fetch resolving (loadCatalogConfig). Until
// then, render a loading skeleton instead of the hardcoded defaults: that's
// what stops a disabled/hidden item from ever visibly flashing as available
// before flipping to its real state a moment later.
let catalogResolved = false;
function renderProductGrid(){
  const grid = document.getElementById('productGrid');
  if (!catalogResolved){ grid.innerHTML = catalogSkeletonHtml(6); return; }
  grid.innerHTML = PRODUCTS.filter(p=>p.catalogState!=='hidden').map(p=>{
    const on = p.catalogState==='enabled';
    return `
    <div class="cr-product-card ${on?'':'disabled'}" onclick="${on?`selectProduct('${p.id}')`:''}">
      ${on?'':'<div class="cr-product-badge">Coming Soon</div>'}
      <div class="cr-product-icon">${p.icon}</div>
      <div class="cr-product-name">${p.label}</div>
    </div>`;
  }).join('');
}
function catalogSkeletonHtml(n){
  return Array.from({length:n}).map(()=>'<div class="cr-skeleton-card"></div>').join('');
}
function selectProduct(id){
  const p = PRODUCTS.find(p=>p.id===id);
  if (!p || p.catalogState!=='enabled') return;
  state.product = p;
  applyAssetGroup(currentAssetGroup());
  renderSizeGrid();
  goStep('size');
}
window.selectProduct = selectProduct;

/* ── STEP 2: SIZE ─────────────────────────────── */
function renderSizeGrid(){
  const grid = document.getElementById('sizeGrid');
  if (!catalogResolved){ grid.innerHTML = catalogSkeletonHtml(6); return; }
  grid.innerHTML = SIZES.filter(s=>s.catalogState!=='hidden').map(s=>{
    const on = s.catalogState==='enabled';
    return `
    <div class="cr-size-card ${on?'':'disabled'}" onclick="${on?`selectSize(${s.mm})`:''}">
      ${on?'':'<div class="cr-product-badge">Unavailable</div>'}
      <div class="cr-size-ring" style="width:${24+s.mm*0.85}px;height:${24+s.mm*0.85}px"></div>
      <div class="cr-size-num">${s.mm}mm Circle</div>
      <div class="cr-size-tag">${s.tag}</div>
    </div>`;
  }).join('');
}
// Bleed/paper size is a fixed property of the chosen size (see SIZES above)
// — customers don't control it, so picking a size goes straight to Design.
function selectSize(mm){
  const s = SIZES.find(x=>x.mm===mm);
  if (!s || s.catalogState!=='enabled') return;
  state.size = s.mm;
  state.paperSize = s.paperMM;
  // Election has its own fill-in-a-form premade bank (see 'template' step
  // above). Any OTHER product with at least one admin-saved template (see
  // Firestore morphii_pin_templates) offers the same "start blank or pick a
  // template" choice generically. Everything else goes straight to a blank
  // canvas exactly as before either of those existed.
  if (state.product && state.product.id==='election') goStep('template');
  else if (templatesForCurrentProduct().length) goStep('pinTemplates');
  else goStep('design');
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
const ICON_LETTER      = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="M15.5 20.5l3-9 3 9M16.3 18h4.4"/></svg>';
const ICON_BORDER     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5" stroke-dasharray="2 2.4"/></svg>';
const ICON_PRINT      = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V4h12v5"/><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M6 16h12v5H6z"/></svg>';
const ICON_PLUS       = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_DUPLICATE  = '<svg class="cr-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>';
const ICON_CLOSE      = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
const ICON_UPLOAD      = '<svg class="cr-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5M4 21h16"/></svg>';
const ICON_PALETTE    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 100 18c1.1 0 1.5-.7 1.5-1.4 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.6-1.4 1.4-1.4H16a4 4 0 004-4c0-5-3.6-9-8-9z"/><circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.2" cy="10" r="1.1" fill="currentColor" stroke="none"/></svg>';
const ICON_OPACITY    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/></svg>';
const ICON_SIZE       = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
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
const ICON_SUN        = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8"/></svg>';
const ICON_MOON       = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1110 3.2a6.8 6.8 0 0010 11.3z"/></svg>';

/* ── LIGHT / DARK THEME ──────────────────────────
   Only app chrome switches; the pin canvas always draws with the colors
   the customer picked. A tiny inline script in <head> sets data-theme
   before first paint so there's no flash of the wrong theme. */
const THEME_KEY = 'morphii_theme';
function currentTheme(){ return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
function updateThemeToggleIcon(){
  const icon = currentTheme()==='dark' ? ICON_SUN : ICON_MOON;
  ['themeToggleBtn','themeToggleBtnDesign'].forEach(id=>{
    const btn = document.getElementById(id);
    if (btn) btn.innerHTML = icon;
  });
}
function toggleTheme(){
  const next = currentTheme()==='dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  updateThemeToggleIcon();
  if (typeof drawPreview === 'function') drawPreview();
}
window.toggleTheme = toggleTheme;

/* ── LAYER SELECTION (tap on the pin OR tap a chip — same result) ── */
function layerKey(l){ return l ? l.kind + (l.id!=null ? ':'+l.id : '') : ''; }

function selectLayer(descriptor){
  const changingElement = layerKey(state.selected) !== layerKey(descriptor);
  state.selected = descriptor;
  if (changingElement){
    _activeTool = null; // close any open tool panel for the previous element
    _letterPickerGroupId = null; // reset the Letters picker back to the group-grid level
  }
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

function quickAddLetter(){ addNew('letter'); }
window.quickAddLetter = quickAddLetter;

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
  updateCanvasFabButtons();
  renderElementStrip();
}

// While a sticker is selected, its Duplicate/Add actions move from the dock
// into floating buttons that replace the paste FAB — keeps the paste button
// (only relevant when nothing/something-else is selected) from competing
// with sticker-specific actions in the same small space.
function updateCanvasFabButtons(){
  const paste = document.getElementById('pasteFab');
  const dup = document.getElementById('duplicateFab');
  const add = document.getElementById('addFab');
  if (!paste || !dup || !add) return;
  const isSticker = !!(state.selected && state.selected.kind==='sticker' && state.selected.id!=null);
  paste.style.display = isSticker ? 'none' : '';
  dup.style.display = isSticker ? '' : 'none';
  add.style.display = isSticker ? '' : 'none';
}
window.updateCanvasFabButtons = updateCanvasFabButtons;

function duplicateSelectedSticker(){
  if (state.selected && state.selected.kind==='sticker' && state.selected.id!=null){
    duplicatePlaced('sticker', state.selected.id);
  }
}
window.duplicateSelectedSticker = duplicateSelectedSticker;

function addRowHtml(){
  const allItems = [
    { kind:'background', onclick:'quickSelectBackground()', icon: bgChipThumb(), label:'Background', thumb:true },
    { kind:'border', onclick:'quickSelectBorder()', icon: state.border ? `<img src="${state.border.img.src}" alt="">` : ICON_BORDER, label:'Border', thumb: !!state.border },
    { kind:'character', onclick:'quickSelectCharacter()', icon: state.character ? `<img src="${state.character.img.src}" alt="">` : ICON_CHARACTER, label: state.product && state.product.id==='ph-souvenir' ? 'Image' : 'Character', thumb: !!state.character },
    { kind:'sticker', onclick:'quickAddSticker()', icon: ICON_STICKER, label:'Sticker' },
    { kind:'shape', onclick:'quickAddShape()', icon: ICON_SHAPE, label:'Shapes' },
    { kind:'wordart', onclick:'quickAddWordArt()', icon: ICON_WORDART, label:'Word Art' },
    { kind:'letter', onclick:'quickAddLetter()', icon: ICON_LETTER, label:'Letters' },
    { kind:'text', onclick:'quickAddText()', icon: ICON_TEXT, label:'Text' },
  ];
  const allowed = state.product && state.product.tools;
  const items = allowed ? allItems.filter(it=>allowed.includes(it.kind)) : allItems;
  const btns = items.map(it=>`
    <button class="cr-dock-btn" onclick="${it.onclick}">
      <span class="cr-dock-icon ${it.thumb?'cr-dock-icon-thumb':''}">${it.icon}</span>
      <span class="cr-dock-label">${it.label}</span>
    </button>`).join('');
  return `<div class="cr-add-row">${btns}</div>`;
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
      { id:'lock', label: state.character.locked?'Locked':'Lock', icon: state.character.locked?ICON_LOCK:ICON_UNLOCK, instant:"toggleLock('character')", on: state.character.locked },
      { id:'remove', label:'Remove', icon:ICON_TRASH, instant:'removeCharacter()', danger:true },
    ];
  }
  if (kind==='border') return [
    { id:'presets', label:'Presets', icon:ICON_PALETTE, panel:true },
    { id:'replace', label:'Upload', icon:ICON_UPLOAD, instant:"promptUpload('border')" },
    { id:'lock', label: state.border && state.border.locked?'Locked':'Lock', icon: state.border && state.border.locked?ICON_LOCK:ICON_UNLOCK, instant:"toggleLock('border')", on: state.border && state.border.locked },
    { id:'remove', label:'Remove', icon:ICON_TRASH, instant:'removeBorder()', danger:true },
  ];
  if (kind==='sticker' || kind==='shape' || kind==='wordart' || kind==='letter'){
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
    ];
    // Built-in vector shapes (not admin PNG presets or uploads) can be
    // recolored on demand — see setShapeColor().
    if (kind==='shape' && el.vectorShapeId) icons.push({ id:'color', label:'Color', icon:ICON_SWATCH, panel:true });
    // Stickers get floating Duplicate/Add buttons instead (updateCanvasFabButtons)
    // — keep Duplicate in the dock for Shape/Word Art, which don't have those FABs.
    if (kind!=='sticker') icons.push({ id:'duplicate', label:'Duplicate', icon:ICON_DUPLICATE, instant:`duplicatePlaced('${kind}',${el.id})` });
    icons.push(
      { id:'lock', label: el.locked?'Locked':'Lock', icon: el.locked?ICON_LOCK:ICON_UNLOCK, instant:`toggleLock('${kind}',${el.id})`, on: el.locked },
      { id:'remove', label:'Remove', icon:ICON_TRASH, instant:`removePlaced('${kind}',${el.id})`, danger:true },
    );
    return icons;
  }
  if (kind==='text'){
    const t = state.textLines.find(x=>x.id===state.selected.id);
    if (!t) return [];
    const icons = [
      { id:'edit', label:'Edit', icon:ICON_EDIT, instant:`openTextEditModal(${t.id})` },
      { id:'placement', label:'Style', icon:ICON_ARC, panel:true },
      { id:'color', label:'Color', icon:ICON_SWATCH, panel:true },
    ];
    // Straight text's size is just .size, fully covered by the resize rail
    // + pinch/wheel now — only curved text still needs a dock control,
    // since its actual font size is a separate field from the curve-radius
    // pinch/rail adjusts (see textToolPanelHtml's 'size' branch).
    if (t.placement !== 'straight') icons.push({ id:'size', label:'Font Size', icon:ICON_SIZE, panel:true });
    icons.push(
      { id:'shadow', label:'Shadow', icon:ICON_SHADOW, instant:`toggleTextShadow(${t.id},${!t.shadow})`, on:t.shadow },
      { id:'lock', label: t.locked?'Locked':'Lock', icon: t.locked?ICON_LOCK:ICON_UNLOCK, instant:`toggleLock('text',${t.id})`, on: t.locked },
      { id:'remove', label:'Remove', icon:ICON_TRASH, instant:`removeTextLine(${t.id})`, danger:true },
    );
    return icons;
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
    <div class="cr-tool-row-scroll">${btns}</div>`;
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
  else if (kind==='sticker' || kind==='shape' || kind==='wordart' || kind==='letter') html = placedToolPanelHtml(kind, _activeTool, state.selected.id);
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
    const g = state.bg.color;
    const isSolid = !!(g && g.grad && g.grad[0]===g.grad[1]);
    const safeBgColor = (isSolid && /^#[0-9a-fA-F]{6}$/.test(g.grad[0])) ? g.grad[0] : '#F5F1DE';
    return `
      <div class="cr-gradient-grid">${GRADIENTS.map((g,i)=>{
        const css = g.grad4
          ? `conic-gradient(from 45deg, ${g.grad4[0]}, ${g.grad4[1]}, ${g.grad4[3]}, ${g.grad4[2]}, ${g.grad4[0]})`
          : `linear-gradient(135deg, ${g.grad[0]}, ${g.grad[1]})`;
        return `<button class="cr-gradient-swatch ${state.bg.color===g?'active':''}" style="background:${css}" title="${g.label}" onclick="selectGradient(${i})"></button>`;
      }).join('')}</div>
      <div class="cr-field-label" style="margin-top:10px">Or a blank color</div>
      <label class="cr-color-swatch cr-color-swatch-picker ${isSolid?'active':''}" style="width:40px;height:40px" title="Custom solid color">
        <input type="color" value="${safeBgColor}" oninput="setBgSolidColor(this.value)">
        ${ICON_PICKER_WHEEL}
      </label>
      ${state.bg.color ? `<label class="cr-checkbox-row"><input type="checkbox" ${state.bg.colorOn?'checked':''} onchange="toggleColorLayer(this.checked)">Show this color</label>` : ''}
      <div class="cr-hint">Only used when no photo is active — turn off "Show the photo" to reveal a color instead.</div>`;
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

function setBgSolidColor(hex){
  state.bg.color = { grad:[hex,hex], label:'Custom' };
  state.bg.colorOn = true;
  renderDock();
  renderToolPanelContent();
  drawPreview();
  updateSubmitAvailability();
}
window.setBgSolidColor = setBgSolidColor;

/* ── BORDER TOOL PANEL (single preset, fixed above the background) ── */
function borderToolPanelHtml(tool){
  if (tool==='presets'){
    if (!BORDER_PRESETS.length) return `<div class="cr-empty-hint">No border designs yet — check back soon!</div>`;
    return `<div class="cr-preset-grid">${BORDER_PRESETS.map((p,i)=>
      `<button class="cr-preset-thumb ${state.border && state.border.src===p.src ? 'active' : ''}" onclick="selectBorderPreset(${i})"><img src="${p.src}" alt="${escHtml(p.label||'')}"></button>`
    ).join('')}</div>`;
  }
  return '';
}

function selectBorderPreset(i){
  const preset = BORDER_PRESETS[i];
  if (!preset) return;
  const isNew = !state.border;
  const prevRotation = state.border ? state.border.rotation : 0;
  const prevScale = state.border ? state.border.scale : 1;
  const img = new Image();
  img.crossOrigin = 'anonymous'; // raw.githubusercontent.com sends CORS headers — needed so the design canvas doesn't get tainted
  img.onload = () => {
    state.border = { img, src: preset.src, label: preset.label, rotation: prevRotation, scale: prevScale, xFrac: 0, yFrac: 0, locked:false };
    if (isNew) pushLayer({ kind:'border' });
    renderDock(); renderToolPanelContent(); drawPreview(); updateCanvasBorderRing(); updateRotateRail();
  };
  img.src = preset.src;
}
window.selectBorderPreset = selectBorderPreset;

function removeBorder(){
  state.border = null;
  removeLayerFromOrder('border', undefined);
  updateCanvasBorderRing();
  if (state.selected && state.selected.kind==='border') deselectLayer();
  else { renderDock(); drawPreview(); }
}
window.removeBorder = removeBorder;

function onBorderFileChosen(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const isNew = !state.border;
    const prevRotation = state.border ? state.border.rotation : 0;
    const prevScale = state.border ? state.border.scale : 1;
    const img = new Image();
    img.onload = () => {
      state.border = { img, src: ev.target.result, label: null, rotation: prevRotation, scale: prevScale, xFrac: 0, yFrac: 0, locked:false };
      if (isNew) pushLayer({ kind:'border' });
      renderDock(); renderToolPanelContent(); drawPreview(); updateCanvasBorderRing(); updateRotateRail();
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
  // Photo and color background are mutually exclusive (drawBackground draws
  // a plain white base under an active photo instead), so no color needs
  // to be auto-applied here anymore.
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
  shape:'shapeFileInput', wordart:'wordartFileInput', letter:'letterFileInput',
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

const PLACED_ICON = { sticker: ICON_STICKER, shape: ICON_SHAPE, wordart: ICON_WORDART, letter: ICON_LETTER };
function layerThumbFor(d){
  if (d.kind==='character') return state.character ? `<img src="${state.character.img.src}" alt="">` : ICON_CHARACTER;
  if (d.kind==='border') return state.border ? `<img src="${state.border.img.src}" alt="">` : ICON_BORDER;
  if (PLACED_META[d.kind]){ const el=placedArray(d.kind).find(x=>x.id===d.id); return el ? `<img src="${el.img.src}" alt="">` : PLACED_ICON[d.kind]; }
  return ICON_TEXT;
}
function layerLabelFor(d){
  if (d.kind==='character') return 'Character';
  if (d.kind==='border') return 'Border';
  if (PLACED_META[d.kind]){ const idx=placedArray(d.kind).findIndex(x=>x.id===d.id); return PLACED_META[d.kind].label+' '+(idx+1); }
  const t = state.textLines.find(x=>x.id===d.id);
  return (t && t.text ? t.text : 'Text').slice(0,18);
}
function layerLockedFor(d){
  if (d.kind==='character') return !!(state.character && state.character.locked);
  if (d.kind==='border') return !!(state.border && state.border.locked);
  if (PLACED_META[d.kind]){ const el=placedArray(d.kind).find(x=>x.id===d.id); return !!(el && el.locked); }
  const t = state.textLines.find(x=>x.id===d.id);
  return !!(t && t.locked);
}

/* ── ELEMENT STRIP (over the top of the pin) — the only way to select an
   element now; tapping the canvas directly no longer selects anything
   (see bindCanvasInteractions). Tapping an unselected icon selects it;
   tapping the already-selected icon toggles its lock instead, so lock
   and select share one control without either action stepping on the
   other. Reuses the same descriptors/helpers as the Layers modal so
   thumbnails, labels and lock state always agree with it. */
function renderElementStrip(){
  const wrap = document.getElementById('elementStripWrap');
  const strip = document.getElementById('elementStrip');
  if (!wrap || !strip) return;
  const items = layersVisualList();
  if (!items.length){ wrap.style.display = 'none'; strip.innerHTML = ''; return; }
  wrap.style.display = '';
  strip.innerHTML = items.map(d => {
    const selected = layerKey(state.selected) === layerKey(d);
    const locked = layerLockedFor(d);
    return `
      <button class="cr-element-strip-btn ${selected?'selected':''}" title="${escHtml(layerLabelFor(d))}"
        onclick='onElementStripTap(${JSON.stringify(d)})'>
        ${layerThumbFor(d)}${locked ? `<span class="cr-element-strip-lock-overlay">${ICON_LOCK}</span>` : ''}
      </button>`;
  }).join('');
}
window.renderElementStrip = renderElementStrip;

function onElementStripTap(d){
  const descriptor = { kind: d.kind, id: d.id };
  if (layerKey(state.selected) === layerKey(descriptor)) toggleLock(d.kind, d.id);
  else selectLayer(descriptor);
}
window.onElementStripTap = onElementStripTap;

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
      <button class="cr-layer-row-delete" title="Delete layer" onclick='removeLayerFromModal(${JSON.stringify(d)})'>${ICON_TRASH}</button>
    </div>`).join('') : `<div class="cr-empty-hint">No layers yet — add text, a sticker, or a character to see them here.</div>`;

  const fixedRows = [];
  const bgImageActive = state.bg.imageOn && state.bg.img;
  if (bgImageActive) fixedRows.push({ label:'Background Photo', thumb:`<img src="${state.bg.img.src}" alt="">` });
  if (!bgImageActive && state.bg.colorOn && state.bg.color){
    const g = state.bg.color;
    const css = g.grad4 ? `linear-gradient(135deg,${g.grad4[0]},${g.grad4[3]})` : `linear-gradient(135deg,${g.grad[0]},${g.grad[1]})`;
    fixedRows.push({ label:'Background Color', thumb:`<span style="display:block;width:100%;height:100%;background:${css}"></span>` });
  }
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

function removeLayerFromModal(d){
  if (d.kind==='character') removeCharacter();
  else if (d.kind==='border') removeBorder();
  else if (d.kind==='text') removeTextLine(d.id);
  else if (PLACED_META[d.kind]) removePlaced(d.kind, d.id);
  renderLayersModal();
}
window.removeLayerFromModal = removeLayerFromModal;

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
// Inline-SVG grid for the built-in vector shape library — used instead of
// <img> thumbs since these have no fixed src (they're generated on click).
function vectorShapeGridHtml(activeId, onclickFor){
  return `<div class="cr-preset-grid">${SHAPE_VECTOR_LIBRARY.map(s=>
    `<button class="cr-preset-thumb ${activeId===s.id?'active':''}" onclick="${onclickFor(s.id)}" title="${s.label}"><svg viewBox="0 0 100 100"><path d="${s.d}" fill="currentColor" fill-rule="${s.fillRule||'nonzero'}"/></svg></button>`
  ).join('')}</div>`;
}

// Two-level Letters picker: Level 1 is one thumbnail per design group (always
// that group's "A"); tapping a group drills into Level 2, its full alphabet.
// _letterPickerGroupId is transient nav state (not part of `state`/undo) — it
// just tracks which level the currently-open panel is showing.
let _letterPickerGroupId = null;

function openLetterGroup(groupId){
  _letterPickerGroupId = groupId;
  renderToolPanelContent();
}
window.openLetterGroup = openLetterGroup;

function closeLetterGroup(){
  _letterPickerGroupId = null;
  renderToolPanelContent();
}
window.closeLetterGroup = closeLetterGroup;

function letterGroupGridHtml(onClickFor){
  if (!LETTER_GROUPS.length) return `<div class="cr-empty-hint">😢 No letters here yet — check back soon, or use Upload above.</div>`;
  return `<div class="cr-preset-grid">${LETTER_GROUPS.map(g=>
    `<button class="cr-preset-thumb" onclick="${onClickFor(g.groupId)}" title="Letters ${g.groupId}"><img src="${g.thumbSrc}" alt="Letters ${g.groupId}"></button>`
  ).join('')}</div>`;
}

function letterAlphabetGridHtml(groupId, activeSrc, onClickFor){
  const group = LETTER_GROUPS.find(g=>g.groupId===groupId);
  if (!group) return '';
  const letters = Object.keys(group.letters).sort();
  return `
    <button class="cr-back-link" onclick="closeLetterGroup()">&larr; Back to designs</button>
    <div class="cr-preset-grid">${letters.map(L=>
      `<button class="cr-preset-thumb ${activeSrc===group.letters[L]?'active':''}" onclick="${onClickFor(groupId, L)}" title="${L}"><img src="${group.letters[L]}" alt="${L}"></button>`
    ).join('')}</div>`;
}

// Shared by both the "nothing added yet" and "swap the existing one" panels
// — el is null when adding fresh, or the existing placed element when swapping.
function letterPickerHtml(el){
  if (_letterPickerGroupId){
    const activeSrc = el ? el.img.src : null;
    const onClickFor = el
      ? (groupId, L) => `swapLetterFromGroup(${el.id},'${groupId}','${L}')`
      : (groupId, L) => `addLetterFromGroup('${groupId}','${L}')`;
    return letterAlphabetGridHtml(_letterPickerGroupId, activeSrc, onClickFor);
  }
  return letterGroupGridHtml(groupId => `openLetterGroup('${groupId}')`);
}

function placedToolPanelHtml(kind, tool, id){
  const noun = PLACED_META[kind].label.toLowerCase();
  const isShape = kind==='shape';
  const isLetter = kind==='letter';

  // Pending — nothing created yet. Presets grid creates a new element when
  // tapped; there's nothing to show for any other tool in this state.
  if (id == null){
    if (tool!=='presets') return '';
    if (isLetter) return letterPickerHtml(null);
    const presets = placedPresets(kind);
    if (!isShape && !presets.length) return `<div class="cr-empty-hint">😢 No ${noun}s here yet — check back soon, or use Upload above.</div>`;
    return `
      ${isShape ? vectorShapeGridHtml(null, sid=>`addVectorShape('${sid}')`) : ''}
      ${presets.length ? `${isShape?'<div class="cr-field-label">More Presets</div>':''}<div class="cr-preset-grid">${presets.map((p,i)=>
        `<button class="cr-preset-thumb" onclick="addPlacedFromPreset('${kind}',${i})"><img src="${p.src}" alt="${escHtml(p.label||'')}"></button>`
      ).join('')}</div>` : ''}`;
  }

  const el = placedArray(kind).find(x=>x.id===id);
  if (!el) return '';
  if (tool==='presets'){
    if (isLetter) return letterPickerHtml(el);
    const presets = placedPresets(kind);
    if (!isShape && !presets.length) return `<div class="cr-empty-hint">😢 No ${noun}s here yet — check back soon!</div>`;
    return `
      ${isShape ? vectorShapeGridHtml(el.vectorShapeId, sid=>`swapToVectorShape('${kind}',${el.id},'${sid}')`) : ''}
      ${presets.length ? `${isShape?'<div class="cr-field-label">More Presets</div>':''}<div class="cr-preset-grid">${presets.map((p,i)=>
        `<button class="cr-preset-thumb ${el.img && el.img.src===p.src ? 'active' : ''}" onclick="swapPlacedImage('${kind}',${el.id},${i})"><img src="${p.src}" alt="${escHtml(p.label||'')}"></button>`
      ).join('')}</div>` : ''}`;
  }
  if (tool==='color' && isShape && el.vectorShapeId){
    const cur = (el.color||'').toLowerCase();
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(el.color) ? el.color : SHAPE_DEFAULT_COLOR;
    return `<div class="cr-color-swatch-grid">
      ${TEXT_COLOR_SWATCHES.map(c=>
        `<button class="cr-color-swatch ${cur===c.toLowerCase()?'active':''}" style="background:${c}" onclick="setShapeColor(${el.id},'${c}')" title="${c}"></button>`
      ).join('')}
      <label class="cr-color-swatch cr-color-swatch-picker" title="Custom color">
        <input type="color" value="${safeColor}" oninput="setShapeColor(${el.id},this.value)">
        ${ICON_PICKER_WHEEL}
      </label>
    </div>`;
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

// Letters bypass the flat placedPresets() array (their picker is the
// two-level LETTER_GROUPS structure instead), so they get their own
// add/swap pair mirroring addPlacedFromPreset/swapPlacedImage.
function addLetterFromGroup(groupId, letter){
  const group = LETTER_GROUPS.find(g=>g.groupId===groupId);
  const src = group && group.letters[letter];
  if (!src) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const el = { id: nextPlacedId('letter'), img, xFrac:0.15, yFrac:-0.15, scale:1, rotation:0, locked:false };
    placedArray('letter').push(el);
    pushLayer({ kind:'letter', id: el.id });
    selectLayer({ kind:'letter', id: el.id });
    renderCanvasBgDecor();
  };
  img.src = src;
}
window.addLetterFromGroup = addLetterFromGroup;

function swapLetterFromGroup(id, groupId, letter){
  const group = LETTER_GROUPS.find(g=>g.groupId===groupId);
  const src = group && group.letters[letter];
  const el = placedArray('letter').find(x=>x.id===id);
  if (!src || !el) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { el.img = img; renderToolPanelContent(); drawPreview(); };
  img.src = src;
}
window.swapLetterFromGroup = swapLetterFromGroup;

const SHAPE_DEFAULT_COLOR = '#FF6F91';

function addVectorShape(shapeId){
  const color = SHAPE_DEFAULT_COLOR;
  const img = new Image();
  img.onload = () => {
    const el = { id: nextPlacedId('shape'), img, xFrac:0.15, yFrac:-0.15, scale:1, rotation:0, locked:false, vectorShapeId:shapeId, color };
    placedArray('shape').push(el);
    pushLayer({ kind:'shape', id: el.id });
    selectLayer({ kind:'shape', id: el.id });
    renderCanvasBgDecor();
  };
  img.src = rasterizeVectorShape(shapeId, color);
}
window.addVectorShape = addVectorShape;

// Swap-in-place for the vector shape library, mirroring swapPlacedImage —
// keeps the element's position/size/rotation, and its current color if it
// was already a vector shape (otherwise starts at the default color).
function swapToVectorShape(kind, id, shapeId){
  const el = placedArray(kind).find(x=>x.id===id);
  if (!el) return;
  const color = el.vectorShapeId ? (el.color||SHAPE_DEFAULT_COLOR) : SHAPE_DEFAULT_COLOR;
  const img = new Image();
  img.onload = () => {
    el.img = img; el.vectorShapeId = shapeId; el.color = color;
    renderToolPanelContent(); drawPreview();
  };
  img.src = rasterizeVectorShape(shapeId, color);
}
window.swapToVectorShape = swapToVectorShape;

function setShapeColor(id, hex){
  const el = state.shapes.find(x=>x.id===id);
  if (!el || !el.vectorShapeId) return;
  const img = new Image();
  img.onload = () => {
    el.img = img; el.color = hex;
    renderToolPanelContent(); drawPreview();
  };
  img.src = rasterizeVectorShape(el.vectorShapeId, hex);
}
window.setShapeColor = setShapeColor;

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
  if (el.vectorShapeId){ copy.vectorShapeId = el.vectorShapeId; copy.color = el.color; }
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

/* ── CHARACTER TOOL PANELS (single, big mascot/logo slot — freely draggable) ── */
function characterToolPanelHtml(tool){
  const c = state.character;
  if (!c){
    if (tool!=='presets') return '';
    if (!CHARACTER_PRESETS.length) return `<div class="cr-empty-hint">😢 No characters here yet — check back soon, or use Upload above.</div>`;
    return `<div class="cr-preset-grid">${CHARACTER_PRESETS.map((p,i)=>
      `<button class="cr-preset-thumb" onclick="setCharacterFromPreset(${i})"><img src="${p.src}" alt="${escHtml(p.label||'')}"></button>`
    ).join('')}</div>`;
  }
  return '';
}

function toggleLock(kind, id){
  const el = kind==='background' ? state.bg
    : kind==='character' ? state.character
    : kind==='border' ? state.border
    : (kind==='sticker' || kind==='shape' || kind==='wordart' || kind==='letter') ? placedArray(kind).find(x=>x.id===id)
    : state.textLines.find(t=>t.id===id);
  if (!el) return;
  el.locked = !el.locked;
  renderDock();
  updateRotateRail();
  updateResizeRail();
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

/* ── TEXT PANEL ───────────────────────────────── */
function addTextLine(){
  const line = { id: state.nextTextId++, text:'Your Text', font:FONTS[0], color:'#FFFFFF', placement:'straight', size:1, arcRadiusMult:0.78, shadow:false, xFrac:0, yFrac:0, rotation:0, locked:false };
  state.textLines.push(line);
  pushLayer({ kind:'text', id: line.id });
  selectLayer({ kind:'text', id: line.id });
  openTextEditModal(line.id);
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
  // Only reachable for curved text now (see toolIconsForSelection) — its
  // actual font size is a separate field from the curve radius that
  // pinch/wheel/the resize rail adjust, so it still needs its own control.
  if (tool==='size' && t.placement !== 'straight'){
    const sizePctArc = Math.round(t.size*100);
    return `
      <div class="cr-field-label">Font Size</div>
      <input type="number" class="cr-text-input" style="margin-bottom:0" min="1" step="1" inputmode="numeric"
        value="${sizePctArc}" oninput="setTextSizeRaw(${t.id},this.value)">
      <div class="cr-hint">No size limit — type any value. Pinch on the pin (or the slider on the left) adjusts how far out the curve sits, separately from font size.</div>`;
  }
  return '';
}

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

/* ── TEXT EDIT (fullscreen) — content + font live here; everything else
   (placement/color/size/shadow/lock/remove) stays in the dock rising panel.
   Cancel restores the text that was there when the modal opened; Done just
   keeps whatever's live (typing already updates state.textLines directly,
   same as the old inline field did). ── */
let _textEditId = null, _textEditSnapshot = null;

function openTextEditModal(id){
  const t = state.textLines.find(x=>x.id===id);
  if (!t) return;
  _textEditId = id;
  _textEditSnapshot = t.text;
  const input = document.getElementById('textEditInput');
  input.value = t.text;
  input.style.fontFamily = `'${t.font}'`;
  renderTextEditFonts();
  document.getElementById('textEditOverlay').classList.add('show');
  setTimeout(()=>{ input.focus(); input.select(); }, 50);
}
window.openTextEditModal = openTextEditModal;

function onTextEditInput(val){
  if (_textEditId==null) return;
  updateTextLine(_textEditId, 'text', val);
}
window.onTextEditInput = onTextEditInput;

function renderTextEditFonts(){
  const wrap = document.getElementById('textEditFonts');
  const t = state.textLines.find(x=>x.id===_textEditId);
  if (!wrap || !t) return;
  wrap.innerHTML = FONTS.map(f=>`
    <button class="cr-text-edit-font-btn ${t.font===f?'active':''}" style="font-family:'${escHtml(f)}'" onclick="setTextEditFont('${escHtml(f)}')">${escHtml(f)}</button>
  `).join('');
}

function setTextEditFont(font){
  if (_textEditId==null) return;
  updateTextLine(_textEditId, 'font', font);
  const input = document.getElementById('textEditInput');
  if (input) input.style.fontFamily = `'${font}'`;
  renderTextEditFonts();
}
window.setTextEditFont = setTextEditFont;

function confirmTextEdit(){
  const t = state.textLines.find(x=>x.id===_textEditId);
  if (t && !t.text.trim()) updateTextLine(t.id, 'text', 'Your Text'); // don't leave an empty text line behind
  closeTextEditModal();
}
window.confirmTextEdit = confirmTextEdit;

function cancelTextEdit(){
  if (_textEditId!=null) updateTextLine(_textEditId, 'text', _textEditSnapshot);
  closeTextEditModal();
}
window.cancelTextEdit = cancelTextEdit;

function closeTextEditModal(){
  const input = document.getElementById('textEditInput');
  if (input) input.blur();
  document.getElementById('textEditOverlay').classList.remove('show');
  _textEditId = null; _textEditSnapshot = null;
  renderDock();
}
window.closeTextEditModal = closeTextEditModal;

/* ── CANVAS INTERACTIONS: drag to move, pinch/wheel to resize, the rotate
   rail to rotate. There are no on-canvas handles — locked elements stay
   tappable/selectable (so the rail's lock icon can unlock them again) but
   reject every actual modification (move/resize/rotate) until unlocked. ── */
function startElementDrag(canvas, e, el){
  state.dragging = true;
  state.dragTarget = el;
  state.dragStartX = e.clientX; state.dragStartY = e.clientY;
  state.dragStartOffX = el.xFrac; state.dragStartOffY = el.yFrac;
  canvas.setPointerCapture(e.pointerId);
}

// Whatever should respond to pinch (touch) / wheel (desktop) resize right
// now — whichever non-background element is selected (and unlocked), else
// the background photo (if it has one and isn't locked), else nothing (in
// which case the gesture falls through to canvas view zoom instead).
function resizeTarget(){
  const { el, kind } = selectedElementAndKind();
  if (el && kind && kind!=='background') return el.locked ? null : { el, kind };
  if (state.bg.imageOn && state.bg.img && !state.bg.locked) return { el: state.bg, kind:'background' };
  return null;
}
// The scale-like field a given kind actually resizes — arc text uses
// arcRadiusMult (how far the curve sits from center), straight text uses
// size (font size), everything else uses scale.
function resizeStartScaleFor(el, kind){
  if (kind==='text' && el.placement && el.placement!=='straight') return el.arcRadiusMult||0.78;
  if (kind==='text') return el.size;
  return el.scale||1;
}
// General resize ceiling — customers were hitting the old 3x/5x caps on
// stickers/text wanting to blow something up much bigger, so this is
// deliberately generous (10x is already several times the whole pin).
// Border keeps its own much smaller range (see below) and arc text's
// curve-radius keeps its own — neither is really "how big does this look."
const RESIZE_SCALE_MIN = 0.1, RESIZE_SCALE_MAX = 10;

// Same per-kind fields the old on-canvas resize handle used, now shared by
// pinch, wheel, AND the resize rail slider. `ratio` is startScale-relative
// (pinch: tracked across the whole gesture; slider: startScale is always 1
// so ratio IS the absolute target) or a single-tick multiplier read against
// the CURRENT value (wheel).
function applyResizeRatioTarget(target, startScale, ratio){
  const { el, kind } = target;
  if (kind==='text' && el.placement && el.placement!=='straight'){
    el.arcRadiusMult = Math.max(0.2, Math.min(2.5, startScale * ratio));
  } else if (kind==='text'){
    el.size = Math.max(RESIZE_SCALE_MIN, Math.min(RESIZE_SCALE_MAX, startScale * ratio));
    clampTextSize(el); // separately re-shrinks to fit the safe area if needed — a print-legibility guard, not a size cap
    clampElementToCutLine(el);
  } else if (kind==='border'){
    // Small tweak range only — this compensates for asset borders that
    // aren't perfectly circular, not a general resize.
    el.scale = Math.max(0.7, Math.min(1.3, startScale * ratio));
  } else if (kind==='background'){
    el.scale = startScale * ratio;
    clampBgTransform();
  } else {
    el.scale = Math.max(RESIZE_SCALE_MIN, Math.min(RESIZE_SCALE_MAX, startScale * ratio));
  }
}

function bindCanvasInteractions(canvas){
  canvas.addEventListener('contextmenu', e=>e.preventDefault());
  canvas.addEventListener('dragstart', e=>e.preventDefault());

  canvas.addEventListener('pointerdown', e=>{
    // Tapping the canvas no longer selects anything — the element strip
    // above the pin is the only way to select. A tap anywhere on the canvas
    // drags whatever is ALREADY selected, even if the finger isn't directly
    // over it (the move below is delta-based, so the object keeps its
    // offset from the finger instead of snapping under it) — this way a
    // finger dragging a small object around never has to sit on top of it
    // and block the customer's view of it.
    const { el, kind } = selectedElementAndKind();
    if (kind==='background'){
      if (state.bg.imageOn && state.bg.img && !state.bg.locked){
        state.dragging = true;
        state.dragTarget = 'bg';
        state.dragStartX = e.clientX; state.dragStartY = e.clientY;
        state.dragStartOffX = state.bg.offsetXFrac; state.dragStartOffY = state.bg.offsetYFrac;
        canvas.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (el && kind && !el.locked){
      startElementDrag(canvas, e, el);
    }
  });

  canvas.addEventListener('pointermove', e=>{
    if (!state.dragging) return;
    const rect = canvas.getBoundingClientRect();

    if (state.dragTarget==='bg'){
      const dxFrac = (e.clientX - state.dragStartX) / rect.width;
      const dyFrac = (e.clientY - state.dragStartY) / rect.height;
      state.bg.offsetXFrac = state.dragStartOffX + dxFrac;
      state.bg.offsetYFrac = state.dragStartOffY + dyFrac;
      clampBgTransform();
    } else if (state.dragTarget){
      const dxFrac = (e.clientX - state.dragStartX) / rect.width;
      const dyFrac = (e.clientY - state.dragStartY) / rect.height;
      state.dragTarget.xFrac = state.dragStartOffX + dxFrac;
      state.dragTarget.yFrac = state.dragStartOffY + dyFrac;
      if (state.dragTarget === state.border) clampBorderOffset();
      else clampElementToCutLine(state.dragTarget);
    }
    drawPreview();
  });
  canvas.addEventListener('pointerup', ()=>{ state.dragging=false; state.dragTarget=null; });
  canvas.addEventListener('pointercancel', ()=>{ state.dragging=false; state.dragTarget=null; });

  canvas.addEventListener('wheel', e=>{
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const target = resizeTarget();
    if (target){
      applyResizeRatioTarget(target, resizeStartScaleFor(target.el, target.kind), delta);
      drawPreview();
    }
    // else: nothing selected/resizable — no-op (canvas view zoom removed,
    // it was glitching other objects' geometry math while active).
  }, { passive:false });

  // Two-finger touch pinch-resizes whichever element is selected (or the
  // background photo). There's no canvas-view-zoom fallback anymore — with
  // nothing to resize, a two-finger touch just does nothing.
  let pinchTarget = null, pinchStartDist = null, pinchStartScale = 1;

  canvas.addEventListener('touchstart', e=>{
    if (e.touches.length===2){
      // The first finger down already fired its own pointerdown and may
      // have started a position-drag (see pointerdown above — it no longer
      // requires landing on the object, so this fires on ~every pinch).
      // Once a second finger joins, that's a pinch, not a drag — stop the
      // drag so the two don't fight over xFrac/yFrac and scale in the same
      // frame, which is what was causing the resize to flicker/jump around.
      state.dragging = false; state.dragTarget = null;
      const target = resizeTarget();
      pinchTarget = target;
      if (target){
        pinchStartDist = touchDist(e.touches);
        pinchStartScale = resizeStartScaleFor(target.el, target.kind);
      }
    }
  }, { passive:true });

  canvas.addEventListener('touchmove', e=>{
    if (e.touches.length===2 && pinchTarget){
      e.preventDefault();
      const d = touchDist(e.touches);
      applyResizeRatioTarget(pinchTarget, pinchStartScale, d/pinchStartDist);
      drawPreview();
    }
  }, { passive:false });

  canvas.addEventListener('touchend', e=>{
    pinchTarget = null;
    pinchStartDist = null;
  });
}
function touchDist(touches){
  const dx = touches[0].clientX-touches[1].clientX, dy = touches[0].clientY-touches[1].clientY;
  return Math.sqrt(dx*dx+dy*dy);
}

/* ── DRAWING ──────────────────────────────────── */
// clipElements=false (live editor only — see drawPreview) skips the circular
// clip for the foreground pass so a sticker/text/etc dragged out toward the
// canvas edge stays visible instead of silently vanishing, making it easy to
// grab and pull back. Background stays clipped either way (it's the only
// layer that's structurally fixed at the back — border is now a normal
// reorderable layer, see drawForegroundElements). Exports and the
// submit-step review thumbnail always keep the default (clipped) so the
// finished-look preview is accurate.
function drawDesignLayer(ctx, sizePx, opts){
  const clipElements = !opts || opts.clipElements !== false;
  const artboardPx = sizePx; // canvas itself represents the full artboard (incl bleed)
  ctx.clearRect(0,0,sizePx,sizePx);

  // Everything printable is physically round — clip the design layer
  // (background, and — when clipElements — everything else too) to the
  // pin's circular shape.
  ctx.save();
  ctx.beginPath();
  ctx.arc(artboardPx/2, artboardPx/2, artboardPx/2, 0, Math.PI*2);
  ctx.clip();

  drawBackground(ctx, artboardPx);  // the one truly fixed back-most layer
  if (clipElements) drawForegroundElements(ctx, artboardPx);

  ctx.restore();
  if (!clipElements) drawForegroundElements(ctx, artboardPx);
}

// Everything except the background draws in the user-defined stacking order
// (state.layerOrder, back-to-front), managed via the Layers tab — border
// included, same as any other element.
function drawForegroundElements(ctx, artboardPx){
  state.layerOrder.forEach(d => {
    if (d.kind==='character') drawOneCharacter(ctx, artboardPx);
    else if (d.kind==='border') drawBorder(ctx, artboardPx);
    else if (d.kind==='sticker' || d.kind==='shape' || d.kind==='wordart' || d.kind==='letter') drawOnePlaced(ctx, artboardPx, placedArray(d.kind).find(x=>x.id===d.id));
    else if (d.kind==='text') drawOneTextLine(ctx, artboardPx, state.textLines.find(t=>t.id===d.id));
  });
}

function drawBackground(ctx, artboardPx){
  const imageActive = state.bg.imageOn && state.bg.img;

  // Photo and color background are mutually exclusive — an active photo
  // always draws over a plain white base, never a color/gradient layer.
  if (!imageActive && state.bg.colorOn && state.bg.color){
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
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,artboardPx,artboardPx);
  }

  if (imageActive){
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
  drawPlacedImage(ctx, artboardPx, state.border.img, state.border.xFrac||0, state.border.yFrac||0, cutFrac, state.border.rotation||0);
}

function drawOneCharacter(ctx, artboardPx){
  if (!state.character || !state.character.img) return;
  const c = state.character;
  drawPlacedImage(ctx, artboardPx, c.img, c.xFrac||0, c.yFrac||0, CHARACTER_BASE_R*2*c.scale, c.rotation||0);
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

// Border covers nearly the whole pin, so its drag range is deliberately
// tiny — same spirit as its 0.7-1.3 scale-tweak range above: this is for
// recentering an off-center or non-perfectly-circular border asset, not for
// moving it around like a sticker.
function clampBorderOffset(){
  if (!state.border) return;
  const cutFrac = state.size / state.paperSize / 2;
  const maxOffset = cutFrac * 0.15;
  const dist = Math.hypot(state.border.xFrac||0, state.border.yFrac||0);
  if (dist > maxOffset && dist > 0){
    const ratio = maxOffset / dist;
    state.border.xFrac *= ratio; state.border.yFrac *= ratio;
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

/* ── SELECTION RING — sticker/shape/wordart/letter/text/border. No
   draggable handles anymore: resize is pinch/wheel (see resizeTarget), and
   rotate is the vertical rail (see updateRotateRail) — this is purely a
   "here's what's selected" outline. ── */
function elementRadiusFrac(el, kind){
  if (kind==='character') return CHARACTER_BASE_R * el.scale;
  if (kind==='sticker' || kind==='shape' || kind==='wordart' || kind==='letter') return STICKER_BASE_R * el.scale;
  if (kind==='text')      return textFootprintFrac(el);
  if (kind==='border')    return (state.size/state.paperSize/2) * (el.scale||1);
  return 0.14;
}
function selectedElementAndKind(){
  if (!state.selected) return {};
  const kind = state.selected.kind;
  const el = kind==='character' ? state.character
    : kind==='border' ? state.border
    : (kind==='sticker' || kind==='shape' || kind==='wordart' || kind==='letter') ? placedArray(kind).find(x=>x.id===state.selected.id)
    : kind==='text' ? state.textLines.find(t=>t.id===state.selected.id)
    : null;
  return { el, kind };
}
function drawSelectionHandles(ctx, artboardPx){
  const { el, kind } = selectedElementAndKind();
  const ringKinds = ['sticker','shape','wordart','letter','text','border'];
  if (!el || !ringKinds.includes(kind)) return;
  const r = elementRadiusFrac(el, kind) * artboardPx;
  const cx = artboardPx/2 + el.xFrac*artboardPx, cy = artboardPx/2 + el.yFrac*artboardPx;

  ctx.save();
  ctx.strokeStyle = el.locked ? '#B08D57' : '#8FAE7C';
  ctx.lineWidth = 2; ctx.setLineDash([5,4]);
  ctx.beginPath(); ctx.arc(cx, cy, r*1.15, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

/* ── ROTATE RAIL — a persistent vertical slider fixed to the right of the
   pin, shown whenever a rotatable element is selected. Replaces every
   per-kind Rotate dock tool and the old on-canvas rotate handle. Above the
   slider: an icon of whatever's selected (so it's unambiguous which object
   is about to spin), and above that, a lock toggle — locked elements can
   still be selected (to reach this button and unlock them) but the slider
   itself is disabled and setSelectedRotation() no-ops until unlocked.
   Called from drawPreview() so it never needs its own call sites scattered
   through every mutation function. ── */
function updateRotateRail(){
  const rail = document.getElementById('rotateRail');
  if (!rail) return;
  const { el, kind } = selectedElementAndKind();
  const rotatable = ['sticker','shape','wordart','letter','text','character','border'];
  if (!el || !rotatable.includes(kind)){
    rail.style.display = 'none';
    return;
  }
  rail.style.display = '';
  const deg = Math.round((el.rotation||0)*180/Math.PI);
  const slider = document.getElementById('rotateSlider');
  if (slider && document.activeElement !== slider){ slider.value = deg; }
  if (slider) slider.disabled = !!el.locked;
  const thumb = document.getElementById('rotateThumb');
  if (thumb) thumb.innerHTML = kind==='text' ? ICON_TEXT : (el.img ? `<img src="${el.img.src}" alt="">` : '');
}
window.updateRotateRail = updateRotateRail;

function setSelectedRotation(deg){
  const { el, kind } = selectedElementAndKind();
  if (!el || !kind || kind==='background' || el.locked) return;
  el.rotation = (+deg) * Math.PI/180;
  drawPreview();
}
window.setSelectedRotation = setSelectedRotation;

// Mirrors updateRotateRail — same selectedElementAndKind()-driven show/hide
// and locked-disables-the-slider behavior, just for size instead of angle.
// Border keeps its own tiny range (see applyResizeRatioTarget); everything
// else gets the full RESIZE_SCALE_MIN..MAX span.
function updateResizeRail(){
  const rail = document.getElementById('resizeRail');
  if (!rail) return;
  const { el, kind } = selectedElementAndKind();
  const resizableKinds = ['sticker','shape','wordart','letter','text','character','border'];
  if (!el || !resizableKinds.includes(kind)){
    rail.style.display = 'none';
    return;
  }
  rail.style.display = '';
  const range = kind==='border' ? { min:70, max:130 } : { min:RESIZE_SCALE_MIN*100, max:RESIZE_SCALE_MAX*100 };
  const slider = document.getElementById('resizeSlider');
  if (slider){
    slider.min = range.min; slider.max = range.max;
    if (document.activeElement !== slider){
      const pct = Math.round(resizeStartScaleFor(el, kind) * 100);
      slider.value = Math.max(range.min, Math.min(range.max, pct));
    }
    slider.disabled = !!el.locked;
  }
}
window.updateResizeRail = updateResizeRail;

function setSelectedScalePercent(pct){
  const { el, kind } = selectedElementAndKind();
  if (!el || !kind || kind==='background' || el.locked) return;
  applyResizeRatioTarget({ el, kind }, 1, (+pct)/100);
  drawPreview();
}
window.setSelectedScalePercent = setSelectedScalePercent;

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
  ctx.fillStyle = currentTheme()==='dark' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.8)';
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

function drawWatermark(ctx, sizePx, opacity){
  opacity = opacity==null ? 1 : opacity;
  ctx.save();
  ctx.font = 'bold 13px Nunito, sans-serif';
  ctx.fillStyle = `rgba(255,255,255,${0.22*opacity})`;
  ctx.strokeStyle = `rgba(0,0,0,${0.15*opacity})`;
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
  updateRotateRail();
  updateResizeRail();
}

// True if any character/sticker/shape/wordart/text currently extends past
// the cut line — center position is clamped (see clampElementToCutLine),
// but resizing after the fact can still push the edge past it.
// Every element currently hanging past the cut line, as { kind, el } pairs
// — used both to decide whether to show the warning icon at all, and to
// list which specific objects it's complaining about in the popup.
function overlappingElements(){
  if (!state.paperSize) return [];
  const cutFrac = state.size / state.paperSize / 2;
  const overlaps = (el, kind) => {
    if (!el) return false;
    const dist = Math.hypot(el.xFrac||0, el.yFrac||0);
    return dist + elementRadiusFrac(el, kind) > cutFrac;
  };
  const list = [];
  if (overlaps(state.character, 'character')) list.push({ kind:'character', el: state.character });
  if (overlaps(state.border, 'border')) list.push({ kind:'border', el: state.border });
  state.textLines.forEach(t => { if (overlaps(t, 'text')) list.push({ kind:'text', el:t }); });
  ['sticker','shape','wordart','letter'].forEach(kind => {
    placedArray(kind).forEach(el => { if (overlaps(el, kind)) list.push({ kind, el }); });
  });
  return list;
}
function anyElementOverlapsCutLine(){ return overlappingElements().length > 0; }

// The warning icon itself stays hidden until something actually overlaps —
// see the file note on bindCanvasInteractions for why border/character can
// overlap now too (both are freely repositionable).
function updateCutlineWarning(){
  const btn = document.getElementById('cutlineWarningBtn');
  if (!btn) return;
  btn.style.display = anyElementOverlapsCutLine() ? '' : 'none';
}

function overlapItemThumb(item){
  if (item.kind==='text') return ICON_TEXT;
  if (item.el.img) return `<img src="${item.el.img.src}" alt="">`;
  return item.kind==='character' ? ICON_CHARACTER : ICON_BORDER;
}

function openInfoModal(){ document.getElementById('infoModalOverlay').classList.add('show'); }
function closeInfoModal(){ document.getElementById('infoModalOverlay').classList.remove('show'); }
window.openInfoModal = openInfoModal;
window.closeInfoModal = closeInfoModal;

function openWarningModal(){
  const list = overlappingElements();
  document.getElementById('warningOverlapList').innerHTML = list.map(item =>
    `<span class="cr-warning-overlap-thumb" title="${escHtml(layerLabelFor(item.kind==='character'?{kind:'character'}:item.kind==='border'?{kind:'border'}:{kind:item.kind,id:item.el.id}))}">${overlapItemThumb(item)}</span>`
  ).join('');
  document.getElementById('warningModalOverlay').classList.add('show');
}
function closeWarningModal(){ document.getElementById('warningModalOverlay').classList.remove('show'); }
window.openWarningModal = openWarningModal;
window.closeWarningModal = closeWarningModal;

// Watermarked but WITHOUT guides/handles — those are live-editing chrome and
// shouldn't appear in the submit-step review thumbnail or anywhere else the
// design is just being looked at rather than edited.
function renderWatermarkedPreview(canvas){
  const ctx = canvas.getContext('2d');
  drawDesignLayer(ctx, canvas.width);
  drawWatermark(ctx, canvas.width);
}

// Same watermarked render, but cropped to just the FINISHED pin (the cut
// line), not the full paper/bleed artboard — this is what the customer
// actually receives once it's trimmed, so it's what the 3D preview shows.
// The watermark stays on (just lighter by default) rather than being
// removable — a fully clean canvas rendered to the page is something
// devtools can always pull the pixels out of, so this is the one render
// path where "lighter" and "still there" both matter. See openPinPreview.
function renderFinishedPinFace(canvas, opts){
  const watermarkOpacity = (opts && opts.watermarkOpacity!=null) ? opts.watermarkOpacity : 1;
  const px = canvas.width;
  const off = document.createElement('canvas');
  off.width = px; off.height = px;
  const offCtx = off.getContext('2d');
  drawDesignLayer(offCtx, px);
  drawWatermark(offCtx, px, watermarkOpacity);

  const cutFrac = state.size / state.paperSize;
  const cutPx = px * cutFrac;
  const srcOffset = (px - cutPx) / 2;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, px, px);
  ctx.save();
  ctx.beginPath();
  ctx.arc(px/2, px/2, px/2, 0, Math.PI*2);
  ctx.clip();
  ctx.drawImage(off, srcOffset, srcOffset, cutPx, cutPx, 0, 0, px, px);
  ctx.restore();
}

// Bulges the design toward the viewer like it's printed on a domed acrylic
// pin surface, instead of just a flat circle with a lighting overlay on
// top. Destination pixels near the center sample source pixels from
// CLOSER to the center too (power>1), so a small patch of the original
// center gets stretched to fill more space — that's what reads as the
// middle pushing out at the viewer, rim staying anchored (r=1 always
// maps to r=1 either way). power<1 is the opposite: it pulls source
// pixels from further out toward the center, which reads as a funnel
// sucking the image inward instead of a dome bulging outward — a
// one-time pixel remap, done once when the preview opens, not per frame.
function applyDomeWarp(canvas, strength){
  strength = strength==null ? 0.22 : strength;
  const px = canvas.width;
  const ctx = canvas.getContext('2d');
  const src = ctx.getImageData(0, 0, px, px);
  const dst = ctx.createImageData(px, px);
  const s = src.data, d = dst.data;
  const cx = px/2, cy = px/2, R = px/2;
  const power = 1 + strength;
  for (let y=0; y<px; y++){
    for (let x=0; x<px; x++){
      const nx = (x-cx)/R, ny = (y-cy)/R;
      const r = Math.sqrt(nx*nx + ny*ny);
      const di = (y*px+x)*4;
      if (r > 1){ d[di+3] = 0; continue; }
      const scale = r===0 ? 1 : Math.pow(r, power)/r;
      const sx = Math.round(cx + nx*scale*R);
      const sy = Math.round(cy + ny*scale*R);
      if (sx<0 || sx>=px || sy<0 || sy>=px){ d[di+3] = 0; continue; }
      const si = (sy*px+sx)*4;
      d[di]=s[si]; d[di+1]=s[si+1]; d[di+2]=s[si+2]; d[di+3]=s[si+3];
    }
  }
  ctx.putImageData(dst, 0, 0);
}

/* ── 3D PRINT PREVIEW — CSS-3D tilt, no WebGL/3D library needed. The pin
   element itself carries the rotateX/rotateY transform; the shine overlay's
   gradient center shifts opposite the tilt so the highlight reads as a
   fixed light source reacting to the surface angle, not painted-on. ── */
const PIN3D_REST = { x:14, y:-10 };
const PIN3D_RADIUS = 105; // half of .cr-pin3d's 210px width
const PIN3D_DEPTH = 18;   // physical "thickness" — how far the face sits in front of the back
let _pin3dRot = { ...PIN3D_REST };
let _pin3dBound = false;

function shadeColor(c, amt){
  const f = v => Math.max(0, Math.min(255, Math.round(amt>0 ? v+(255-v)*amt : v*(1+amt))));
  return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
}

// Averages pixel color from a ring near the outer rim of the rendered pin
// face, so the edge wall reads as the print's own colors curving around
// the side rather than an unrelated metal rim.
function samplePinEdgeColor(canvas){
  const px = canvas.width;
  const ctx = canvas.getContext('2d');
  const cx = px/2, cy = px/2, sampleR = px*0.47;
  let r=0,g=0,b=0,count=0;
  const N = 24;
  for (let i=0; i<N; i++){
    const a = i*360/N * Math.PI/180;
    const x = Math.round(cx + sampleR*Math.cos(a)), y = Math.round(cy + sampleR*Math.sin(a));
    if (x<0||x>=px||y<0||y>=px) continue;
    const d = ctx.getImageData(x,y,1,1).data;
    if (d[3] < 10) continue; // skip transparent samples
    r+=d[0]; g+=d[1]; b+=d[2]; count++;
  }
  return count ? { r:Math.round(r/count), g:Math.round(g/count), b:Math.round(b/count) } : { r:210,g:212,b:216 };
}

// Classic CSS-3D "barrel": N thin flat strips arranged radially around the
// Z axis — the SAME axis the front/back faces are perpendicular to, so the
// wall actually wraps around the pin's rim instead of swinging out toward
// the camera. Per strip: rotateZ(angle+90deg) orients it tangent to the
// circle at that angle, rotateX(90deg) tips its "height" dimension to run
// along Z (the depth direction) instead of Y, and translateZ(radius) then
// pushes it out along its own (now-radial) local Z axis to the rim.
// A vertical light/dark gradient per strip fakes a rounded bevel instead
// of a hard flat-walled "coaster" edge.
function buildPin3dEdgeWall(edgeColor){
  const wall = document.getElementById('pinPreviewEdgeWall');
  if (!wall) return;
  const N = 48;
  const stripW = Math.ceil((2*Math.PI*PIN3D_RADIUS)/N) + 1; // +1 to avoid seams between strips
  const light = shadeColor(edgeColor, 0.3);
  const dark = shadeColor(edgeColor, -0.5);
  const bg = `linear-gradient(180deg, ${dark}, ${light} 45%, ${dark})`;
  let html = '';
  for (let i=0; i<N; i++){
    const angle = i*360/N;
    // Crude directional shading: strips facing the default light angle
    // read lighter, strips facing away read darker, like a lit cylinder.
    const shade = (0.7 + 0.3*Math.cos(angle*Math.PI/180)).toFixed(2);
    const t = `rotateZ(${angle+90}deg) rotateX(90deg) translateZ(${PIN3D_RADIUS}px)`;
    html += `<div class="cr-pin3d-edge-strip" style="width:${stripW}px;margin-left:${-stripW/2}px;transform:${t};background:${bg};filter:brightness(${shade})"></div>`;
  }
  wall.innerHTML = html;
}

function openPinPreview(){
  const canvas = document.getElementById('pinPreviewCanvas');
  canvas.width = 500; canvas.height = 500;
  renderFinishedPinFace(canvas, { watermarkOpacity: 0.4 });
  applyDomeWarp(canvas, 0.22);
  document.getElementById('pinPreviewTitle').textContent =
    state.product ? `${state.product.label} · ${state.size}mm Preview` : 'Print Preview';
  buildPin3dEdgeWall(samplePinEdgeColor(canvas));
  _pin3dRot = { ...PIN3D_REST };
  applyPin3dTransform();
  document.getElementById('pinPreviewOverlay').classList.add('show');
  initPin3dDrag();
}
window.openPinPreview = openPinPreview;

function closePinPreview(){
  document.getElementById('pinPreviewOverlay').classList.remove('show');
}
window.closePinPreview = closePinPreview;

function applyPin3dTransform(){
  const pin = document.getElementById('pinPreviewPin');
  const shine = document.getElementById('pinPreviewShine');
  if (!pin || !shine) return;
  pin.style.transform = `rotateX(${_pin3dRot.x}deg) rotateY(${_pin3dRot.y}deg)`;
  // Specular highlight + a soft shadow on the opposite side of the surface,
  // both shifted with the tilt so they read as a fixed light source
  // reacting to the surface angle rather than painted on. The uniform rim
  // darkening that sells the base dome shape lives in .cr-pin3d-face's own
  // inset box-shadow — see the comment there for why this ALSO needs its
  // own opposite-side shadow (not just a highlight) to stay visible on a
  // still-blank white pin.
  const hx = 50 - _pin3dRot.y*1.3, hy = 50 - _pin3dRot.x*1.3;
  const sx = 50 + _pin3dRot.y*1.3, sy = 50 + _pin3dRot.x*1.3;
  shine.style.background =
    `radial-gradient(circle at ${hx}% ${hy}%, rgba(255,255,255,0.95), rgba(255,255,255,0.55) 14%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0) 48%),` +
    `radial-gradient(circle at ${sx}% ${sy}%, rgba(0,0,0,0.32), rgba(0,0,0,0) 55%)`;
}

function initPin3dDrag(){
  const stage = document.getElementById('pinPreviewStage');
  const pin = document.getElementById('pinPreviewPin');
  if (_pin3dBound) return; // listeners only need wiring once, ever
  _pin3dBound = true;

  let start = null;
  const clampRot = (v, min, max) => Math.max(min, Math.min(max, v));

  function onDown(e){
    const p = e.touches ? e.touches[0] : e;
    start = { x:p.clientX, y:p.clientY, rot:{ ..._pin3dRot } };
    pin.classList.add('dragging');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive:false });
    window.addEventListener('touchend', onUp);
  }
  function onMove(e){
    if (!start) return;
    if (e.cancelable) e.preventDefault();
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - start.x, dy = p.clientY - start.y;
    _pin3dRot.y = clampRot(start.rot.y + dx*0.35, -35, 35);
    _pin3dRot.x = clampRot(start.rot.x - dy*0.35, -8, 32);
    applyPin3dTransform();
  }
  function onUp(){
    start = null;
    pin.classList.remove('dragging');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onUp);
  }
  stage.addEventListener('mousedown', onDown);
  stage.addEventListener('touchstart', onDown, { passive:true });
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
   only. See assets/pins/README.md.

   Products with an `assetGroup` (see PRODUCTS above) get their OWN isolated
   set of folders — assets/pins/<assetGroup>/<category>/ — instead of pulling
   from the shared pool every other product uses. Rather than rewriting every
   place that reads STICKER_PRESETS/BORDER_PRESETS/etc. directly, we fetch
   every group up front into a cache and, on product selection, clear+refill
   those same shared arrays with whichever group applies — so every existing
   consumer keeps working unchanged, it just sees different contents. ── */
const PINS_RAW_BASE = 'https://raw.githubusercontent.com/campingchairph/morphii/main/assets/pins/';
// GitHub's per-category Contents API (one request per folder) blew through the
// 60-req/hr unauthenticated rate limit in minutes once there were 4 asset
// groups x 8 categories = 32 requests on every single page load — the limit
// is shared by IP across everyone on the same network, so a couple of reloads
// could lock out the whole office. The recursive Git Trees API lists the
// ENTIRE repo in ONE request; we filter it down to assets/pins/* client-side
// instead. Cached in localStorage for PINS_TREE_CACHE_TTL so repeat visits/
// reloads from the same browser cost zero extra requests until it's stale.
const PINS_TREE_URL = 'https://api.github.com/repos/campingchairph/morphii/git/trees/main?recursive=1';
const PINS_TREE_CACHE_KEY = 'morphii_pins_asset_tree_v1';
const PINS_TREE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const ASSET_CATEGORIES = ['stickers','shapes','holders','texts','borders','background','characters','letters'];
// category folder -> which key of a per-group asset set it feeds (holders shares Shapes' gallery)
const CATEGORY_TO_SET_KEY = {
  stickers:'stickers', shapes:'shapes', holders:'shapes', texts:'wordart',
  borders:'borders', background:'background', characters:'characters', letters:'letters',
};
// Letters assets are named "<groupNumber>_<LETTER>-<variant>.ext" (e.g.
// 1_A-01.png, 1_B-01.png, 2_A-01.png...) — each number is a distinct design;
// the trailing -variant number is captured but not used for anything (any
// digits work, not just "01"). The underscore accepts one-or-more (some
// uploaded files use "2__A-01.png" with a double underscore) so a stray
// extra underscore doesn't silently drop a file from the picker.
// buildLetterGroups() below turns the flat file list into
// { groupId, thumbSrc (always the "A"), letters }.
const LETTER_FILENAME_RE = /^(\d+)_+([A-Za-z])-\d+\.[^.]+$/i;
const NEW_PRODUCT_ASSET_GROUPS = ['election','ph-souvenir','wedding'];
const ASSET_GROUP_CACHE = {}; // groupId -> { stickers, shapes, wordart, borders, background, characters, letters }
let LETTER_GROUPS = []; // rebuilt in applyAssetGroup() — [{ groupId, thumbSrc, letters:{A:url,...} }]

function assetLabelFromFilename(name){
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}
function emptyAssetSet(){ return { stickers:[], shapes:[], wordart:[], borders:[], background:[], characters:[], letters:[] }; }

// Turns a flat list of { label, src, name } letter-asset entries into grouped
// { groupId, thumbSrc, letters:{A:url,...} } records, sorted by group number.
// Files that don't match "<number>_<LETTER>.ext" are silently skipped.
function buildLetterGroups(flatList){
  const byGroup = {};
  flatList.forEach(it => {
    const m = LETTER_FILENAME_RE.exec(it.name || '');
    if (!m) return;
    const groupId = m[1];
    const letter = m[2].toUpperCase();
    if (!byGroup[groupId]) byGroup[groupId] = { groupId, letters:{} };
    byGroup[groupId].letters[letter] = it.src;
  });
  return Object.keys(byGroup)
    .sort((a,b) => Number(a) - Number(b))
    .map(groupId => {
      const g = byGroup[groupId];
      return { groupId, thumbSrc: g.letters['A'] || Object.values(g.letters)[0], letters: g.letters };
    })
    .filter(g => g.thumbSrc);
}
function currentAssetGroup(){ return (state.product && state.product.assetGroup) || 'shared'; }

// One request for the whole repo tree, cached in localStorage — see the
// comment above PINS_TREE_URL for why this replaced one-fetch-per-folder.
async function fetchPinsAssetTree(){
  try {
    const cached = JSON.parse(localStorage.getItem(PINS_TREE_CACHE_KEY) || 'null');
    if (cached && Array.isArray(cached.paths) && Date.now() - cached.t < PINS_TREE_CACHE_TTL) return cached.paths;
  } catch(e){ /* corrupt cache entry — just refetch */ }
  const res = await fetch(PINS_TREE_URL);
  if (!res.ok) throw new Error('GitHub tree fetch failed: ' + res.status);
  const data = await res.json();
  const paths = (data.tree || [])
    .filter(it => it.type==='blob' && it.path.startsWith('assets/pins/'))
    .map(it => it.path);
  try { localStorage.setItem(PINS_TREE_CACHE_KEY, JSON.stringify({ t: Date.now(), paths })); } catch(e){ /* storage full/disabled — just skip caching */ }
  return paths;
}

// basePath is '' for the shared/global folders (assets/pins/<category>/,
// unchanged from before groups existed) or '<groupId>/' for an isolated
// product's own folders (assets/pins/<groupId>/<category>/). Builds a group's
// asset set entirely client-side from the already-fetched repo tree — no
// network calls here.
function buildAssetSetFromTree(treePaths, basePath, overrides){
  const set = emptyAssetSet();
  ASSET_CATEGORIES.forEach(cat => {
    const prefix = 'assets/pins/' + basePath + cat + '/';
    const key = CATEGORY_TO_SET_KEY[cat];
    treePaths.forEach(path => {
      if (!path.startsWith(prefix)) return;
      const name = path.slice(prefix.length);
      if (name.includes('/') || !/\.(png|jpe?g|webp|gif)$/i.test(name)) return; // skip nested dirs / non-images
      const url = PINS_RAW_BASE + basePath + cat + '/' + name;
      set[key].push({ label: overrides[url] || assetLabelFromFilename(name), src: url, name });
    });
  });
  return set;
}

// Clears and refills the shared preset arrays from whichever group's cached
// data applies — everything that reads STICKER_PRESETS etc. directly just
// sees the swap, no other code needs to know groups exist.
function applyAssetGroup(groupId){
  const set = ASSET_GROUP_CACHE[groupId] || emptyAssetSet();
  STICKER_PRESETS.length = 0;    STICKER_PRESETS.push(...set.stickers);
  SHAPE_PRESETS.length = 0;      SHAPE_PRESETS.push(...set.shapes);
  WORDART_PRESETS.length = 0;    WORDART_PRESETS.push(...set.wordart);
  BORDER_PRESETS.length = 0;     BORDER_PRESETS.push(...set.borders);
  BACKGROUND_PRESETS.length = 0; BACKGROUND_PRESETS.push(...set.background);
  CHARACTER_PRESETS.length = 0;  CHARACTER_PRESETS.push(...set.characters);
  LETTER_GROUPS = buildLetterGroups(set.letters);
}

async function loadPinAssetManifest(){
  let overrides = {};
  try { overrides = await getAssetLabelOverrides(); } catch(e){}
  let treePaths = [];
  try { treePaths = await fetchPinsAssetTree(); }
  catch(e){ /* offline/rate-limited — every category just stays empty, same as before */ }
  const groups = ['shared', ...NEW_PRODUCT_ASSET_GROUPS];
  groups.forEach(g => { ASSET_GROUP_CACHE[g] = buildAssetSetFromTree(treePaths, g==='shared' ? '' : g+'/', overrides); });
  applyAssetGroup(currentAssetGroup());
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
  ['sticker','shape','wordart','letter'].forEach(kind => {
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
  updateThemeToggleIcon();
  renderProductGrid();
  loadPinAssetManifest();
  loadCustomFonts();
  loadCatalogConfig();
  loadPinTemplates();
});

// This page has no login UI of its own — an admin who already signed in on
// index.html or orders-admin.html (same browser) is picked up automatically
// via Firebase Auth's persisted session, which is all "Save as Template"
// needs: it's a design-step button, not a separate admin area.
let currentUserIsAdmin = false;
if (typeof AUTH !== 'undefined' && AUTH){
  AUTH.onAuthStateChanged(user => {
    currentUserIsAdmin = typeof isAdmin === 'function' && isAdmin(user);
    updateAdminUI();
  });
}
function updateAdminUI(){
  const btn = document.getElementById('saveTemplateBtn');
  if (btn) btn.style.display = currentUserIsAdmin ? '' : 'none';
  const templateStep = document.getElementById('step-pinTemplates');
  if (templateStep && templateStep.classList.contains('active')) renderPinTemplateGrid();
}

// Keeps the spinning border ring's size correct if the viewport (and so
// the pin's rendered size) changes — e.g. rotating a phone.
window.addEventListener('resize', ()=>{ updateCanvasBorderRing(); });

// Lets the admin toggle product types and sizes on/off (e.g. temporarily
// out of stock) from orders-admin.html without a code deploy. Any id not
// present in the Firestore doc just keeps its hardcoded default `enabled`
// value above, so this is purely additive/overriding.
const CATALOG_CACHE_KEY = 'morphii_catalog_cache_v1';

// A saved override can be the old boolean shape (true/false, from before
// "hidden" existed) or the new tri-state string — normalize either into
// 'enabled'/'disabled'/'hidden'. `v===undefined` means no override was ever
// saved for this id, so it keeps its hardcoded default.
function normalizeCatalogState(v, hardcodedDefault){
  if (v === true) return 'enabled';
  if (v === false) return 'disabled';
  if (v === 'enabled' || v === 'disabled' || v === 'hidden') return v;
  return hardcodedDefault;
}
function applyCatalogOverrides(cfg){
  PRODUCTS.forEach(p => { p.catalogState = normalizeCatalogState((cfg.products||{})[p.id], p.catalogState); });
  SIZES.forEach(s => { s.catalogState = normalizeCatalogState((cfg.sizes||{})[s.mm], s.catalogState); });
}

// Synchronous — applied before the very first render so returning
// customers see the correct product/size availability immediately instead
// of the hardcoded defaults flashing briefly while Firestore responds. If
// there's no cache yet (first-ever visit on this device), catalogResolved
// stays false and renderProductGrid/renderSizeGrid show a loading skeleton
// instead of guessing — see the note on catalogResolved above.
function applyCachedCatalogConfig(){
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (raw){ applyCatalogOverrides(JSON.parse(raw)); catalogResolved = true; }
  } catch(e){ /* corrupt cache or storage unavailable — just skip it */ }
}

async function loadCatalogConfig(){
  if (typeof getCatalogConfig !== 'function') return; // firebase-config.js not loaded/configured
  const cfg = await getCatalogConfig();
  applyCatalogOverrides(cfg);
  catalogResolved = true;
  try { localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(cfg)); } catch(e){ /* storage full/unavailable — not critical */ }
  renderProductGrid();
  if (state.product) renderSizeGrid();
}
