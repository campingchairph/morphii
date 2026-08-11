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

You don't need git for this — `orders-admin.html` → **📦 Add Assets** lets
an admin paste an image straight from their clipboard and push it to the
right folder from the browser (Stickers, Background, or Shape; Stickers
asks which subfolder/category, Background and Shape don't). Manually
committing the file yourself works exactly the same, if you'd rather.

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
| `stickers/` | Sticker | Freely placed, resizable/rotatable; upload or choose from library. Organize into subfolders by type — see below |
| `shapes/` | Shapes | Decorative shape graphics; upload or choose from library |
| `holders/` | Shapes | Banners/badges meant to sit *behind* text — shares the same "Shapes" gallery as `shapes/` in-app |
| `texts/` | Word Art | Premade, non-editable text graphics (e.g. "BEST MOM") — distinct from the typed Text tool; upload or choose from library |
| `borders/` | Border | A single full-circle frame, sized to the finished cut diameter (not the paper/bleed), rotatable. Author as a **square PNG with a transparent center**. Upload or choose from library |
| `background/` | Background → Photo → Presets | Curated stock background photos, shown alongside the upload option |
| `characters/` | Character | The centered mascot/logo slot; upload or choose from library |
| `letters/` | Letters | Freely placed alphabet graphics, grouped by design set; see below |

PNG with a transparent background is required for stickers/shapes/holders/texts/characters/letters
so they blend into the design (same rule as customer uploads). Borders and
backgrounds should be square images.

### Letters — filename convention

Letters files just need to **start with** `<designNumber>_<LETTER>` (e.g.
`1_A.png`, `1__A-01.png`, `2_A-anything.png` — one or two underscores both
work). The number groups a full alphabet into one "design set" (font/style);
the letter is which character it is; whatever comes after that (a variant
tag like `-01`, extra text, or nothing at all) is ignored, so there's no
required suffix format. In the picker, customers first see one thumbnail per
design set (always that set's `A`), then tap one to see its full available
alphabet and pick the letter they actually want. A design set doesn't need
to cover the whole alphabet — whatever letters exist for that number are
what shows up.

### Stickers — subfolders as categories

Drop stickers straight into `stickers/` and they show up ungrouped under
"Other". To organize them, push into **one level** of subfolder instead —
`stickers/animals/cat.png`, `stickers/animals/dog.png`,
`stickers/food/pizza.png`, etc. Each subfolder becomes a category in the
picker: customers first see one thumbnail per category, then tap in to see
everything inside it — same two-step browsing as Letters above. An empty
subfolder (or one that doesn't exist yet) just doesn't show up; nothing to
configure. Deeper nesting (a subfolder inside a subfolder) isn't supported.

**Category thumbnail**: by default the category's thumbnail is whichever
file happens to sort first in that folder. To pick deliberately, push a
file literally named `logo` (any image extension — `logo.png`, `logo.jpg`,
etc.) into the subfolder — that one becomes the thumbnail regardless of
sort order, e.g. `stickers/animals/logo.png`. It still shows up as a
regular pickable sticker inside the category too, it's just also used as
the cover image.

## Isolated pin types

**Election Pins**, **Philippine Souvenir Pins**, **Wedding Pins**, and
**In Loving Memory** (funeral memorabilia) pins don't draw from the shared
folders above at all — each has its own separate set, under a subfolder
named for the product:

```
assets/pins/election/{stickers,shapes,holders,texts,borders,background,characters,letters}/
assets/pins/ph-souvenir/{stickers,shapes,holders,texts,borders,background,characters,letters}/
assets/pins/wedding/{stickers,shapes,holders,texts,borders,background,characters,letters}/
assets/pins/in-loving-memory/{stickers,shapes,holders,texts,borders,background,characters,letters}/
```

Same category names, same rules (transparent PNG, square borders/
backgrounds, etc.) — just push into the matching product's subfolder instead
of the top-level one. Stickers subfolders support one level of category
nesting here too (e.g. `assets/pins/in-loving-memory/stickers/doves/`), same
as the shared library above. A file in `assets/pins/election/stickers/` only
shows up as a Sticker option when a customer is designing an Election pin;
it never appears for Lapel Pins, Wedding Pins, or any other product, and
vice versa. These folders start out empty (with a `.gitkeep` placeholder so
git tracks them) — nothing shows in the picker for these products until real
files are pushed in. Customers can still upload their own image regardless
of what's in the library.

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
