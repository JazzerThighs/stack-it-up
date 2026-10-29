import {initializePaletteControls} from './palette-controls.js';
import {subscribePalette} from '../render/palette.js';
import {initializeVisualControls} from "./visual-controls.js";
const $ = (id) => document.getElementById(id);
let context;
const defaultLayers = [
  ["arrows", "Arrow buttons"],
  ["arrowGuides", "Arrow guide lines"],
  ["labels", "Face letters"],
  ["dragArrows", "Ring move letters & direction marks"],
  ["hoverOutline", "Affected cubie silhouettes"],
  ["slices", "Hovered slice rings"],
  ["hints", "Placement markers"],
  ["choice", "Placement choice outline"],
  ["recent", "Last placed piece ghost"],
  ["overlaps", "Overlap marks"],
  ["outlines", "Active cubie outlines"],
  ["grid", "Cube grids"],
  ["centers", "Active centers"],
  ["floating", "White floating fragments"],
  ["active", "Active cubies"],
  ["stack", "Placed stack"],
  ["empty", "Empty cells"],
];
export let layerOrder = defaultLayers.map(([id]) => id);
export function renderLayerSettings(focusId = null) {
  const custom = $("customLayers").checked;
  const list = $("renderLayers");
  list.setAttribute("aria-disabled", String(!custom));
  const rows = layerOrder.map((id, index) => {
    const row = document.createElement("li"),
      name = document.createElement("span");
    name.textContent = defaultLayers.find((p) => p[0] === id)[1];
    row.append(name);
    for (const [delta, label] of [
      [-1, "Up"],
      [1, "Down"],
    ]) {
      const b = document.createElement("button");
      b.textContent = label === "Up" ? "↑" : "↓";
      b.setAttribute(
        "aria-label",
        `Move ${name.textContent} ${label.toLowerCase()}`,
      );
      b.disabled =
        !custom || index + delta < 0 || index + delta >= layerOrder.length;
      b.onclick = () => {
        const next = index + delta;
        [layerOrder[index], layerOrder[next]] = [
          layerOrder[next],
          layerOrder[index],
        ];
        renderLayerSettings(id);
        $("layerOrderStatus").textContent =
          `${name.textContent}: position ${next + 1}`;
        context.invalidate();
      };
      row.append(b);
      if (focusId === id && !b.disabled) requestAnimationFrame(() => b.focus());
    }
    return row;
  });
  list.replaceChildren(...rows);
}
export function initializeSettings(value) {
  context = value;
  initializePaletteControls();
  initializeVisualControls(document,()=>context.invalidate());
  subscribePalette(() => {
    for (const r of context.renderers) r.stackEvent = null;
    context.invalidateMesh();
    if (context.state) context.update();
  });
  $("customLayers").onchange = () => {
    renderLayerSettings();
    context.invalidate();
  };
  $("resetLayers").onclick = () => {
    layerOrder = defaultLayers.map(([id]) => id);
    $("customLayers").checked = false;
    renderLayerSettings();
    context.invalidate();
  };
  renderLayerSettings();
  for (const id of [
    "pieceAppearance",
    "perspectiveCamera",
    "activeSpheres",
    "hoverOutline",
    "hoverRings",
    "ringLabels",
    "placementGlow",
    "rearGridOnly",
    "arrowGuides",
    "activeOutlines",
    "controlGrid",
    "stackGrid",
    "combinedGrid",
    "activeTransparency",
    "centerTransparency",
    "stackTransparency",
  ])
    $(id).addEventListener("input", syncDisplaySettings);
  context.animations.addEventListener("change", syncDisplaySettings);
}
export function syncDisplaySettings() {
  for (const r of context.renderers) {
    const appearance = $("pieceAppearance").value || "jelly";
    r.canvas.dataset.appearance = appearance;
    if (r.appearance !== appearance) {
      r.appearance = appearance;
      r.stackEvent = null;
      if (r.sourceMesh) r.setMesh(r.sourceMesh);
    }
    r.perspective = $("perspectiveCamera").checked;
    const shapeChanged = r.activeSpheres !== $("activeSpheres").checked;
    r.activeSpheres = $("activeSpheres").checked;
    if (shapeChanged && r.state) r.setState(r.state, r.animation);
    r.rearGridOnly = $("rearGridOnly").checked;
    r.gridKey = null;
    r.activeOutlines = $("activeOutlines").checked;
    r.breathing = context.animations.checked;
    r.controlGrid = $("controlGrid").checked;
    r.stackGrid = $("stackGrid").checked;
    r.combinedGrid = $("combinedGrid").checked;
    r.activeOpacity = 1 - Number($("activeTransparency").value) / 100;
    r.centerOpacity = 1 - Number($("centerTransparency").value) / 100;
    r.stackOpacity = 1 - Number($("stackTransparency").value) / 100;
  }
  for (const name of ["active", "center", "stack"])
    $(name + "TransparencyValue").textContent =
      $(name + "Transparency").value + "%";
  context.invalidate();
}
