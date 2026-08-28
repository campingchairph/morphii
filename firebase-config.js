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

/* ── VISITOR COUNTER (morphii_visits collection) ──
   One doc per DEVICE, keyed by a random id generated once and cached in
   localStorage — so "how many visitors" means unique devices, not raw page
   loads. Doc shape:
   {
     deviceId, visitCount, firstSeen, lastSeen (server timestamps),
     country, region, city  — approximate, from a free IP-geolocation
       lookup (ipapi.co), looked up ONLY on a device's first-ever visit
       (never again for that device) to stay well inside its free-tier
       rate limit and avoid re-asking for something that rarely changes.
       Left null if the lookup fails/is blocked — the visit still counts.
   }
   Public create/update (anyone visiting writes only their own device doc,
   same trust model as morphii_orders) — admin-only read, since even
   approximate visitor locations are mildly sensitive. Called from
   create.html on load; never awaited/blocking and every failure is
   swallowed, so a Firestore or geolocation hiccup can never break the
   pin builder itself. ─────────────────────────────────────────────── */
async function recordVisit() {
  if (!DB) return;
  try {
    let deviceId = localStorage.getItem('morphii_device_id');
    const isNewDevice = !deviceId;
    if (isNewDevice) {
      deviceId = (crypto.randomUUID ? crypto.randomUUID() : 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2));
      localStorage.setItem('morphii_device_id', deviceId);
    }
    const ref = DB.collection('morphii_visits').doc(deviceId);
    if (isNewDevice) {
      let geo = {};
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          if (!data.error) geo = { country: data.country_name || null, region: data.region || null, city: data.city || null };
        }
      } catch (e) { /* geolocation lookup failed/blocked — visit still counts, just without location */ }
      await ref.set({
        deviceId, ...geo,
        firstSeen: firebase.firestore.FieldValue.serverTimestamp(),
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        visitCount: 1,
      });
    } else {
      await ref.set({
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        visitCount: firebase.firestore.FieldValue.increment(1),
      }, { merge: true });
    }
  } catch (e) { /* analytics must never break the app */ }
}

// Total unique devices — a server-side aggregate count, not a full doc
// download, so this stays cheap no matter how large the collection grows.
async function getVisitCount() {
  if (!DB) return 0;
  try {
    const snap = await DB.collection('morphii_visits').count().get();
    return snap.data().count;
  } catch (e) { return 0; }
}

// Per-device rows (most recently active first) for the admin's location
// breakdown — capped since the admin UI only ever summarizes/lists these,
// never needs the full history.
async function getRecentVisits(limit) {
  if (!DB) return [];
  try {
    const snap = await DB.collection('morphii_visits').orderBy('lastSeen', 'desc').limit(limit || 500).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
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

/* ── Firestore Security Rules ──────────────────
   Publish these in Firebase Console → Firestore → Rules:

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /morphii_orders/{orderId} {
         allow create: if true;
         allow read, update, delete: if request.auth != null
           && request.auth.token.email in ['buboyseph@gmail.com', 'morphiicreate@gmail.com'];
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
     }
   }
   ─────────────────────────────────────────────── */
