# Pin designer assets

Preset image library for the custom pin designer (`create.html` / `create.js`),
separate from the kiosk's own `assets/avatar/` library. Nobody can add files
here unless they're a collaborator on this repo with write access — see the
repo's top-level README/CLAUDE.md for what that means in practice.

## How it works

`create.js` fetches `manifest.json` from this folder at page load
(`loadPinAssetManifest()`), via `raw.githubusercontent.com` — no build step,
no redeploy needed. Each key below is a list of `{ "label": "...", "url": "..." }`
entries. Adding a new preset is just:

1. Drop the image file into the matching subfolder.
2. Add a `{ "label": ..., "url": ... }` entry for it in `manifest.json`, where
   `url` is the raw GitHub URL:
   `https://raw.githubusercontent.com/campingchairph/morphii/main/assets/pins/<folder>/<file>`
3. Commit and push. No code changes required.

## Folders → manifest keys → in-app category

| Folder | Manifest key | Shows up as | Notes |
|---|---|---|---|
| `stickers/` | `stickers` | Sticker | Freely placed, resizable/rotatable |
| `shapes/` | `shapes` | Shapes | Decorative shape graphics |
| `holders/` | `holders` | Shapes | Banners/badges meant to sit *behind* text — merged into the same "Shapes" gallery as `shapes/` |
| `texts/` | `texts` | Word Art | Premade, non-editable text graphics (e.g. "BEST MOM") — distinct from the typed Text tool |
| `borders/` | `borders` | Border | A single full-circle frame overlay, drawn above the background and below everything else. Author as a **square PNG with a transparent center** so it maps cleanly onto the round pin |
| `background/` | `background` | Background → Photo → Presets | Curated stock background photos, shown alongside the upload option |

PNG with a transparent background is required for stickers/shapes/holders/texts
so they blend into the design (same rule as customer uploads). Borders and
backgrounds should be square images.

## Not covered here

`characters/` intentionally doesn't exist — the Character slot stays
upload-only for now (no curated preset gallery).
