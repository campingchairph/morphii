"""Builds small WebP thumbnails of every library asset so the pickers never download the full files.

  assets/pins/<path>/<name>.<ext>   ->   assets/pins-opt/thumb/<path>/<name>.<ext>.webp   (max 256px)

The designer (create.js / stickers.js) maps an asset URL to its thumbnail URL and falls back to the
original if a thumbnail doesn't exist yet, so running this is optional for new uploads (the admin
"Add assets" page also creates a thumbnail at upload time) — but a bulk upload can be caught up with:

    python tools/make-thumbs.py          # only creates the missing ones
    python tools/make-thumbs.py --force  # rebuild everything
"""
import os, sys
from multiprocessing import Pool
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'assets', 'pins')
DST = os.path.join(ROOT, 'assets', 'pins-opt', 'thumb')
EXT = ('.png', '.jpg', '.jpeg', '.webp', '.gif')
MAX_SIDE = 256
FORCE = '--force' in sys.argv


def work(path):
    rel = os.path.relpath(path, SRC)
    out = os.path.join(DST, rel + '.webp')
    if not FORCE and os.path.exists(out):
        return 'skip'
    try:
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with Image.open(path) as im:
            if im.format == 'JPEG':
                im.draft('RGB', (MAX_SIDE * 2, MAX_SIDE * 2))   # decode JPEGs at reduced size
            im.load()
            has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
            im = im.convert('RGBA' if has_alpha else 'RGB')
            im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            im.save(out, 'WEBP', quality=78, method=4)
        return 'ok'
    except Exception as e:
        return 'fail %s: %s' % (rel, e)


if __name__ == '__main__':
    files = []
    for d, _, names in os.walk(SRC):
        for n in names:
            if n.lower().endswith(EXT):
                files.append(os.path.join(d, n))
    print(len(files), 'images')
    done = fail = skipped = 0
    with Pool(max(2, (os.cpu_count() or 4) - 1)) as pool:
        for i, r in enumerate(pool.imap_unordered(work, files, chunksize=4), 1):
            if r == 'ok': done += 1
            elif r == 'skip': skipped += 1
            else: fail += 1; print(r)
            if i % 100 == 0: print(i, '/', len(files), flush=True)
    print('created', done, 'skipped', skipped, 'failed', fail)
