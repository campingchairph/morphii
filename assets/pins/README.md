# Pin designer assets

Preset image library for the custom pin designer (`create.html` / `create.js`),
separate from the kiosk's own `assets/avatar/` library. Nobody can add files
here unless they're a collaborator on this repo with write access — see the
repo's top-level README/CLAUDE.md for what that means in practice.

## How it works — one step

**Push the image file to GitHub**, into the matching subfolder below. That's
it — it's automatically live in the pin designer, using the filename
(cleaned up — underscores/dashes become spaces, title-cased) as its label.
No admin action, no separate "publish" step, no code change or redeploy.

`create.js` reads each folder's contents straight from GitHub
(`api.github.com/repos/campingchairph/morphii/contents/assets/pins/<category>`)
on every page load, so it always reflects exactly what's in the repo.

## Optional: nicer labels

The default label is just the filename, cleaned up (`sticke_animals__1.png`
→ "Sticke Animals 1"). If you want a real name, open `orders-admin.html` →
**🖼 Assets** → pick the category tab → your file shows up with a thumbnail
and its current label → edit it → **Save Label**. This is a pure monitor —
it can't add or remove anything, only rename what's already live. The
override saves to Firestore (`morphii_config/assetLabels`, a simple
`{ url: "label" }` map) and applies immediately.

## Folders → in-app category

| Folder | Shows up as | Notes |
|---|---|---|
| `stickers/` | Sticker | Freely placed, resizable/rotatable; upload or choose from library |
| `shapes/` | Shapes | Decorative shape graphics; upload or choose from library |
| `holders/` | Shapes | Banners/badges meant to sit *behind* text — shares the same "Shapes" gallery as `shapes/` in-app |
| `texts/` | Word Art | Premade, non-editable text graphics (e.g. "BEST MOM") — distinct from the typed Text tool; upload or choose from library |
| `borders/` | Border | A single full-circle frame, sized to the finished cut diameter (not the paper/bleed), rotatable. Author as a **square PNG with a transparent center**. Upload or choose from library |
| `background/` | Background → Photo → Presets | Curated stock background photos, shown alongside the upload option |
| `characters/` | Character | The centered mascot/logo slot; upload or choose from library |

PNG with a transparent background is required for stickers/shapes/holders/texts/characters
so they blend into the design (same rule as customer uploads). Borders and
backgrounds should be square images.

## Where the data actually lives

- **Files**: this folder, in git, served via `raw.githubusercontent.com`.
  This is the only thing that determines what's live — GitHub write access
  is the entire access control.
- **Label overrides** (optional, cosmetic only): Firestore doc
  `morphii_config/assetLabels`, e.g.
  ```json
  { "https://raw.githubusercontent.com/.../stickers/cat.png": "Cute Cat" }
  ```
  Public read, admin-only write (same rule as `morphii_config/fonts`) — see
  `firebase-config.js` for the security rules to publish in the Firebase
  Console.
