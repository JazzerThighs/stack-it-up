import { moveLabels } from "../engine/coordinates.js";
const $ = (id) => document.getElementById(id);
export function createMoveButtons(context) {
  const overlayButtons = [];
  const attachedNodes = [];
  const auraFaces = [
    [1, 2],
    [1, 0],
    [2, 0],
    [2, 2],
    [0, 0],
    [0, 2],
  ];
  // Stickers define moves; paired opposite turns share a cubie-centered edge ray.
  for (let faceAxis = 0; faceAxis < 3; faceAxis++)
    for (const side of [-1, 1]) {
      const u = (faceAxis + 1) % 3,
        v = (faceAxis + 2) % 3;
      for (const row of [-1, 0, 1])
        for (const col of [-1, 0, 1]) {
          const center = [0, 0, 0];
          center[faceAxis] = side * 1.5;
          center[u] = row;
          center[v] = col;
          for (const directionAxis of [u, v]) {
            if (center[directionAxis] === 0) continue; // A neighboring sticker continues this row.
            const direction = Math.sign(center[directionAxis]),
              axis = 3 - faceAxis - directionAxis;
            const slice = center[axis] === 0,
              layerSide = center[axis] > 0 ? 2 : 0;
            const tangent = [0, 0, 0];
            tangent[(axis + 1) % 3] = -center[(axis + 2) % 3];
            tangent[(axis + 2) % 3] = center[(axis + 1) % 3];
            const rotation = Math.sign(tangent[directionAxis] * direction);
            const reverse = rotation < 0 ? layerSide === 0 : layerSide !== 0;
            const face = slice
              ? 6 + axis
              : auraFaces.findIndex(([a, s]) => a === axis && s === layerSide);
            const move = face + (reverse ? 15 : 0);
            const stem = document.createElement("span");
            stem.className = "sticker-arrow-stem";
            const button = document.createElement("button");
            button.className =
              "attached-arrow cube-arrow aura-arrow sticker-arrow";
            button.style.visibility = "hidden";
            button.innerHTML =
              '<span class="arrow-vector">➜</span><small></small>';
            button.dataset.move = move;
            button.addEventListener("pointerenter", () => {
              context.renderers[0].arrowHover = +button.dataset.move;
              context.invalidate();
            });
            button.addEventListener("pointerleave", () => {
              context.renderers[0].arrowHover = null;
              context.invalidate();
            });
            button.addEventListener("focus", () => {
              context.renderers[0].arrowHover = +button.dataset.move;
              context.invalidate();
            });
            button.addEventListener("blur", () => {
              context.renderers[0].arrowHover = null;
              context.invalidate();
            });
            button.onclick = (e) => {
              let m = +button.dataset.move;
              if (!slice && (e.shiftKey || e.altKey || context.renderers[0]?.wideTurns) && m % 15 < 6) m += 9;
              context.play(m);
            };
            $("cubeMoves").append(stem, button);
            overlayButtons.push(button);
            const cubie = center.slice();
            cubie[faceAxis] = side;
            const tip3 = cubie.slice();
            tip3[faceAxis] += side * 0.9;
            tip3[directionAxis] += direction * 0.9;
            attachedNodes.push({
              button,
              stem,
              center,
              cubie,
              tip3,
              faceAxis,
              side,
              directionAxis,
              direction,
              axis,
              slice,
              move,
            });
          }
        }
    }
  function cubeSilhouette(project) {
    const points = [];
    for (const x of [-1.5, 1.5])
      for (const y of [-1.5, 1.5])
        for (const z of [-1.5, 1.5]) points.push(project([x, y, z]));
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (a, b, c) =>
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const half = (ps) => {
      const h = [];
      for (const p of ps) {
        while (h.length > 1 && cross(h[h.length - 2], h[h.length - 1], p) <= 0)
          h.pop();
        h.push(p);
      }
      h.pop();
      return h;
    };
    return [...half(points), ...half(points.slice().reverse())];
  }
  function insideCubeSilhouette(p, hull) {
    return hull.every((a, i) => {
      const b = hull[(i + 1) % hull.length];
      return (
        (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-8
      );
    });
  }
  function layoutCubeControls(width, height, unit, project) {
    const hull = cubeSilhouette(project);
    const wide = !!context.renderers[0]?.wideTurns;
    for (const node of attachedNodes) {
      const {
        button,
        stem,
        cubie,
        tip3,
        faceAxis,
        side,
        directionAxis,
        direction,
        slice,
      } = node;
      const normal = [0, 0, 0];
      normal[faceAxis] = side;
      const facing = project(normal)[2];
      const exitNormal = [0, 0, 0];
      exitNormal[directionAxis] = direction;
      const exitFacing = project(exitNormal)[2];
      const tip = project(tip3);
      // A paired button is the other side of the same coin, never a second target.
      // Exit through a front-facing face is hidden even if its projection misses the cube.
      const visible =
        facing > 0.01 && exitFacing < -0.01 && !insideCubeSilhouette(tip, hull);
      node.layout = null;
      button.style.visibility = visible ? "visible" : "hidden";
      stem.style.visibility =
        visible && $("arrowGuides").checked ? "visible" : "hidden";
      button.style.pointerEvents = visible ? "auto" : "none";
      button.tabIndex = visible ? 0 : -1;
      if (!visible) continue;
      const origin = project(cubie),
        dx = (tip[0] - origin[0]) * unit,
        dy = -(tip[1] - origin[1]) * unit;
      const angle = Math.atan2(dy, dx),
        length = Math.hypot(dx, dy),
        x = width / 2 + tip[0] * unit,
        y = height / 2 - tip[1] * unit;
      const move = node.move + (wide && !slice ? 9 : 0),
        opacity = Math.min(
          1,
          Math.max(0, Math.min(facing, -exitFacing)) / 0.16,
        );
      node.layout = { x, y, move };
      button.dataset.move = move;
      button.style.left = `${x}px`;
      button.style.top = `${y}px`;
      button.style.opacity = opacity;
      button.querySelector(".arrow-vector").style.transform =
        `rotate(${angle}rad)`;
      stem.style.left = `${width / 2 + origin[0] * unit}px`;
      stem.style.top = `${height / 2 - origin[1] * unit}px`;
      stem.style.width = `${Math.max(0, length - 9)}px`;
      stem.style.transform = `rotate(${angle}rad)`;
      stem.style.opacity = opacity;
      const label = moveLabels[move % 15] + (move >= 15 ? "′" : "");
      button.querySelector("small").textContent = label;
      button.title = label + (slice ? " — slice" : " — Alt-click for wide");
      button.setAttribute(
        "aria-label",
        label +
          (context.state?.[67] & (1 << move)
            ? " — places the current piece"
            : ""),
      );
      button.classList.toggle("winning", false);
      button.disabled =
        context.busy || !!context.state?.[66] || !!context.state?.[78];
    }
  }

  return { overlayButtons, attachedNodes, layoutCubeControls };
}
