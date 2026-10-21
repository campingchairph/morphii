/* ═══════════════════════════════════════════════
   MORPHII — Firebase Configuration & Order Sync
   ═══════════════════════════════════════════════

   ⚠️  SETUP — fill in the values below.

   Steps:
   1. Go to console.firebase.google.com
   2. Create a NEW project (e.g. "morphii") — separate
      from any other Firebase project you have.
   3. Build → Firestore Database → Create database →
      production mode → pick a location → Enable.
   4. Build → Authentication → Get started → enable the
      "Email/Password" provider.
   5. Authentication → Users tab → Add user → this is the
      admin login for orders-admin.html.
   6. ⚙️ Project Settings → scroll to "Your apps" → click
      the </> web icon → register an app → copy the
      firebaseConfig values into FIREBASE_CONFIG below.
   7. Set ADMIN_EMAILS below to the admin login email(s).
   8. Publish the Firestore security rules shown at the
      bottom of this file in the Firebase Console
      (Firestore → Rules) — they are NOT deployed from here.
   ═══════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCDqbt4-zlCAUe098zLqpV74rhE4RGaiLo",
  authDomain:        "morphii.firebaseapp.com",
  projectId:         "morphii",
  storageBucket:     "morphii.firebasestorage.app",
  messagingSenderId: "541452960838",
  appId:             "1:541452960838:web:40b51d70a1873bde16f647",
};

const ADMIN_EMAILS = [
  'buboyseph@gmail.com',
  'morphiicreate@gmail.com',
];

/* ── INIT ─────────────────────────────────────── */
const _fbReady = !FIREBASE_CONFIG.apiKey.includes('PASTE');
if (_fbReady) {
  try { firebase.initializeApp(FIREBASE_CONFIG); } catch(e) {}
}

const AUTH = _fbReady ? firebase.auth()      : null;
const DB   = _fbReady ? firebase.firestore() : null;

function isAdmin(user) {
  return !!user && ADMIN_EMAILS.includes(user.email || '');
}

/* ── ORDERS (morphii_orders collection) ────────
   Doc shape:
   {
     status:      'pending' | 'approved' | 'rejected'
     printed:     boolean (set true once sent through the print-layout tool)
     product:     'lapel-pin' | 'challenge-coin' | 'medal' | 'golf-marker'
     size:        25 | 32 | 37 | 44 | 58 | 75   (mm, finished/cut diameter — see create.js SIZES)
     paperSize:   mm, full print/PVC-wrap sheet diameter incl. bleed (fixed per size)
     designDataUrl: base64 PNG, clean (no watermark), full artboard incl. bleed
     customerName, customerEmail, customerPhone, notes
     saveCode:    6-char code the customer gets to reference in Shopee chat
     shopeeOrderId (optional — filled in later once you match a payment)
     createdAt:   server timestamp
   }
   ─────────────────────────────────────────────── */
async function submitOrder(order) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_orders').add({
    ...order,
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/* ── VISIT COUNTER (morphii_visits collection) ──
   One doc per DAY (id = local YYYY-MM-DD) holding a running count, so the
   admin can see "did anyone visit, and when" without tracking who. No device
   ids, no location lookup. Doc shape:
   { day, visitCount, lastSeen (server timestamp) }
   Counted at most once per browser tab session (sessionStorage), and never
   for a signed-in admin (create.js waits for auth before calling this).
   Public create/update (same trust model as morphii_orders), admin-only
   read. Never awaited by callers and every failure is swallowed, so it can
   never break the pin builder. ─────────────────────────────────────── */
async function recordVisit() {
  if (!DB) return;
  try {
    if (sessionStorage.getItem('morphii_visit_counted')) return;
    const d = new Date();
    const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    await DB.collection('morphii_visits').doc(day).set({
      day,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
      visitCount: firebase.firestore.FieldValue.increment(1),
    }, { merge: true });
    sessionStorage.setItem('morphii_visit_counted', '1'); // only once the write actually landed
  } catch (e) { /* analytics must never break the app */ }
}

// Per-day rows, newest first, for the admin's Visitors panel. Ids that
// aren't a YYYY-MM-DD date (e.g. leftovers from the old per-device
// version of this feature) are ignored.
async function getVisitDays(limit) {
  if (!DB) return [];
  try {
    const snap = await DB.collection('morphii_visits').orderBy('lastSeen', 'desc').limit(limit || 120).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.id));
  } catch (e) { return []; }
}

/* ── FUNERAL HOME PARTNERSHIPS (funeral-admin.html) ──

   morphii_funeral_contacts collection — one doc per funeral home:
   {
     name, contactPerson, email, phone, address, notes,
     status: 'not_contacted' | 'sent' | 'replied' | 'negotiating' | 'won' | 'declined',
     dateContacted, dateReplied, dateClosed (plain 'YYYY-MM-DD' strings —
       admin-entered/auto-stamped, not server timestamps, so they read
       naturally as "the day this happened" regardless of timezone),
     createdAt, updatedAt (server timestamps)
   }
   Admin-only — this is internal outreach/CRM data, never read by the
   public-facing site.

   morphii_funeral/templates doc — { list: [ { id, title, body, tags }, ... ] }
   Copy-paste (or mailto-compose) message templates for proposals, follow-
   ups, thank-yous, and win-back replies to a decline. `[BRACKET_CAPS]` in
   the body are placeholders auto-filled from the contact record where the
   name matches (e.g. [FUNERAL_HOME_NAME], [CONTACT_NAME]) when composing;
   anything else stays literal for the admin to fill in by hand. ── */
async function getFuneralContacts() {
  if (!DB) return [];
  try {
    const snap = await DB.collection('morphii_funeral_contacts').orderBy('updatedAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
}
async function saveFuneralContact(contact) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  const { id, ...data } = contact;
  data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  if (id) return DB.collection('morphii_funeral_contacts').doc(id).set(data, { merge: true });
  data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  return DB.collection('morphii_funeral_contacts').add(data);
}
async function deleteFuneralContact(id) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_funeral_contacts').doc(id).delete();
}
async function getFuneralTemplates() {
  if (!DB) return null;
  try {
    const doc = await DB.collection('morphii_funeral').doc('templates').get();
    return (doc.exists && doc.data().list) || null;
  } catch (e) { return null; }
}
async function saveFuneralTemplates(list) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_funeral').doc('templates').set({ list });
}

/* ── CUSTOM FONTS (morphii_config/fonts doc) ───
   { list: [ { name:'Bangers', url:'...', scope:'all' }, ... ] }
   scope is 'all' (default, every product) or 'in-loving-memory' (only
   offered on that product's own, separately-curated font list — see
   create.js's MEMORIAL_FONTS). Public read (create.html needs it,
   unauthenticated) — admin-only write. Used by both the admin Fonts
   manager and the pin designer's text tool. */
async function getCustomFonts() {
  if (!DB) return [];
  try {
    const doc = await DB.collection('morphii_config').doc('fonts').get();
    return (doc.exists && doc.data().list) || [];
  } catch (e) { return []; }
}
async function saveCustomFonts(list) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_config').doc('fonts').set({ list });
}

/* ── ASSET LABEL OVERRIDES (morphii_config/assetLabels doc) ──
   { "<raw github url>": "Custom Label", ... }
   Any image file pushed to assets/pins/<category>/ on GitHub is
   automatically live in the pin designer — that push is the only access
   control (only repo collaborators can do it). The default label is the
   filename, cleaned up; this doc just lets the admin override specific
   labels without touching GitHub. Public read, admin-only write. Used by
   both the admin's Assets monitor page and the pin designer. */
async function getAssetLabelOverrides() {
  if (!DB) return {};
  try {
    const doc = await DB.collection('morphii_config').doc('assetLabels').get();
    return (doc.exists && doc.data()) || {};
  } catch (e) { return {}; }
}
async function saveAssetLabelOverrides(map) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_config').doc('assetLabels').set(map);
}

/* ── STICKER CATEGORY ORDER (morphii_config/categoryOrder doc) ──
   { "<product group id, or 'shared'>": ["twice","aespa",...], ... }
   Sticker subfolders (categories) default to alphabetical order in the
   customer-facing picker; this doc lets the admin pin a specific order
   per product group instead. Any category not listed just falls back to
   alphabetical, sorted in after the ones that are. Public read (create.js
   needs it), admin-only write. Used by admin-add-assets.html's reorder
   panel and the pin designer's buildStickerGroups(). */
async function getCategoryOrder() {
  if (!DB) return {};
  try {
    const doc = await DB.collection('morphii_config').doc('categoryOrder').get();
    return (doc.exists && doc.data()) || {};
  } catch (e) { return {}; }
}
async function saveCategoryOrder(map) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_config').doc('categoryOrder').set(map);
}

/* ── STICKER SHEET LIBRARY ACCESS (morphii_config/stickerLibrary doc) ──
   { hidden: ["<collection>|<category id>", ...] }  e.g. "shared|s:aespa", "wedding|o:shapes"
   Which parts of the asset library customers may use on stickers.html.
   Anything not listed is available. Public read, admin-only write (covered by
   the existing morphii_config rule). Edited from the admin panel on stickers.html. */
async function getStickerLibrary() {
  if (!DB) return { hidden: [] };
  try {
    const doc = await DB.collection('morphii_config').doc('stickerLibrary').get();
    const d = (doc.exists && doc.data()) || {};
    return { hidden: Array.isArray(d.hidden) ? d.hidden : [] };
  } catch (e) { return { hidden: [] }; }
}
async function saveStickerLibrary(cfg) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_config').doc('stickerLibrary').set({ hidden: cfg.hidden || [] });
}

/* ── CATALOG CONFIG (morphii_config/catalog doc) ──
   { products: { "lapel-pin": true, ... }, sizes: { "37": true, ... } }
   Lets the admin turn product types and pin sizes on/off (e.g. when out of
   stock) without a code deploy — create.js's hardcoded PRODUCTS/SIZES lists
   are just the defaults; any id present here overrides that default's
   `enabled` flag. Public read, admin-only write. */
async function getCatalogConfig() {
  if (!DB) return { products:{}, sizes:{} };
  try {
    const doc = await DB.collection('morphii_config').doc('catalog').get();
    const data = (doc.exists && doc.data()) || {};
    return { products: data.products || {}, sizes: data.sizes || {} };
  } catch (e) { return { products:{}, sizes:{} }; }
}
async function saveCatalogConfig(cfg) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_config').doc('catalog').set(cfg);
}

/* ── FINANCE: COSTS (morphii_costs collection) ──
   One doc per manually-logged business expense — button press blanks,
   outsourced printing, packaging, Shopee fees, equipment, etc.
   { label, category, amount, date, notes, createdAt }
   Admin-only read/write (unlike morphii_config, this is never read by the
   public-facing pin designer, so it doesn't need public read). */
async function getCosts() {
  if (!DB) return [];
  try {
    const snap = await DB.collection('morphii_costs').orderBy('date', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
}
async function addCost(cost) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_costs').add({ ...cost, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
}
async function updateCost(id, cost) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_costs').doc(id).update(cost);
}
async function deleteCost(id) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_costs').doc(id).delete();
}

/* ── FINANCE: PRICING (morphii_finance/pricing doc) ──
   { entries: [ { product, productLabel, size, price, costPerPrint, printsPerPin }, ... ] }
   Selling price + production cost per product/size combo, used only for
   the admin's own ROI math — never read by the pin designer (customers
   pay through Shopee, not through this tool). Admin-only read/write. */
async function getPricingConfig() {
  if (!DB) return [];
  try {
    const doc = await DB.collection('morphii_finance').doc('pricing').get();
    return (doc.exists && doc.data().entries) || [];
  } catch (e) { return []; }
}
async function savePricingConfig(entries) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_finance').doc('pricing').set({ entries });
}

/* ── FINANCE: GOALS (morphii_finance/goals doc) ──
   { list: [ { id, label, targetAmount, createdAt }, ... ] }
   Savings targets (new printer, new heat press, etc.) tracked against net
   profit on the ROI tab. Admin-only read/write. */
async function getGoalsConfig() {
  if (!DB) return [];
  try {
    const doc = await DB.collection('morphii_finance').doc('goals').get();
    return (doc.exists && doc.data().list) || [];
  } catch (e) { return []; }
}
async function saveGoalsConfig(list) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_finance').doc('goals').set({ list });
}

/* ── PIN TEMPLATES (morphii_pin_templates collection) ──
   One doc per admin-saved reusable design. Doc shape:
   {
     productId:   'lapel-pin' (etc — matches create.js PRODUCTS ids)
     typeLabel:   'Sporty' — free text the admin types when saving; the
                  distinct values already in use ARE the "types" list (no
                  separate types collection — adding a new type is just
                  typing a name that hasn't been used yet)
     name:        'Blue Star Badge'
     thumbnail:   small base64 JPEG data URL, for the browsing grid
     size:        32 (mm, finished/cut diameter)
     snapshot:    { bg, textLines, stickers, shapes, wordArts, letters,
                    character, border, layerOrder } — a JSON-serializable
                    copy of create.js's design state (Image objects reduced
                    to their .src URL, reconstructed on load)
     createdAt:   server timestamp
     createdBy:   admin's email
   }
   Public read (customers browse these while designing, unauthenticated) —
   admin-only write, same as morphii_config. */
async function getPinTemplates() {
  if (!DB) return [];
  try {
    const snap = await DB.collection('morphii_pin_templates').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
}
async function savePinTemplate(tpl) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_pin_templates').add({
    ...tpl,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
async function deletePinTemplate(id) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_pin_templates').doc(id).delete();
}
// Overwrites an existing template in place (admin "Edit" flow in create.js)
// instead of creating a new document — same shape as savePinTemplate's
// payload, minus createdAt (left untouched on update).
async function updatePinTemplate(id, tpl) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_pin_templates').doc(id).update({ ...tpl });
}

/* ── SHOPEE: PRICING (morphii_shopee/pricing doc) ──
   { sizes: [ { id, label, marketPrice, premiumPct, price, costPerPc,
                perSheet, minSheets }, ... ],
     discountTiers: [ { minSheets, discountPct }, ... ],
     shopeeFeesPct, rushAddonPct }
   `price` is the admin's final selling price — pre-filled from
   marketPrice*(1+premiumPct/100) (Morphii's app-premium rationale, see
   morphii-shopee-casestudy.html) but editable so it can be rounded to a
   clean number. Admin-only — never read by the public-facing pin
   designer, unlike morphii_config. */
async function getShopeePricing() {
  if (!DB) return null;
  try {
    const doc = await DB.collection('morphii_shopee').doc('pricing').get();
    return (doc.exists && doc.data()) || null;
  } catch (e) { return null; }
}
async function saveShopeePricing(cfg) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_shopee').doc('pricing').set(cfg);
}

/* ── SHOPEE: INQUIRY SCRIPTS (morphii_shopee/scripts doc) ──
   { list: [ { id, title, body, tags:[...] }, ... ] }
   Copy-paste Shopee chat reply templates; `[BRACKET_CAPS]` in the body are
   highlighted as placeholders in the admin UI. Admin-only. */
async function getShopeeScripts() {
  if (!DB) return null;
  try {
    const doc = await DB.collection('morphii_shopee').doc('scripts').get();
    return (doc.exists && doc.data().list) || null;
  } catch (e) { return null; }
}
async function saveShopeeScripts(list) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_shopee').doc('scripts').set({ list });
}

/* ── GITHUB TOKEN (morphii_secrets/github doc) ──
   { token: "github_pat_..." }
   Lets the admin's "Add Sticker" tool (orders-admin.html) push a pasted PNG
   straight to assets/pins/ via the GitHub Contents API — no manual git push.
   This token can WRITE to the repo if it leaks, so it lives in its own
   collection (never morphii_config, which is public-read) with admin-only
   read AND write. Use a fine-grained token — github.com/settings/personal-
   access-tokens/new — repository access: only this repo, permissions:
   "Contents: Read and write". Never a classic token with full account
   access; a leaked fine-grained token scoped this way can only touch this
   one repo's file contents. */
async function getGithubToken() {
  if (!DB) return '';
  // Deliberately NOT swallowing errors here (unlike the other getters in
  // this file) — a permission-denied on this specific collection usually
  // means the morphii_secrets security rule (see the bottom of this file)
  // was never published in the Firebase Console, and that's silent/
  // confusing to debug unless the caller can see and surface it.
  const doc = await DB.collection('morphii_secrets').doc('github').get();
  return (doc.exists && doc.data().token) || '';
}
async function saveGithubToken(token) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  return DB.collection('morphii_secrets').doc('github').set({ token });
}

/* ── GITHUB CONTENTS API PUSH ──
   Creates or updates one file on `main` via the Contents API. Updates need
   the existing file's blob sha, so this checks for that first — omitting it
   only matters when overwriting; a brand-new path 404s on the GET, which is
   expected and just means sha stays undefined. */
async function pushFileToGithub(repoPath, base64Content, commitMessage) {
  const token = await getGithubToken();
  if (!token) throw new Error('No GitHub token configured — paste one in first.');
  const apiUrl = `https://api.github.com/repos/campingchairph/morphii/contents/${repoPath}`;
  let sha;
  try {
    const existing = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (existing.ok) sha = (await existing.json()).sha;
  } catch (e) { /* network hiccup on the pre-check — fall through, PUT below will surface the real error */ }
  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: commitMessage, content: base64Content, branch: 'main', ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub push failed: ${res.status}`);
  }
  return res.json();
}

/* ── STICKER DESIGNERS (marketplace) ───────────
   Designers sign in with Google and get a profile in morphii_designers/{uid}:
     { uid, email, displayName, uploadsEver, paidListed, paidSlots, paidUntil?, lastStickerId?, lastDeletedId?, createdAt }
   uploadsEver  lifetime upload counter. It can ONLY go up (rules), so the 5 free uploads are
                never replenished — not even when the designer deletes stickers.
   Upload #1–#5 are free for life. Every upload after that needs an active pass: ₱1 per
   sticker slot for 30 days (paidSlots / paidUntil are set by an admin after the payment is
   confirmed). paidListed = how many paid-tier (#6+) stickers are currently kept.
   Stickers live in morphii_designer_stickers/{id} (metadata + small thumb) with the full
   image in the sub-document data/full. New stickers are 'pending' until an admin approves.
   Payments are manual (GCash/Shopee): designers file a request in morphii_designer_payments,
   an admin confirms it and the pass is activated. Designers keep 80% of every sale. */
const DESIGNER_FREE_UPLOADS = 5;
const DESIGNER_PESO_PER_SLOT = 1;
const DESIGNER_PASS_DAYS = 30;
const DESIGNER_REVENUE_SHARE = 0.8;
const DESIGNER_PRICE_MAX = 99;

const _dCol = () => DB.collection('morphii_designers');
const _sCol = () => DB.collection('morphii_designer_stickers');
const _pCol = () => DB.collection('morphii_designer_payments');
const _serverTs = () => firebase.firestore.FieldValue.serverTimestamp();
const _withId = d => (d.exists ? Object.assign({ id: d.id }, d.data()) : null);
const _ms = t => (t && t.toMillis ? t.toMillis() : 0);

// is this sticker visible in the public premium library right now?
function designerStickerLive(st) {
  return st.status === 'approved' && (st.seq <= DESIGNER_FREE_UPLOADS || _ms(st.paidUntil) > Date.now());
}
async function getDesigner(uid) {
  if (!DB) return null;
  return _withId(await _dCol().doc(uid).get());
}
async function createDesigner(user, displayName) {
  if (!DB) throw new Error('Firebase not configured yet');
  await _dCol().doc(user.uid).set({
    uid: user.uid, email: user.email || '', displayName: String(displayName).slice(0, 40),
    uploadsEver: 0, paidListed: 0, paidSlots: 0, createdAt: _serverTs(),
  });
  return getDesigner(user.uid);
}
async function renameDesigner(uid, displayName) {
  await _dCol().doc(uid).update({ displayName: String(displayName).slice(0, 40) });
}
async function getMyDesignerStickers(uid) {
  const snap = await _sCol().where('designerId', '==', uid).get();
  return snap.docs.map(_withId).sort((a, b) => b.seq - a.seq);
}
// One atomic batch: the sticker, its full image, and the counter bump. The rules only allow
// the counter to rise by exactly one together with a matching sticker, so quota can't be skipped.
async function uploadDesignerSticker(d, s) {
  const seq = d.uploadsEver + 1, paid = seq > DESIGNER_FREE_UPLOADS;
  const ref = _sCol().doc(), batch = DB.batch();
  batch.set(ref, {
    designerId: d.uid, designerName: d.displayName, name: String(s.name).slice(0, 40), seq,
    price: s.price, status: 'pending', thumb: s.thumb, w: s.w, h: s.h,
    paidUntil: paid ? (d.paidUntil || null) : null, createdAt: _serverTs(),
  });
  batch.set(ref.collection('data').doc('full'), { png: s.full });
  const upd = { uploadsEver: seq, lastStickerId: ref.id };
  if (paid) upd.paidListed = d.paidListed + 1;
  batch.update(_dCol().doc(d.uid), upd);
  await batch.commit();
  return ref.id;
}
// Deleting never gives the upload back (uploadsEver is untouched); it only frees a paid slot.
async function deleteDesignerSticker(d, st) {
  const ref = _sCol().doc(st.id), batch = DB.batch();
  batch.delete(ref.collection('data').doc('full'));
  batch.delete(ref);
  if (st.seq > DESIGNER_FREE_UPLOADS) batch.update(_dCol().doc(d.uid), { paidListed: Math.max(0, d.paidListed - 1), lastDeletedId: st.id });
  await batch.commit();
}
async function updateDesignerSticker(id, fields) {
  await _sCol().doc(id).update({ name: String(fields.name).slice(0, 40), price: fields.price });
}
async function getApprovedDesignerStickers() {
  if (!DB) return [];
  try {
    const snap = await _sCol().where('status', '==', 'approved').limit(500).get();
    return snap.docs.map(_withId).filter(designerStickerLive).sort((a, b) => _ms(b.createdAt) - _ms(a.createdAt));
  } catch (e) { return []; }
}
async function getDesignerStickerFull(id) {
  const d = await _sCol().doc(id).collection('data').doc('full').get();
  return d.exists ? d.data().png : null;
}
async function requestDesignerPayment(d, slots, ref) {
  await _pCol().add({
    designerId: d.uid, designerName: d.displayName, slots, amount: slots * DESIGNER_PESO_PER_SLOT,
    ref: String(ref || '').slice(0, 60), status: 'pending', createdAt: _serverTs(),
  });
}
async function getMyDesignerPayments(uid) {
  const snap = await _pCol().where('designerId', '==', uid).get();
  return snap.docs.map(_withId).sort((a, b) => _ms(b.createdAt) - _ms(a.createdAt));
}
// how designers are told to pay (GCash name/number + instructions) — editable by admins
async function getDesignerPayInfo() {
  if (!DB) return {};
  try { const d = await DB.collection('morphii_config').doc('designerPay').get(); return (d.exists && d.data()) || {}; }
  catch (e) { return {}; }
}
async function saveDesignerPayInfo(cfg) {
  return DB.collection('morphii_config').doc('designerPay').set({
    gcashName: cfg.gcashName || '', gcashNumber: cfg.gcashNumber || '', note: cfg.note || '',
  });
}
// ── admin only (enforced by the Firestore rules, not just the UI)
async function adminGetDesignerStickers(status) {
  const snap = await _sCol().where('status', '==', status).get();
  return snap.docs.map(_withId).sort((a, b) => _ms(a.createdAt) - _ms(b.createdAt));
}
async function adminSetStickerStatus(id, status) { await _sCol().doc(id).update({ status }); }
async function adminGetDesigners() {
  const snap = await _dCol().get();
  return snap.docs.map(_withId).sort((a, b) => _ms(b.createdAt) - _ms(a.createdAt));
}
async function adminGetPayments(status) {
  const snap = await _pCol().where('status', '==', status).get();
  return snap.docs.map(_withId).sort((a, b) => _ms(a.createdAt) - _ms(b.createdAt));
}
// Confirms a payment: grants `slots` paid slots and 30 more days, then stamps the new expiry
// on the designer's paid-tier stickers so the library keeps (or restores) them.
async function adminApprovePayment(pay) {
  const dref = _dCol().doc(pay.designerId), dsnap = await dref.get();
  if (!dsnap.exists) throw new Error('Designer not found');
  const cur = _ms(dsnap.data().paidUntil), base = Math.max(Date.now(), cur);
  const until = firebase.firestore.Timestamp.fromMillis(base + DESIGNER_PASS_DAYS * 86400000);
  const stickers = (await _sCol().where('designerId', '==', pay.designerId).get()).docs.filter(x => x.data().seq > DESIGNER_FREE_UPLOADS);
  const batch = DB.batch();
  batch.update(_pCol().doc(pay.id), { status: 'approved', decidedAt: _serverTs() });
  batch.update(dref, { paidSlots: pay.slots, paidUntil: until });
  stickers.slice(0, 400).forEach(x => batch.update(x.ref, { paidUntil: until }));
  await batch.commit();
}
async function adminRejectPayment(id) { await _pCol().doc(id).update({ status: 'rejected', decidedAt: _serverTs() }); }

/* ── STICKER SHEET ORDERS ───────────────────────
   morphii_sticker_orders/{code}   code = "S-" + 6 chars, used as the document id.
   Because the code IS the id, a repeated code is refused by the rules (no public updates),
   so every order number is unique. Customers can only create; admins read/update.
   Doc: { code, productLabel, status:'new'|'confirmed'|'paid'|'printing'|'done'|'cancelled',
          contactMethod:'email'|'phone', customerName, customerEmail, customerPhone, notes,
          sheets, stickers, pricePerSheet, sheetTotal, premiumTotal, total,
          premium:[{id,designer,name,price}], settings:{style,border,color,showCut},
          items:[{src,label,sizeMm,qty,premium?}], createdAt }
   item.src is a library URL, 'asset:<n>' (an uploaded/built image stored in the order's
   assets/<n> sub-document) or 'premium:<stickerId>' (a designer sticker, full image fetched by admin).
   Pricing is per A4 sheet (regular glossy vinyl, cutting included) with a minimum number of
   sheets per order and volume tiers, all kept in morphii_config/stickerPricing
   { label, minSheets, tiers:[{min,price}] } and editable on the stickers admin page. */
// The first tier's "min" is the minimum order (3 A4 sheets); the last tier is the discounted bulk price (50+).
const DEFAULT_STICKER_TIERS = [{ min: 3, price: 85 }, { min: 50, price: 75 }];
const DEFAULT_STICKER_PRICING = { label: 'Glossy vinyl stickers', minSheets: 3, tiers: DEFAULT_STICKER_TIERS };
async function getStickerPricing() {
  if (!DB) return DEFAULT_STICKER_PRICING;
  try {
    const d = await DB.collection('morphii_config').doc('stickerPricing').get();
    if (!d.exists) return DEFAULT_STICKER_PRICING;
    const x = d.data(), t = Array.isArray(x.tiers) ? x.tiers.filter(y => y.min >= 1 && y.price >= 0) : [];
    return {
      label: x.label || DEFAULT_STICKER_PRICING.label,
      minSheets: x.minSheets >= 1 ? x.minSheets : DEFAULT_STICKER_PRICING.minSheets,
      tiers: t.length ? t : DEFAULT_STICKER_TIERS,
    };
  } catch (e) { return DEFAULT_STICKER_PRICING; }
}
// cfg = { label, minSheets, tiers:[{min,price}] }
async function saveStickerPricing(cfg) {
  const tiers = cfg.tiers.map(t => ({ min: Math.max(1, Math.round(+t.min)), price: Math.max(0, Math.round(+t.price)) })).sort((a, b) => a.min - b.min);
  return DB.collection('morphii_config').doc('stickerPricing').set({
    label: String(cfg.label || 'Glossy vinyl stickers').slice(0, 60), minSheets: Math.max(1, Math.round(+cfg.minSheets || 3)), tiers,
  });
}
// price per sheet = the tier with the biggest "min" that the sheet count reaches
function stickerSheetPrice(tiers, sheets) {
  const t = tiers.slice().sort((a, b) => b.min - a.min).find(x => sheets >= x.min) || tiers.slice().sort((a, b) => a.min - b.min)[0];
  return { each: t.price, total: t.price * sheets };
}
function generateStickerOrderCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'S-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
// order + attached images in one atomic batch; retries with a fresh code if the code was already taken
async function submitStickerOrder(order, assets) {
  if (!DB) throw new Error('Firebase not configured yet');
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateStickerOrderCode(), ref = DB.collection('morphii_sticker_orders').doc(code), batch = DB.batch();
    batch.set(ref, Object.assign({}, order, { code, status: 'new', createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
    (assets || []).forEach((png, i) => batch.set(ref.collection('assets').doc(String(i)), { png }));
    try { await batch.commit(); return code; }
    catch (e) { lastErr = e; if (e.code !== 'permission-denied') throw e; }   // denied = code collision (or a bad payload)
  }
  throw lastErr;
}
async function getStickerOrders() {
  const snap = await DB.collection('morphii_sticker_orders').orderBy('createdAt', 'desc').limit(200).get();
  return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
}
async function getStickerOrder(code) {
  const d = await DB.collection('morphii_sticker_orders').doc(code).get();
  return d.exists ? Object.assign({ id: d.id }, d.data()) : null;
}
async function getStickerOrderAssets(code) {
  const snap = await DB.collection('morphii_sticker_orders').doc(code).collection('assets').get();
  const out = {}; snap.docs.forEach(d => { out[d.id] = d.data().png; }); return out;
}
async function updateStickerOrder(code, fields) { return DB.collection('morphii_sticker_orders').doc(code).update(fields); }

/* ── BUTTON PIN MINIMUM ORDER (one cut strip) ────
   A4 is cut lengthwise into an 84mm-wide strip (297mm long) and every circle on the strip is
   a pin: 4 x 58mm, 7 x 32mm (zigzag), 14 x 25mm (2 columns). A customer must complete the
   whole strip — one design per circle, duplicated or different — before checking out.
   Layouts per size live in morphii_config/pinStrips (public read, admin write), editable on
   the stickers admin page:  { "58": { count, layout:'column'|'zigzag'|'grid2', width }, ... }
   A strip order stores order.strip = { size, count, layout, slots:[uniqueDesignIndex...], unique }.
   Unique design #0 is order.designDataUrl; the others are in morphii_orders/{id}/designs/{n}. */
const DEFAULT_PIN_STRIPS = {
  25: { count: 14, layout: 'grid2',  width: 84 },
  32: { count: 7,  layout: 'zigzag', width: 84 },
  37: { count: 6,  layout: 'column', width: 84 },
  44: { count: 5,  layout: 'column', width: 84 },
  58: { count: 4,  layout: 'column', width: 84 },
  75: { count: 3,  layout: 'column', width: 90 },
};
async function getPinStrips() {
  const out = JSON.parse(JSON.stringify(DEFAULT_PIN_STRIPS));
  if (!DB) return out;
  try {
    const d = await DB.collection('morphii_config').doc('pinStrips').get();
    if (d.exists) Object.entries(d.data()).forEach(([mm, v]) => {
      if (v && v.count >= 1 && ['column', 'zigzag', 'grid2'].includes(v.layout)) out[mm] = { count: Math.round(v.count), layout: v.layout, width: v.width >= 40 ? v.width : 84 };
    });
  } catch (e) {}
  return out;
}
async function savePinStrips(map) {
  const clean = {};
  Object.entries(map).forEach(([mm, v]) => { clean[mm] = { count: Math.max(1, Math.round(+v.count)), layout: v.layout, width: Math.max(40, Math.round(+v.width) || 84) }; });
  return DB.collection('morphii_config').doc('pinStrips').set(clean);
}
// strip order + its extra unique designs in one atomic batch (design #0 stays on the order doc)
async function submitPinStripOrder(order, uniqueDesigns) {
  if (!DB) throw new Error('Firebase not configured yet — see firebase-config.js');
  const ref = DB.collection('morphii_orders').doc(), batch = DB.batch();
  batch.set(ref, Object.assign({}, order, { status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
  uniqueDesigns.slice(1).forEach((png, i) => batch.set(ref.collection('designs').doc(String(i + 1)), { png }));
  await batch.commit();
  return ref;
}
async function getPinOrderDesigns(orderId) {
  const snap = await DB.collection('morphii_orders').doc(orderId).collection('designs').get();
  const out = {}; snap.docs.forEach(d => { out[d.id] = d.data().png; }); return out;
}

/* ── Firestore Security Rules ──────────────────
   Publish these in Firebase Console → Firestore → Rules:

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /morphii_orders/{orderId} {
         allow create: if true;
         allow read, update, delete: if request.auth != null
           && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
         // extra unique designs of a minimum-order strip (only while the order is being created)
         match /designs/{did} {
           allow create: if !exists(/databases/$(database)/documents/morphii_orders/$(orderId))
             && existsAfter(/databases/$(database)/documents/morphii_orders/$(orderId))
             && request.resource.data.keys().hasOnly(['png'])
             && request.resource.data.png is string && request.resource.data.png.size() < 900000;
           allow read, delete: if request.auth != null
             && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
         }
       }
       match /morphii_config/{docId} {
         allow read: if true;
         allow write: if request.auth != null
           && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
       }
       match /morphii_costs/{costId} {
         allow read, write: if request.auth != null
           && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
       }
       match /morphii_finance/{docId} {
         allow read, write: if request.auth != null
           && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
       }
       match /morphii_pin_templates/{templateId} {
         allow read: if true;
         allow create, update, delete: if request.auth != null
           && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
       }
       match /morphii_secrets/{docId} {
         allow read, write: if request.auth != null
           && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
       }
       match /morphii_shopee/{docId} {
         allow read, write: if request.auth != null
           && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
       }
       match /morphii_visits/{deviceId} {
         allow create, update: if true;
         allow read, delete: if request.auth != null
           && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
       }
       match /morphii_funeral_contacts/{contactId} {
         allow read, write: if request.auth != null
           && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
       }
       match /morphii_sticker_orders/{code} {
         allow create: if code.matches('S-[A-Z2-9]{6}')
           && request.resource.data.keys().hasOnly(['code','status','contactMethod','customerName','customerEmail','customerPhone','notes','productLabel','sheets','stickers','pricePerSheet','sheetTotal','premiumTotal','total','premium','settings','items','createdAt'])
           && request.resource.data.code == code
           && request.resource.data.status == 'new'
           && request.resource.data.contactMethod in ['email','phone']
           && request.resource.data.customerName is string
           && request.resource.data.customerName.size() >= 1 && request.resource.data.customerName.size() <= 80
           && request.resource.data.sheets is int && request.resource.data.sheets >= 1 && request.resource.data.sheets <= 60
           && request.resource.data.items is list && request.resource.data.items.size() <= 150;
         allow read, update, delete: if request.auth != null
           && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
         match /assets/{aid} {
           allow create: if !exists(/databases/$(database)/documents/morphii_sticker_orders/$(code))
             && existsAfter(/databases/$(database)/documents/morphii_sticker_orders/$(code))
             && request.resource.data.keys().hasOnly(['png'])
             && request.resource.data.png is string && request.resource.data.png.size() < 900000;
           allow read, delete: if request.auth != null
             && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
         }
       }
       match /morphii_funeral/{docId} {
         allow read, write: if request.auth != null
           && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
       }
       match /morphii_designers/{uid} {
         allow read: if request.auth != null
           && (request.auth.uid == uid
               || request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com']);
         allow create: if request.auth != null && request.auth.uid == uid
           && request.resource.data.keys().hasOnly(['uid','email','displayName','uploadsEver','paidListed','paidSlots','createdAt'])
           && request.resource.data.uid == uid
           && request.resource.data.uploadsEver == 0
           && request.resource.data.paidListed == 0
           && request.resource.data.paidSlots == 0
           && request.resource.data.displayName is string
           && request.resource.data.displayName.size() <= 40;
         allow update: if (request.auth != null
             && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'])
           || (request.auth != null && request.auth.uid == uid && (
               // rename
               request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName'])
               // upload #1-#5: the free lifetime points (counter can only rise by 1, with a matching sticker)
               || (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['uploadsEver','lastStickerId'])
                   && request.resource.data.uploadsEver == resource.data.uploadsEver + 1
                   && request.resource.data.uploadsEver <= 5
                   && getAfter(/databases/$(database)/documents/morphii_designer_stickers/$(request.resource.data.lastStickerId)).data.seq == request.resource.data.uploadsEver
                   && getAfter(/databases/$(database)/documents/morphii_designer_stickers/$(request.resource.data.lastStickerId)).data.designerId == uid)
               // upload #6+: needs an active pass with a free slot
               || (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['uploadsEver','lastStickerId','paidListed'])
                   && request.resource.data.uploadsEver == resource.data.uploadsEver + 1
                   && request.resource.data.uploadsEver > 5
                   && resource.data.get('paidUntil', null) != null
                   && resource.data.paidUntil > request.time
                   && request.resource.data.paidListed == resource.data.paidListed + 1
                   && request.resource.data.paidListed <= resource.data.paidSlots
                   && getAfter(/databases/$(database)/documents/morphii_designer_stickers/$(request.resource.data.lastStickerId)).data.seq == request.resource.data.uploadsEver
                   && getAfter(/databases/$(database)/documents/morphii_designer_stickers/$(request.resource.data.lastStickerId)).data.designerId == uid)
               // deleting a paid sticker frees its slot (never the lifetime counter)
               || (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['paidListed','lastDeletedId'])
                   && request.resource.data.paidListed == resource.data.paidListed - 1
                   && request.resource.data.paidListed >= 0
                   && !existsAfter(/databases/$(database)/documents/morphii_designer_stickers/$(request.resource.data.lastDeletedId))
                   && get(/databases/$(database)/documents/morphii_designer_stickers/$(request.resource.data.lastDeletedId)).data.seq > 5
                   && get(/databases/$(database)/documents/morphii_designer_stickers/$(request.resource.data.lastDeletedId)).data.designerId == uid)
             ));
         allow delete: if false;
       }
       match /morphii_designer_stickers/{sid} {
         allow read: if resource.data.status == 'approved'
           || (request.auth != null && resource.data.designerId == request.auth.uid)
           || (request.auth != null && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com']);
         allow create: if request.auth != null
           && request.resource.data.designerId == request.auth.uid
           && request.resource.data.keys().hasOnly(['designerId','designerName','name','seq','price','status','thumb','w','h','paidUntil','createdAt'])
           && request.resource.data.status == 'pending'
           && request.resource.data.price is int && request.resource.data.price >= 0 && request.resource.data.price <= 99
           && request.resource.data.name is string && request.resource.data.name.size() <= 40
           && request.resource.data.thumb is string && request.resource.data.thumb.size() < 60000
           && request.resource.data.seq == getAfter(/databases/$(database)/documents/morphii_designers/$(request.auth.uid)).data.uploadsEver
           && getAfter(/databases/$(database)/documents/morphii_designers/$(request.auth.uid)).data.uploadsEver
              == get(/databases/$(database)/documents/morphii_designers/$(request.auth.uid)).data.uploadsEver + 1
           && (request.resource.data.seq <= 5
               ? request.resource.data.paidUntil == null
               : request.resource.data.paidUntil == get(/databases/$(database)/documents/morphii_designers/$(request.auth.uid)).data.get('paidUntil', null));
         allow update: if (request.auth != null
             && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'])
           || (request.auth != null && resource.data.designerId == request.auth.uid
               && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name','price'])
               && request.resource.data.price is int && request.resource.data.price >= 0 && request.resource.data.price <= 99);
         allow delete: if request.auth != null
           && (resource.data.designerId == request.auth.uid
               || request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com']);
         match /data/{docId} {
           allow read: if (request.auth != null && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'])
             || (request.auth != null && get(/databases/$(database)/documents/morphii_designer_stickers/$(sid)).data.designerId == request.auth.uid)
             || (get(/databases/$(database)/documents/morphii_designer_stickers/$(sid)).data.status == 'approved'
                 && get(/databases/$(database)/documents/morphii_designer_stickers/$(sid)).data.price == 0);
           // only as part of creating a brand-new sticker
           allow create: if request.auth != null
             && !exists(/databases/$(database)/documents/morphii_designer_stickers/$(sid))
             && existsAfter(/databases/$(database)/documents/morphii_designer_stickers/$(sid))
             && getAfter(/databases/$(database)/documents/morphii_designer_stickers/$(sid)).data.designerId == request.auth.uid
             && request.resource.data.keys().hasOnly(['png'])
             && request.resource.data.png is string && request.resource.data.png.size() < 900000;
           allow delete: if request.auth != null
             && (get(/databases/$(database)/documents/morphii_designer_stickers/$(sid)).data.designerId == request.auth.uid
                 || request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com']);
         }
       }
       match /morphii_designer_payments/{pid} {
         allow create: if request.auth != null
           && request.resource.data.designerId == request.auth.uid
           && request.resource.data.keys().hasOnly(['designerId','designerName','slots','amount','ref','status','createdAt'])
           && request.resource.data.status == 'pending'
           && request.resource.data.slots is int && request.resource.data.slots >= 1 && request.resource.data.slots <= 2000
           && request.resource.data.amount == request.resource.data.slots
           && request.resource.data.ref is string && request.resource.data.ref.size() <= 60;
         allow read: if request.auth != null
           && (resource.data.designerId == request.auth.uid
               || request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com']);
         allow update, delete: if request.auth != null
           && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
       }
     }
   }
   ─────────────────────────────────────────────── */
