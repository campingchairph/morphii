# Morphii security notes

There is no server: the browser talks to Firebase directly. That means **the Firestore rules (`firestore.rules`) are the
server-side validation and the access control** — page code is never the lock.

## What protects what

| Area | How |
|---|---|
| Admin data (orders, finance, secrets, designers, payments…) | Firestore rules allow only the two admin emails |
| Public order forms | Rules accept only well-formed documents: known fields, right types, size limits, `status: 'pending'`, auto-id documents; visit counter can only go up by 1 |
| Output escaping | Every admin page treats order/visit/designer data as hostile text (`escHtml`/`esc`, numbers via `num()`, status whitelisted, onclick values via `jsArg()`) |
| Passwords, sessions, reset links, login throttling | Firebase Auth (no passwords or cookies of our own) |
| Third-party scripts | Pinned versions with SRI hashes (`integrity=`); no unpinned CDN scripts |
| Clickjacking | Admin pages blank themselves if loaded inside another site |
| HTTPS | Enforced on the custom domain (GitHub Pages) |
| Secrets | Only public-by-design keys in the code (Firebase web key, EmailJS public key). The GitHub token lives in Firestore `morphii_secrets` (admin only) |
| Prices | Totals sent with a sticker order are re-checked by the admin page against the current pricing; payment itself happens on Shopee |
| Backups | Orders admin menu → "Backup data" (JSON download; never includes `morphii_secrets`) |

Not applicable here: SQL injection, CSRF, session cookies, password hashing, debug mode, npm packages (no server, no
cookies, no npm).

## When rules change

1. Edit `firestore.rules` **and** the matching comment block in `firebase-config.js` (keep them identical).
2. Firebase Console → Firestore Database → Rules → paste the whole file → Publish.
3. Retest with real orders: a pin order, a minimum-order strip order, a sticker order (3+ sheets), and reload the site
   to see the visit counter move.
4. Rules Playground should DENY: an order with `status: 'approved'`, an order with an extra field, an order whose
   `size` is text, a visit update that adds more than 1, an order created with a custom (non 20-character) id.

## Console-side settings (cannot be done from code)

- **App Check** (Firebase Console → App Check, reCAPTCHA v3): stops scripts that aren't the real site from writing
  orders. Turn on *monitoring* first, then enforce.
- **Restrict the Firebase API key** (Google Cloud Console → APIs & Services → Credentials): HTTP referrers
  `https://morphii.vows-and-petals.com/*`, `https://campingchairph.github.io/*`, and `http://localhost:*` for testing.
- **EmailJS** (Account → Security): allow only the site's domains, block headless browsers, limit emails per user.
- **GitHub**: Settings → Code security → enable secret scanning + push protection. Keep the fine-grained token limited
  to this repo (Contents: read/write) with an expiry date.
- **Firebase Auth** → Settings → Authorized domains: keep only the site's domains.
