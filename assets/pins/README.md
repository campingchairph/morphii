# Pin designer assets

Preset image library for the custom pin designer (`create.html` / `create.js`),
separate from the kiosk's own `assets/avatar/` library. Nobody can add files
here unless they're a collaborator on this repo with write access — see the
repo's top-level README/CLAUDE.md for what that means in practice.

## How it works (two steps)

**1. Push the raw image file to GitHub.** Add it to the matching subfolder
below. This is the access-control step — only repo collaborators can do it,
so nothing gets in this folder without someone trusted pushing it.

**2. Label it in the admin page.** Open `orders-admin.html` → **🖼 Assets** →
pick the category tab → the file you just pushed shows up with a thumbnail →
type a label → **Add**. That's what actually makes it show up in the pin
designer — a file sitting in the folder unlabeled is invisible to customers.

There's no code change or redeploy for either step. The admin page reads the
folder contents straight from GitHub (so it always shows exactly what's
there), and writes labels to Firestore (`morphii_config/assets`), which
`create.js` reads at page load.

## Folders → in-app category

| Folder | Shows up as | Notes |
|---|---|---|
| `stickers/` | Sticker | Freely placed, resizable/rotatable, upload also allowed |
| `shapes/` | Shapes | Decorative shape graphics — library only, no customer upload |
| `holders/` | Shapes | Banners/badges meant to sit *behind* text — shares the same "Shapes" gallery as `shapes/` in-app, library only |
| `texts/` | Word Art | Premade, non-editable text graphics (e.g. "BEST MOM") — library only, distinct from the typed Text tool |
| `borders/` | Border | A single full-circle frame overlay, drawn above the background and below everything else. Author as a **square PNG with a transparent center**. Upload also allowed |
| `background/` | Background → Photo → Presets | Curated stock background photos, shown alongside the upload option |
| `characters/` | Character | The centered mascot/logo slot. Upload also allowed |

PNG with a transparent background is required for stickers/shapes/holders/texts/characters
so they blend into the design (same rule as customer uploads). Borders and
backgrounds should be square images.

## Where the data actually lives

- **Files**: this folder, in git, served via `raw.githubusercontent.com`.
- **Labels / which files are "in the library"**: Firestore doc
  `morphii_config/assets`, shaped like:
  ```json
  { "stickers": [{ "label": "Gold Star", "url": "https://raw.githubusercontent.com/..." }], "shapes": [...], "holders": [...], "texts": [...], "borders": [...], "background": [...], "characters": [...] }
  ```
  Public read, admin-only write (same rule as `morphii_config/fonts`) — see
  `firebase-config.js` for the security rules to publish in the Firebase
  Console.
