# Packing dataset source and build

The repository owns the complete dataset. `../results.7z` is the source archive; `source.json` pins its SHA-256 checksum and five required members. Keep both tracked with the app. Both collections use this database. Classic Collection filters to packings with no B, D or F pieces; it is not a separate dataset.

`npm run build` automatically runs `tools/build-packing-data.mjs`. Install 7-Zip first: Windows builds recognize `C:\Program Files\7-Zip\7z.exe`; Linux CI installs `p7zip-full`. Alternatively put `7z` or `7zz` on PATH, or set `SEVEN_ZIP` to the executable path.

The converter verifies the archive and extracts only the five expected files. It validates all 1,871,891 records against the piece catalog, metadata and 2,605 family memberships. It initially writes `dist/explorer/data/manifest.json`, a compressed binary filter index, and compressed per-family records. Release packaging moves these assets into `dist/assets/<build-version>/explorer/data/`, leaving only one dataset copy in the published output. Use `dist/build-info.json` to locate the current release. The manifest records sizes and SHA-256 hashes. The app loads these assets from its own versioned build directory, with no external dataset service.

Extraction and conversion are cached in ignored `.packing-cache/`, keyed by both archive and compiler hashes. The first build requires extraction space and takes longer; subsequent builds reuse verified converted data. Do not commit this cache, expanded CSV/text sources, or `dist`. Commit the source archive, source manifest, converter and application changes. GitHub Pages builds generate the assets automatically.

Run `node tools/verify-data-source.mjs` to check source identity. After building, `node tests/packing-data.mjs` validates every generated member, filter behavior, official reference, practice compatibility, and screw handedness. It is also included in `npm test` and Pages CI.

The browser filter index uses 20 bytes per packing. Family records use 16 bytes per packing and are loaded on demand. All source-line IDs belong to the `tetracubes-v2` dataset, including in Classic Collection. Historical classic source-line numbers are no longer supported. Copied packing references include the dataset and version.
