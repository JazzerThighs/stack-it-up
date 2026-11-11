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

## One settings dialog

Both game and explorer Settings buttons open the same modal. Its Game & shared and
Explorer cubes contexts distinguish cube-specific controls. Shared stores remain live:
changes to common appearance, input, palette and display preferences affect both apps.
Explorer controls keep their existing listeners and scoped IDs inside the dialog;
opening them does not recreate the explorer, packings, turn history or caches.
The independently opened explorer page uses its own single settings surface.
New-game confirmation remains a separate action dialog and reuses the game-rule controls.
