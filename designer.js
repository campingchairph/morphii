/* Designer Studio — sign in, create a designer account, upload stickers, buy pass slots.
   Quota is enforced by the Firestore rules (see firebase-config.js); the checks here only
   explain things to the designer before they hit a "permission denied". */
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ms = t => (t && t.toMillis ? t.toMillis() : 0);
  const fmtDate = t => new Date(ms(t)).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  let ME = null, D = null, STICKERS = [], PAYINFO = {}, PREP = null, busy = false;

  function show(view) {
    ['viewOut', 'viewCreate', 'viewDash'].forEach(v => { $(v).hidden = v !== view; });
    $('loading').hidden = true;
    $('signOutBtn').hidden = !ME;
    $('userLine').textContent = ME ? (D ? D.displayName : (ME.email || '')) : '';
  }
  const passActive = () => !!D && ms(D.paidUntil) > Date.now();
  const openSlots = () => (passActive() ? Math.max(0, (D.paidSlots || 0) - (D.paidListed || 0)) : 0);
  // can the designer's NEXT upload go through right now?
  function uploadState() {
    const next = D.uploadsEver + 1;
    if (next <= DESIGNER_FREE_UPLOADS) return { ok: true, text: 'Your next upload is free (#' + next + ' of ' + DESIGNER_FREE_UPLOADS + ').' };
    if (openSlots() > 0) return { ok: true, text: 'Upload #' + next + ' will use 1 of your ' + openSlots() + ' open pass slot' + (openSlots() > 1 ? 's' : '') + '.' };
    return { ok: false, text: 'Upload #' + next + ' needs a pass slot — activate some below (₱' + DESIGNER_PESO_PER_SLOT + ' per slot, 30 days).' };
  }

  async function loadAll() {
    D = await getDesigner(ME.uid);
    if (!D) { show('viewCreate'); return; }
    [STICKERS, PAYINFO] = await Promise.all([getMyDesignerStickers(ME.uid), getDesignerPayInfo()]);
    renderDash(); show('viewDash');
    renderPayments();
  }

  /* ── dashboard ── */
  function renderDash() {
    const used = Math.min(DESIGNER_FREE_UPLOADS, D.uploadsEver);
    $('freeLeft').textContent = DESIGNER_FREE_UPLOADS - used;
    $('dots').innerHTML = Array.from({ length: DESIGNER_FREE_UPLOADS }, (_, i) => '<i class="' + (i < used ? 'used' : '') + '"></i>').join('');
    const st = uploadState();
    $('nextLine').textContent = st.text;
    $('nextLine').style.color = st.ok ? '' : '#c0304f';

    const act = passActive();
    $('passChip').textContent = act ? 'Active until ' + fmtDate(D.paidUntil) : (D.paidUntil ? 'Expired ' + fmtDate(D.paidUntil) : 'No pass yet');
    $('passChip').className = 'ds-chip' + (act ? ' on' : '');
    $('passStats').innerHTML = [
      ['Paid slots', D.paidSlots || 0], ['Paid stickers kept', D.paidListed || 0], ['Open slots', openSlots()], ['Lifetime uploads', D.uploadsEver],
    ].map(([k, v]) => '<div class="ds-stat"><b>' + v + '</b><span>' + k + '</span></div>').join('');

    const slots = Math.max(1, parseInt($('slotsInput').value, 10) || 1);
    $('payAmt').textContent = slots * DESIGNER_PESO_PER_SLOT;
    const hint = (D.paidListed || 0) > slots ? '<br><b>Heads up:</b> you keep ' + D.paidListed + ' paid stickers, so activate at least ' + D.paidListed + ' slots to keep them all listed.' : '';
    $('payInfo').innerHTML = (PAYINFO.gcashNumber
      ? 'Send <b>₱' + slots * DESIGNER_PESO_PER_SLOT + '</b> by GCash to <b>' + esc(PAYINFO.gcashName || 'Morphii') + '</b> · <b>' + esc(PAYINFO.gcashNumber) + '</b>.'
      : 'Payment details will appear here soon — message Morphii to pay.') +
      (PAYINFO.note ? '<br>' + esc(PAYINFO.note) : '') + hint;
    $('payBtn').disabled = busy;

    const up = uploadState();
    $('uploadBtn').disabled = busy || !PREP || !$('stName').value.trim() || !up.ok;
    const price = clampPrice($('stPrice').value);
    $('earnLine').textContent = price > 0 ? 'Customers pay ₱' + price + ' · you earn ₱' + (price * DESIGNER_REVENUE_SHARE).toFixed(2).replace(/\.00$/, '') + ' (80%).' : 'Free for everyone — great for getting noticed.';

    $('myCount').textContent = STICKERS.length ? '(' + STICKERS.length + ')' : '';
    $('myGrid').innerHTML = STICKERS.length ? STICKERS.map(s =>
      '<div class="ds-st" data-id="' + s.id + '"><div class="th"><img src="' + esc(s.thumb) + '" alt=""></div><b>' + esc(s.name) + '</b>' +
      '<div class="meta"><span class="ds-chip ' + (s.status === 'approved' ? 'on' : s.status) + '">' + (s.status === 'approved' ? 'Live' : s.status === 'pending' ? 'In review' : 'Not approved') + '</span><span>' + (s.price ? '₱' + s.price : 'Free') + '</span></div>' +
      '<div class="meta"><span>#' + s.seq + (s.seq <= DESIGNER_FREE_UPLOADS ? ' · free' : ' · paid') + '</span></div>' +
      '<div class="acts"><button data-act="edit">Edit</button><button class="del" data-act="del">Delete</button></div></div>').join('')
      : '<div class="ds-empty">No stickers yet — upload your first one above.</div>';
  }
  function renderPayments() {
    getMyDesignerPayments(ME.uid).then(list => {
      $('payList').innerHTML = list.length ? '<label class="ds-label" style="margin-top:12px;">Your payments</label>' + list.slice(0, 8).map(p =>
        '<div class="ds-payrow"><span>' + fmtDate(p.createdAt) + ' · ' + p.slots + ' slot' + (p.slots > 1 ? 's' : '') + ' · ₱' + p.amount + '</span><span class="ds-chip ' + (p.status === 'approved' ? 'on' : p.status) + '">' + (p.status === 'approved' ? 'Confirmed' : p.status === 'pending' ? 'Waiting for us' : 'Declined') + '</span></div>').join('') : '';
    }).catch(() => {});
  }
  const clampPrice = v => Math.max(0, Math.min(DESIGNER_PRICE_MAX, Math.round(parseFloat(v) || 0)));

  /* ── image prep: trim transparent edges, keep it small enough for Firestore ── */
  async function prepareImage(file) {
    const url = URL.createObjectURL(file);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('bad image')); i.src = url; });
    URL.revokeObjectURL(url);
    const sc = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * sc)), h = Math.max(1, Math.round(img.naturalHeight * sc));
    const src = document.createElement('canvas'); src.width = w; src.height = h;
    const sx = src.getContext('2d', { willReadFrequently: true }); sx.drawImage(img, 0, 0, w, h);
    const d = sx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1, hasAlpha = false;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = d[(y * w + x) * 4 + 3];
      if (a < 250) hasAlpha = true;
      if (a > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) throw new Error('empty image');
    const pad = 4, tw = x1 - x0 + 1 + pad * 2, th = y1 - y0 + 1 + pad * 2;
    const trim = document.createElement('canvas'); trim.width = tw; trim.height = th;
    trim.getContext('2d').drawImage(src, x0 - pad, y0 - pad, tw, th, 0, 0, tw, th);
    const encode = (maxSide, limit) => {
      let side = maxSide, out;
      for (let i = 0; i < 8; i++) {
        const k = Math.min(1, side / Math.max(tw, th)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(tw * k)); c.height = Math.max(1, Math.round(th * k));
        c.getContext('2d').drawImage(trim, 0, 0, c.width, c.height);
        out = { url: c.toDataURL('image/png'), w: c.width, h: c.height };
        if (out.url.length <= limit) break;
        side = Math.round(side * 0.82);
      }
      return out;
    };
    const full = encode(1000, 850000), thumb = encode(320, 50000);
    if (full.url.length > 850000 || thumb.url.length > 55000) throw new Error('too big');
    return { full: full.url, thumb: thumb.url, w: full.w, h: full.h, hasAlpha };
  }

  /* ── events ── */
  function bind() {
    $('googleBtn').addEventListener('click', async () => {
      $('signErr').textContent = '';
      try { await AUTH.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
      catch (e) {
        $('signErr').textContent = e.code === 'auth/operation-not-allowed' ? 'Google sign-in isn’t switched on yet — please tell Morphii.'
          : e.code === 'auth/popup-closed-by-user' ? '' : 'Couldn’t sign in: ' + (e.code || e.message);
      }
    });
    $('signOutBtn').addEventListener('click', () => AUTH.signOut());
    $('createBtn').addEventListener('click', async () => {
      const name = $('nameInput').value.trim();
      $('createErr').textContent = '';
      if (name.length < 2) { $('createErr').textContent = 'Please enter a designer name (at least 2 characters).'; return; }
      if (!$('agreeBox').checked) { $('createErr').textContent = 'Please tick the box to continue.'; return; }
      $('createBtn').disabled = true;
      try { D = await createDesigner(ME, name); await loadAll(); }
      catch (e) { $('createErr').textContent = 'Couldn’t create your account (' + (e.code || e.message) + ').'; }
      $('createBtn').disabled = false;
    });

    $('fileInput').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      $('uploadMsg').className = 'ds-msg'; $('uploadMsg').textContent = 'Preparing…';
      PREP = null; $('prevImg').hidden = true;
      try {
        PREP = await prepareImage(f);
        $('prevImg').src = PREP.thumb; $('prevImg').hidden = false; $('dropText').hidden = true;
        if (!$('stName').value) $('stName').value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 40);
        $('uploadMsg').textContent = PREP.hasAlpha ? '' : 'Tip: this image has no transparent background, so it will print as a rectangle.';
      } catch (err) {
        $('uploadMsg').className = 'ds-msg bad';
        $('uploadMsg').textContent = err.message === 'empty image' ? 'That image looks empty.' : 'Couldn’t read that image — try a smaller PNG.';
      }
      renderDash();
    });
    ['stName', 'stPrice'].forEach(id => $(id).addEventListener('input', renderDash));
    $('slotsInput').addEventListener('input', renderDash);

    $('uploadBtn').addEventListener('click', async () => {
      if (busy || !PREP) return;
      busy = true; renderDash(); $('uploadMsg').className = 'ds-msg'; $('uploadMsg').textContent = 'Uploading…';
      try {
        D = await getDesigner(ME.uid);                    // fresh counters
        if (!uploadState().ok) throw Object.assign(new Error('quota'), { code: 'quota' });
        await uploadDesignerSticker(D, { name: $('stName').value.trim(), price: clampPrice($('stPrice').value), thumb: PREP.thumb, full: PREP.full, w: PREP.w, h: PREP.h });
        PREP = null; $('fileInput').value = ''; $('stName').value = ''; $('prevImg').hidden = true; $('dropText').hidden = false;
        $('uploadMsg').className = 'ds-msg ok'; $('uploadMsg').textContent = 'Uploaded! It will appear in the library once we review it.';
        busy = false; await loadAll();
      } catch (e) {
        busy = false;
        $('uploadMsg').className = 'ds-msg bad';
        $('uploadMsg').textContent = e.code === 'quota' ? 'You need an open pass slot for this upload — see Designer pass below.'
          : e.code === 'permission-denied' ? 'The upload was refused — your points or pass may have changed. Refresh and try again.' : 'Upload failed (' + (e.code || e.message) + ').';
        renderDash();
      }
    });

    $('payBtn').addEventListener('click', async () => {
      const slots = Math.max(1, Math.min(2000, parseInt($('slotsInput').value, 10) || 0));
      const ref = $('refInput').value.trim();
      if (!ref) { $('payMsg').className = 'ds-msg bad'; $('payMsg').textContent = 'Please enter your GCash reference number so we can find your payment.'; return; }
      busy = true; $('payBtn').disabled = true;
      try {
        await requestDesignerPayment(D, slots, ref);
        $('refInput').value = ''; $('payMsg').className = 'ds-msg ok'; $('payMsg').textContent = 'Thanks! We’ll confirm your payment and switch your pass on.';
        renderPayments();
      } catch (e) { $('payMsg').className = 'ds-msg bad'; $('payMsg').textContent = 'Couldn’t send that (' + (e.code || e.message) + ').'; }
      busy = false; renderDash();
    });

    $('myGrid').addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const st = STICKERS.find(x => x.id === b.closest('.ds-st').dataset.id); if (!st) return;
      try {
        if (b.dataset.act === 'del') {
          if (!confirm('Delete “' + st.name + '”?\n\nThis does NOT give your upload back — your lifetime upload count stays the same.')) return;
          D = await getDesigner(ME.uid); await deleteDesignerSticker(D, st); await loadAll();
        } else {
          const name = prompt('Sticker name', st.name); if (name === null) return;
          const price = prompt('Price in ₱ (0–' + DESIGNER_PRICE_MAX + ')', st.price); if (price === null) return;
          await updateDesignerSticker(st.id, { name: name.trim() || st.name, price: clampPrice(price) }); await loadAll();
        }
      } catch (err) { alert('That didn’t work (' + (err.code || err.message) + ').'); }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    if (typeof AUTH === 'undefined' || !AUTH) { $('loading').textContent = 'Designer accounts are not available right now.'; return; }
    AUTH.onAuthStateChanged(async u => {
      ME = u; D = null;
      if (!u) { show('viewOut'); return; }
      $('loading').hidden = false;
      try { await loadAll(); }
      catch (e) { $('loading').hidden = false; $('loading').textContent = 'Couldn’t load your account (' + (e.code || e.message) + '). The database rules may need publishing.'; }
    });
  });
})();
