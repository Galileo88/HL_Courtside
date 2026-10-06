# Court preview assets

These temporary PNGs were extracted from the owner's local Steam copy of Hoop Land for the Studio prototype. They are game artwork, not original Studio artwork. This change does not publish the site.

Replace these PNGs with your own images using the same filenames, canvas sizes, transparent regions, and registration. `manifest.json` records the source texture IDs and dimensions. `scripts/extract-court-assets.py` can regenerate them from the installed `data.unity3d` using UnityPy.

Surface layers are 642 × 322 and are centered at (191, 95) on the 1024 × 512 court. Each supports flat, lines, tiled, parquet, and combs. The inner-wood shape has separate pro and college versions. Transparent pixels define each region. Surface RGB supplies texture shading, multiplied by the selected color.

The outer-court and court-lines images use palette colors as region identifiers; their mappings are in `court-preview.js`. Preserve those identifiers when replacing the two images, or update the mappings. Three-point-line images use transparency as the line mask.

Court geometry, surface ordering, and hoop sprite placement come from the extracted assets and scene renderers. The hoop base, pole, and padding colors respond to their court settings. Text styling, logo size, custom overlay placement, and their ordering are provisional until checked against the running game.

The Court Overlay image preview uses the same hoop sprite renderer, so its hoops and colors match the full court preview.

The browser regression test is `tests/court-preview.test.cjs`. It requires Playwright and Microsoft Edge; `PLAYWRIGHT_MODULE` can point to an existing Playwright installation. Run with `node --test --test-isolation=none tests/court-preview.test.cjs`. It checks all 15 floor-pattern/line-style combinations, color changes, the actual editor integration, and mobile sizing.
