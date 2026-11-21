# Cultivating startup defaults

Edit `createStartupDefaults()` in `web/ui/startup-defaults.js`.
It runs once when the application modules load, before stored preferences are read.
The game and explorer apply their own control defaults before starting their controllers.
Opening settings, switching apps, or wrapping an existing explorer never reapplies them.

| Group | What to customize |
| --- | --- |
| `appearance` | Lighting, Jelly/Tengen tuning, cubie scale, ASCII, dithering and transparency tuning |
| `palette` | Piece-letter to hex-color mapping |
| `display` | Assembly and size for game active/stack, family, practice start and target cubes; UI theme |
| `controls`, `orbit` | Shared input, feedback, camera and mouse settings |
| `game` | Game rules, queue pool, game model/effect, transparency, grids and hints |
| `explorer` | Initial filter ranges, mode, explorer model/effect, colors, transparency and visible cubes |
| `layerOrder` | Rendering layers, front to back; keep each layer exactly once |

For example, change `appearance.cubieScale` from `100` to `80`,
`game.modelShape` to `gameboy`, or `explorer.countMinO` to `2`.
Edit the corresponding literal inside the function; do not add calls to UI setters.
Appearance switches use numeric 0/1, ordinary switches use booleans,
and selects use their option values. The schema files list legal choices and ranges.

Saved preferences override these defaults. Preference-reset buttons use the curated
values. A restored/shared puzzle still restores its own rules and state. Reduced-motion
preferences can disable animations. An explicit classic-collection URL overrides the
initial dataset. Commands such as selecting a filter preset or resetting filters keep
their stated behavior; they are not startup-default application.

No settings regeneration is required just to change this function. Rebuild with
`npm run build` to update the running `dist` application. Run `npm run test:settings`
to check the configuration. Schemas still own control labels, validation and generated
HTML; a newly added schema field falls back to its schema default until you add an
override to this function.

## Tests do not prescribe your preferences

Startup, fallback and reset tests compare against the curated defaults, including
palette colors. They validate supported keys, types and values, not a particular
choice of color, effect, camera, size or game rule. `tests/defaults-customization.mjs`
runs those contracts with alternate preferences in isolated processes and is part
of the settings CI suite. It does not edit your defaults file.

Gameplay, input and rendering scenarios import `tests/fixtures/behavior-defaults.mjs`
before loading application modules. Its JSON profile supplies explicit, repeatable
test inputs; it is not the product default policy. Built-app smoke tests apply it to
their own module instances. The real-browser test serves that profile from its local
test server without modifying `dist` or the published application. When adding a
scenario, explicitly configure any required settings rather than assuming the user's
startup choices. Keep startup-policy tests separate from this scenario fixture.

## One settings dialog

Both game and explorer Settings buttons open the same modal. Its Game & shared and
Explorer cubes contexts distinguish cube-specific controls. Shared stores remain live:
changes to common appearance, input, palette and display preferences affect both apps.
Explorer controls keep their existing listeners and scoped IDs inside the dialog;
opening them does not recreate the explorer, packings, turn history or caches.
The independently opened explorer page uses its own single settings surface.
New-game confirmation remains a separate action dialog and reuses the game-rule controls.

## Cube appearance palettes

Settings > Cube Appearances groups Active (Game), Stack (Game), Family Explorer, Start Cube (2 Packing), and Target Cube (2 Packing). Each page has a Color palette selector above the composition controls. Presets are authored in web/render/palette-presets.js; individual color edits show Custom. Selecting a preset affects only that view and is saved with its appearance profile. Standard Tetris is the startup palette; saved preferences still take precedence.

Piece color swatches sit directly below each view palette selector, followed
by Extra Corners, Extra Edges, Extra Centers and Extra Core. The shared
`appearance.extraCornerColor`, `extraEdgeColor`, `extraCenterColor` and
`extraCoreColor` defaults in startup-defaults.js are white, white, black and
grey respectively. Each view can override these independently. Presets affect
piece colors only; Reset this view restores authored extra-color defaults.
Old saved profiles inherit missing extra-color fields, while historical extra
color markers in packing data no longer override type-based rendering.

## Bluetooth gesture timing

`controls.bluetoothSliceWindow` and `controls.bluetoothWideWindow` in
startup-defaults.js set the authored slice-pairing and gyro-assisted wide-turn
completion windows in milliseconds. Saved controls override these values;
each Bluetooth timing slider has its own reset button. Zero disables the
corresponding recognizer. Timing changes recognition latency, not animation
speed; `controls.turnAnimationSpeed` remains independent. See BLUETOOTH.md for
direction rules, gyro tolerance, timing tradeoffs and physical validation.

## Stable setting IDs for menu design

Every authored setting has an end-of-line `SID` comment in `startup-defaults.js`. Use these numbers to describe menu layouts; see [the complete setting ID index](SETTING_IDS.md). IDs in the 90000+ range are legacy-only or have no modern behavior. Hidden controls that still seed modern views retain normal IDs. Keep IDs stable when reordering settings or changing defaults.
