/* Button pin MINIMUM ORDER: one A4 cut lengthwise into a strip, every circle is a pin.
   The customer completes every circle (one design duplicated into all of them, or a different
   design per circle) before checking out. Loaded after create.js and works on top of it:
   it reuses the template snapshot functions to save / restore a design per circle and wraps
   goStep / submitOrder / sendConfirmationEmail / renderSubmitSummary. */
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const H = 297;                                  // strip length (A4 long side), mm
  let CFG = JSON.parse(JSON.stringify(DEFAULT_PIN_STRIPS));
  let ov = null, mode = 'edit', pvSize = 58, prompt = false;

  const sizeInfo = mm => SIZES.find(s => s.mm === mm);
  const cfgFor = mm => CFG[mm] || DEFAULT_PIN_STRIPS[mm] || { count: 4, layout: 'column', width: 84 };
  const enabledSizes = () => SIZES.filter(s => s.catalogState === 'enabled').map(s => s.mm);

  // circle centres (mm) on the strip, for a pin size
  function geometry(mm) {
    const c = cfgFor(mm), W = c.width, d = (sizeInfo(mm) || { paperMM: mm * 1.25 }).paperMM, n = c.count, pts = [];
    if (c.layout === 'grid2') {
      const rows = Math.ceil(n / 2), g = (H - rows * d) / (rows + 1);
      for (let i = 0; i < n; i++) { const r = Math.floor(i / 2); pts.push([i % 2 ? W * 0.75 : W * 0.25, g * (r + 1) + d * r + d / 2]); }
    } else if (c.layout === 'zigzag') {
      const g0 = 6, step = n > 1 ? (H - d - 2 * g0) / (n - 1) : 0;
      for (let i = 0; i < n; i++) pts.push([i % 2 ? W * 0.7 : W * 0.3, g0 + d / 2 + step * i]);
    } else {
      const g = (H - n * d) / (n + 1);
      for (let i = 0; i < n; i++) pts.push([W / 2, g * (i + 1) + d * i + d / 2]);
    }
    return { W, d, pts, count: n, layout: c.layout };
  }

  /* ── strip state (lives on the pin builder's own `state`) ── */
  function ensureStrip() {
    if (!state.size) return null;
    const c = cfgFor(state.size);
    if (!state.strip || state.strip.size !== state.size || state.strip.count !== c.count) {
      state.strip = { size: state.size, count: c.count, layout: c.layout, slots: Array(c.count).fill(null), active: 0 };
    }
    return state.strip;
  }
  const doneCount = () => (state.strip ? state.strip.slots.filter(Boolean).length : 0);
  const complete = () => !!state.strip && state.strip.slots.every(Boolean);
  // small on-screen preview of the design, watermarked like the rest of the pin previews
  function watermarkedThumb() {
    const px = 300, c = document.createElement('canvas'); c.width = c.height = px;
    const x = c.getContext('2d'); drawDesignLayer(x, px);
    x.save(); x.translate(px / 2, px / 2); x.rotate(-Math.PI / 6);
    x.font = '800 20px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,255,255,0.5)'; x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 2;
    for (let y = -px; y <= px; y += 52) for (let xx = -px; xx <= px; xx += 118) {
      const ox = ((y / 52) % 2 ? 59 : 0); x.strokeText('MORPHII', xx + ox, y); x.fillText('MORPHII', xx + ox, y);
    }
    x.restore();
    return c.toDataURL('image/jpeg', 0.82);
  }
  // snapshot the design on screen into the active circle
  function saveActiveSlot() {
    const st = state.strip; if (!st) return;
    if (!hasDesignContent()) { st.slots[st.active] = null; return; }
    st.slots[st.active] = { snap: serializeCurrentDesign(), thumb: watermarkedThumb(), png: compositeCleanDesign() };
  }
  // the design step shows a paste explainer every time it opens — not on every circle switch
  async function quietly(fn) {
    const orig = window.showPasteHint; window.showPasteHint = () => {};
    try { return await fn(); } finally { window.showPasteHint = orig; }
  }

  // circles as positioned HTML; `interactive` adds the pen / duplicate buttons
  function stripCircles(g, st, interactive, flagEmpty) {
    return g.pts.map(([x, y], i) => {
      const style = 'left:' + ((x - g.d / 2) / g.W * 100) + '%;top:' + ((y - g.d / 2) / H * 100) + '%;width:' + (g.d / g.W * 100) + '%;';
      const slot = st && st.slots[i];
      if (!st) return '<div class="cs-c pv" style="' + style + '"><span>' + (i + 1) + '</span></div>';
      const act = interactive && st.active === i;
      return '<div class="cs-c ' + (slot ? 'full' : 'empty' + (flagEmpty ? ' need' : '')) + (act ? ' act' : '') + '" data-i="' + i + '" style="' + style + (slot ? 'background-image:url(' + slot.thumb + ');' : '') + '">' +
        (!interactive ? '' : slot
          ? '<button class="cs-b cs-edit" data-a="edit" aria-label="Edit pin ' + (i + 1) + '">✎</button><button class="cs-b cs-dup" data-a="dup" aria-label="Fill every empty circle with this design" title="Duplicate to every empty circle">⧉</button>'
          : '<button class="cs-new" data-a="edit" aria-label="Design pin ' + (i + 1) + '"><b>✎</b><small>Design</small></button>') +
        '</div>';
    }).join('');
  }

  /* ── the window ── */
  function build() {
    ov = document.createElement('div');
    ov.className = 'cs-ov'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML =
      '<div class="cs-head"><button class="cs-x" id="csClose" aria-label="Close">✕</button><div class="cs-title" id="csTitle"></div><span></span></div>' +
      '<div class="cs-tabs" id="csTabs"></div>' +
      '<div class="cs-body"><div class="cs-stripwrap"><div class="cs-strip" id="csStrip"></div></div>' +
      '<div class="cs-side"><div class="cs-info" id="csInfo"></div><div class="cs-warn" id="csWarn" hidden></div>' +
      '<div class="cs-prog" id="csProgWrap"><div class="cs-bar"><i id="csBar"></i></div><span id="csProg"></span></div>' +
      '<div class="cs-how" id="csHow"></div></div></div>' +
      '<div class="cs-foot"><button class="cs-back" id="csBack" hidden>← Back to Edit</button><button class="cs-go" id="csGo"></button></div>';
    document.body.appendChild(ov);
    $('csClose').addEventListener('click', closeOv);
    $('csTabs').addEventListener('click', e => { const b = e.target.closest('[data-mm]'); if (b) { pvSize = +b.dataset.mm; render(); } });
    $('csStrip').addEventListener('click', onStripClick);
    $('csBack').addEventListener('click', closeOv);
    $('csGo').addEventListener('click', () => {
      if (mode === 'confirm') { closeOv(); window.confirmSubmitDesign(); return; }
      if (mode === 'preview' || mode === 'view') { closeOv(); return; }
      if (complete()) { closeOv(); window.goStep('submit'); }
      else { prompt = true; render(); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hidden) closeOv(); });
  }
  function openOv(m, withPrompt) {
    if (!ov) build();
    mode = m; prompt = !!withPrompt;
    if (m === 'edit') { ensureStrip(); saveActiveSlot(); }
    else if (m === 'preview') pvSize = state.size || (enabledSizes().includes(58) ? 58 : enabledSizes()[0]);
    ov.hidden = false; document.body.classList.add('cs-open');
    render();
  }
  function closeOv() { if (ov) ov.hidden = true; document.body.classList.remove('cs-open'); updateChip(); }
  window.openStripView = () => openOv('view');

  function render() {
    const edit = mode === 'edit', preview = mode === 'preview', st = state.strip;
    const mm = preview ? pvSize : st.size, g = geometry(mm);
    $('csTitle').textContent = edit ? 'Your minimum order' : preview ? 'Minimum order preview' : mode === 'confirm' ? 'Check your pins' : 'Your pins';
    $('csTabs').hidden = !preview;
    $('csTabs').innerHTML = enabledSizes().map(s => '<button class="' + (s === mm ? 'on' : '') + '" data-mm="' + s + '">' + s + 'mm</button>').join('');
    const strip = $('csStrip');
    strip.style.aspectRatio = g.W + ' / ' + H;
    strip.innerHTML = stripCircles(g, preview ? null : st, edit, edit && prompt);
    const word = g.layout === 'column' ? 'in a single column' : g.layout === 'zigzag' ? 'in a zigzag' : 'in 2 columns';
    $('csInfo').innerHTML = '<b>' + mm + 'mm pins</b><span>' + g.count + ' pins per strip, ' + word + '. One A4 sheet cut lengthwise into a ' + g.W + 'mm-wide strip.</span>';
    $('csHow').innerHTML = edit
      ? '<b>How it works</b><span>Tap <b>✎</b> on a circle to design it, or design one pin and press <b>⧉</b> to copy it into every empty circle.</span>'
      : preview
        ? '<b>Minimum order</b><span>Every circle on the strip is a pin. You’ll fill the strip with one design or a mix of designs before you can check out.</span>'
        : '<b>This is what we’ll print</b><span>Every circle below is one pin of your order, in the same position as on the cut strip. Scroll to see all ' + g.count + '.</span>';
    $('csProgWrap').hidden = !edit;
    $('csWarn').hidden = !(edit && prompt && !complete());
    $('csWarn').textContent = edit ? 'Please complete all ' + g.count + ' pins before checkout — ' + (g.count - doneCount()) + ' still empty.' : '';
    if (edit) {
      const done = doneCount();
      $('csBar').style.width = (done / g.count * 100) + '%';
      $('csProg').textContent = done + ' of ' + g.count + ' pins designed';
    }
    const go = $('csGo'), back = $('csBack');
    back.hidden = mode !== 'confirm';
    go.className = 'cs-go' + (edit && !complete() ? ' soft' : '');
    go.textContent = preview || mode === 'view' ? 'Close' : mode === 'confirm' ? '✓ Yes, Submit' : 'Continue to checkout ›';
    if (edit && !complete()) { const n = g.count - doneCount(); go.textContent = 'Complete ' + n + ' more pin' + (n > 1 ? 's' : '') + ' to continue'; }
  }

  async function onStripClick(e) {
    const btn = e.target.closest('[data-a]'); if (!btn || mode !== 'edit') return;
    const i = +btn.closest('[data-i]').dataset.i, st = state.strip;
    if (btn.dataset.a === 'dup') {
      const src = st.slots[i]; if (!src) return;
      st.slots = st.slots.map(s => s || src);               // every empty circle gets this design
      prompt = false; render();
    } else {
      saveActiveSlot(); st.active = i; closeOv();
      await quietly(async () => {
        if (st.slots[i]) await applyPinTemplateSnapshot(st.slots[i].snap);
        else { resetDesignForTemplate(); window.goStep('design'); }
      });
      updateChip();
    }
  }

  /* ── design-step chip, size-step button, summary ── */
  function updateChip() {
    const chip = $('stripChip'); if (!chip) return;
    const st = state.strip;
    chip.hidden = !st;
    if (st) {
      chip.querySelector('span').textContent = doneCount() + '/' + st.count;
      chip.title = 'Pin ' + (st.active + 1) + ' of ' + st.count + ' — see your minimum order';
      chip.classList.toggle('ok', complete());
    }
  }
  function injectUi() {
    const next = $('toSubmitBtn');
    if (next && !$('stripChip')) {
      const chip = document.createElement('button');
      chip.id = 'stripChip'; chip.className = 'cr-icon-btn cr-strip-chip'; chip.hidden = true; chip.type = 'button';
      chip.innerHTML = '<svg class="cr-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="20" rx="2"/><circle cx="12" cy="7" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="17" r="1.6"/></svg><span></span>';
      chip.addEventListener('click', () => openOv('edit'));
      next.parentNode.insertBefore(chip, next);
    }
    const grid = $('sizeGrid');
    if (grid && !$('stripPreviewBtn')) {
      grid.insertAdjacentHTML('afterend', '<div class="cs-sizenote"><button class="cs-link" id="stripPreviewBtn" type="button">See minimum order ›</button><p id="stripNote"></p></div>');
      $('stripPreviewBtn').addEventListener('click', () => openOv('preview'));
    }
    refreshNote();
  }
  function refreshNote() {
    const n = $('stripNote'); if (!n) return;
    n.textContent = 'Minimum order is one cut strip of pins — ' + enabledSizes().map(mm => mm + 'mm: ' + cfgFor(mm).count).join(' · ') + '.';
  }

  /* ── wrap the builder's own functions ── */
  const origGoStep = window.goStep;
  window.goStep = function (name) {
    if (name === 'submit' && state.strip) {
      saveActiveSlot();
      if (!complete()) { openOv('edit', true); return; }
    }
    origGoStep(name);
    if (name === 'design') { ensureStrip(); updateChip(); }
  };
  const origSummary = window.renderSubmitSummary;
  window.renderSubmitSummary = function () {
    const st = state.strip;
    if (!st || !complete()) { origSummary(); return; }
    const g = geometry(st.size);
    $('submitSummary').innerHTML =
      '<div class="cs-sumbox" id="csSumBox" role="button" tabindex="0" aria-label="View your whole minimum order">' +
      '<div class="cs-strip cs-mini" style="aspect-ratio:' + g.W + ' / ' + H + '">' + stripCircles(g, st, false, false) + '</div>' +
      '<div class="cs-sumcap"><b>' + st.count + ' × ' + st.size + 'mm pins</b><span>Minimum order · tap to see every pin</span></div></div>';
    const box = $('csSumBox'); box.addEventListener('click', () => openOv('view'));
    box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openOv('view'); });
  };
  // the final "Yes, Submit" check shows the whole strip too (a single 3D pin would hide the rest)
  const origConfirm = window.openSubmitConfirmPreview;
  window.openSubmitConfirmPreview = function () {
    if (state.strip && complete()) openOv('confirm'); else origConfirm();
  };
  const origSubmit = window.submitOrder;
  window.submitOrder = async function (order) {
    const st = state.strip;
    if (!st || !complete()) return origSubmit(order);
    const uniq = [], slots = st.slots.map(s => { let k = uniq.indexOf(s.png); if (k < 0) { uniq.push(s.png); k = uniq.length - 1; } return k; });
    return submitPinStripOrder(Object.assign({}, order, {
      designDataUrl: uniq[0],
      strip: { size: st.size, count: st.count, layout: st.layout, slots, unique: uniq.length },
    }), uniq);
  };
  const origMail = window.sendConfirmationEmail;
  if (origMail) window.sendConfirmationEmail = function (p) {
    const st = state.strip;
    return origMail(st ? Object.assign({}, p, { size: p.size + ' · minimum order of ' + st.count + ' pins' }) : p);
  };

  injectUi();
  getPinStrips().then(c => { CFG = c; refreshNote(); if (ov && !ov.hidden) render(); }).catch(() => {});
  window.openMinimumPreview = () => openOv('preview');
})();
