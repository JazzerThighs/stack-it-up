# Family explorer model export

Open **Export 3D model** beneath the family cube, set the nominal three-cell grid width in millimetres (60 by default), then choose **Download GLB**. The assembled cube remains centered at the origin, with glTF's metre units. Rounded surfaces and gaps can make its actual bounds smaller than the nominal grid width.

The glTF 2.0 binary file contains triangle positions, normalized surface normals, linear vertex colors, an opaque nonmetallic material, and named objects grouped by physical piece ID. Extras are named by cell. Disconnected parts of one physical piece remain in that object's mesh as separate primitives. The file embeds family/line identifiers, cell identities and provenance, assembly mode, shape and appearance settings as metadata.

Exports use the current settled geometry, including manual turns, retained cuts, model style, cubie sizing and solid identities. They wait for geometry preparation and reject a changing cube, playback, or failed graphics preparation. They do not silently export the previous displayed mesh. Camera orbit is a viewing transform and is not applied. Grid lines, labels, hover guides, shader lighting/dithering, and display transparency are omitted.

This is a model interchange export, not a slicer or a print-ready guarantee. Mesh repair, welding, unions, wall thickness, supports and conversion to manufacturing formats belong in external tools. Some display styles have disconnected or touching surfaces by design.

Implementation: `web/explorer/model-export.js` writes the GLB container directly from the existing triangle arrays. There is no renderer conversion or network dependency. `geometry-preparation.js` keeps explicit ownership alongside prepared meshes and transfers copied export arrays on demand; ordinary renders do not transfer export geometry. The synchronous compatibility path uses the same preparation owner. `exploration-mesh.js` supplies ownership at construction time rather than inferring it from surface coordinates.

Validation: `node tests/model-export.mjs` checks the container, accessor bounds, units, colors, ownership, transfer copies and state guards. `node tests/explorer-worker-smoke.mjs` exports retained geometry through a real worker, turns it, and verifies undo restores identical export bytes. The explorer suite includes both checks.
