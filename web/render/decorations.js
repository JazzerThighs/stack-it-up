import {activeCubie} from './active-cubie.js';
import {CAMERA_DISTANCE} from "./camera.js";
import { S } from "../engine/snapshot.js";
import {
  colors,
  faceLabels,
  faces,
  xyz,
  rgb,
  box,
  wire,
  surfaceGrid,
  cubieShape,
  balloon,
  rotateCell,
  overlapMarks,
} from "./geometry.js";
import { CubeStack, moveLabels } from "../engine/coordinates.js";
import { stickerCenter, sliceCandidates } from "../input/drag.js";
const $ = (id) => document.getElementById(id);
export function sceneDecorations(add, unit, context) {
  const { state, busy, engine, animations, layerOrder, attachedNodes } =
    context;
  const gl = this.gl,
    sets = new Map(),
    push = (id, data, opacity = 1) => {
      if (!data.length) return;
      const slot = sets.get(id) || 0;
      sets.set(id, slot + 1);
      const key = id + ":" + slot;
      let b = this.decorBuffers[key];
      if (!b) b = this.decorBuffers[key] = this.buffer();
      this.upload(b, new Float32Array(data));
      add(id, b, gl.TRIANGLES, opacity, true);
    };
  const inverse = (v) => {
    const m = this.orientation;
    return [0, 1, 2].map(
      (i) => m[i * 3] * v[0] + m[i * 3 + 1] * v[1] + m[i * 3 + 2] * v[2],
    );
  };
  const offset = (p, x, y) => {
    const factor=this.perspective ? 1-this.project(p)[2]/CAMERA_DISTANCE : 1;
    const d = inverse([x / unit * factor, y / unit * factor, 0]);
    return p.map((v, i) => v + d[i]);
  };
  const segment = (out, a, b, color, width = 2) => {
    const pa = this.project(a),
      pb = this.project(b),
      dx = pb[0] - pa[0],
      dy = pb[1] - pa[1],
      len = Math.hypot(dx, dy);
    if (len < 1e-8) return;
    const factor=this.perspective ? 1-(pa[2]+pb[2])/2/CAMERA_DISTANCE : 1;
    const d = inverse([
      ((-dy / len) * width) / 2 / unit * factor,
      ((dx / len) * width) / 2 / unit * factor,
      0,
    ]);
    const q = [
      a.map((v, i) => v + d[i]),
      b.map((v, i) => v + d[i]),
      b.map((v, i) => v - d[i]),
      a.map((v, i) => v - d[i]),
    ];
    for (const i of [0, 1, 2, 0, 2, 3]) out.push(...q[i], 0, 0, 1, ...color);
  };
  const glyphs = {
    U: [
      [-0.4, 0.5, -0.4, -0.35],
      [-0.4, -0.35, 0, -0.5],
      [0, -0.5, 0.4, -0.35],
      [0.4, -0.35, 0.4, 0.5],
    ],
    D: [
      [-0.4, -0.5, -0.4, 0.5],
      [-0.4, 0.5, 0.2, 0.5],
      [0.2, 0.5, 0.45, 0.25],
      [0.45, 0.25, 0.45, -0.25],
      [0.45, -0.25, 0.2, -0.5],
      [0.2, -0.5, -0.4, -0.5],
    ],
    F: [
      [-0.35, -0.5, -0.35, 0.5],
      [-0.35, 0.5, 0.4, 0.5],
      [-0.35, 0, 0.25, 0],
    ],
    B: [
      [-0.4, -0.5, -0.4, 0.5],
      [-0.4, 0.5, 0.2, 0.5],
      [0.2, 0.5, 0.4, 0.25],
      [0.4, 0.25, 0.2, 0],
      [0.2, 0, -0.4, 0],
      [0.2, 0, 0.4, -0.25],
      [0.4, -0.25, 0.2, -0.5],
      [0.2, -0.5, -0.4, -0.5],
    ],
    R: [
      [-0.4, -0.5, -0.4, 0.5],
      [-0.4, 0.5, 0.2, 0.5],
      [0.2, 0.5, 0.4, 0.25],
      [0.4, 0.25, 0.2, 0],
      [0.2, 0, -0.4, 0],
      [0, 0, 0.45, -0.5],
    ],
    L: [
      [-0.35, 0.5, -0.35, -0.5],
      [-0.35, -0.5, 0.4, -0.5],
    ],
  };
  const labels = [];
  const faceLabelSize = Math.min(26, Math.max(12, unit * 0.65));
  for (let f = 0; f < 6; f++) {
    const [axis, side] = faces[f],
      p = [0, 0, 0];
    p[axis] = (side - 1) * 1.85;
    if (this.project(p)[2] < 0.03) continue;
    for (const [x, y, a, b] of glyphs[faceLabels[f]])
      segment(
        labels,
        offset(p, x * faceLabelSize, y * faceLabelSize),
        offset(p, a * faceLabelSize, b * faceLabelSize),
        [1, 1, 1],
        3,
      );
  }
  push("labels", labels);
  if (this.isStack || !state) return;
  const slices = [],
    arrows = [],
    stems = [],
    buttons = [],
    hints = [];
  if (
    !busy &&
    !state[S.OVER] &&
    !state[S.PENDING_FACES] &&
    !this.orbitDragging &&
    this.hover &&
    $("hoverRings").checked
  ) {
    const { hit, wide } = this.hover,
      center = stickerCenter(hit);
    for (const c of sliceCandidates(this, hit, wide)) {
      const a = (c.axis + 1) % 3,
        b = (c.axis + 2) % 3,
        radius = 2.2,
        point = (angle) => {
          const p = [0, 0, 0];
          p[c.axis] = c.wide ? (c.layer === 0 ? -0.5 : 0.5) : c.layer - 1;
          p[a] = Math.cos(angle) * radius;
          p[b] = Math.sin(angle) * radius;
          return p;
        };
      for (let i = 0; i < 96; i++)
        segment(
          slices,
          point((i * Math.PI) / 48),
          point(((i + 1) * Math.PI) / 48),
          [0.72, 0.84, 0.93],
          2,
        );
      if ($("ringLabels").checked) {
        glyphs.M = [
          [-0.45, -0.5, -0.45, 0.5],
          [-0.45, 0.5, 0, -0.1],
          [0, -0.1, 0.45, 0.5],
          [0.45, 0.5, 0.45, -0.5],
        ];
        glyphs.E = [
          [-0.4, -0.5, -0.4, 0.5],
          [-0.4, 0.5, 0.4, 0.5],
          [-0.4, 0, 0.3, 0],
          [-0.4, -0.5, 0.4, -0.5],
        ];
        glyphs.S = [
          [0.4, 0.5, -0.4, 0.5],
          [-0.4, 0.5, -0.4, 0],
          [-0.4, 0, 0.4, 0],
          [0.4, 0, 0.4, -0.5],
          [0.4, -0.5, -0.4, -0.5],
        ];
        const axisA = [0, 0, 0],
          axisB = [0, 0, 0];
        axisA[a] = 1;
        axisB[b] = 1;
        const front = Math.atan2(
          this.project(axisB)[2],
          this.project(axisA)[2],
        );
        for (const reverse of [false, true]) {
          const angle = front + (reverse ? 0.38 : -0.38),
            p = point(angle),
            label = moveLabels[c.base],
            size = c.base >= 9 ? 14 : 18;
          for (const [x, y, u, v] of glyphs[label.toUpperCase()])
            segment(
              arrows,
              offset(p, x * size, y * size),
              offset(p, u * size, v * size),
              [0.95, 0.98, 1],
              2,
            );
          if (reverse)
            segment(
              arrows,
              offset(p, 11, 12),
              offset(p, 8, 6),
              [0.95, 0.98, 1],
              2,
            );
          const sign = c.baseSign * (reverse ? -1 : 1),
            q = point(angle + sign * 0.15),
            tip = point(angle + sign * 0.23);
          segment(arrows, q, tip, [0.85, 0.94, 1], 2);
          const qp = this.project(q),
            tp = this.project(tip),
            len = Math.hypot(tp[0] - qp[0], tp[1] - qp[1]),
            dx = (tp[0] - qp[0]) / len,
            dy = (tp[1] - qp[1]) / len;
          for (const side of [-1, 1])
            segment(
              arrows,
              tip,
              offset(tip, -dx * 5 + dy * side * 3, -dy * 5 - dx * side * 3),
              [0.85, 0.94, 1],
              2,
            );
        }
      }
    }
  }
  push("slices", slices, 0.65);
  push("dragArrows", arrows, 0.9);
  if ($("showArrows").checked)
    for (const node of attachedNodes) {
      if (!node.layout) continue;
      const p = node.tip3,
        a = this.project(node.cubie),
        b = this.project(p),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        dx = (b[0] - a[0]) / len,
        dy = (b[1] - a[1]) / len;
      segment(
        buttons,
        offset(p, -dx * 15, -dy * 15),
        offset(p, dx * 15, dy * 15),
        [0.85, 0.93, 0.96],
        5,
      );
      for (const sign of [-1, 1])
        segment(
          buttons,
          offset(p, dx * 15, dy * 15),
          offset(p, dx * 3 + dy * sign * 11, dy * 3 - dx * sign * 11),
          [0.85, 0.93, 0.96],
          5,
        );
      if ($("arrowGuides").checked)
        segment(stems, node.cubie, p, [0.7, 0.8, 0.85], 1);
    }
  push("arrows", buttons);
  push("arrowGuides", stems, 0.5);
  if (
    !busy &&
    !state[S.OVER] &&
    !state[S.PENDING_FACES] &&
    !this.orbitDragging &&
    $("placementGlow").checked
  ) {
    let moves = [];
    if (this.arrowHover != null) moves = [this.arrowHover];
    else if (this.hover)
      for (const c of sliceCandidates(this, this.hover.hit, this.hover.wide))
        moves.push(c.base, c.base + 15);
    const key = state[S.REVISION] + ":" + moves.join(",");
    if (this.hintKey !== key) {
      this.hintKey = key;
      this.hintPieces = engine.placement_previews(moves);
    }
    let mask = 0;
    for (const piece of this.hintPieces || []) mask |= piece.sourceMask;
    // A 24-segment marker replaces three tessellated meshes per cubie.
    for (let i = 0; i < 27; i++) if (mask & (1 << i)) {
      const p = xyz(i), opacity = p.filter(v => v !== 0).length === 1 ? this.centerOpacity : this.activeOpacity;
      if (opacity <= 0) continue;
      const front = inverse([0, 0, .46]).map((v, axis) => v + p[axis]);
      const radius = .43 * unit;
      for (let j = 0; j < 24; j++) {
        const a = j * Math.PI / 12, b = (j + 1) * Math.PI / 12;
        segment(hints, offset(front, Math.cos(a)*radius, Math.sin(a)*radius),
          offset(front, Math.cos(b)*radius, Math.sin(b)*radius), [.56, 1, .78], 2.5);
      }
    }
  }
  push("hints", hints, .85);
  if (
    !busy &&
    !state[S.OVER] &&
    !state[S.PENDING_FACES] &&
    !this.orbitDragging &&
    $("hoverOutline").checked
  ) {
    let moves = [];
    if (this.arrowHover != null) moves = [this.arrowHover];
    else if (this.hover)
      for (const c of sliceCandidates(this, this.hover.hit, this.hover.wide))
        moves.push(c.base);
    const outline = [],
      mask = state[S.ACTIVE] | state[S.FLOATING],
      breath = this.breathing
        ? 0.90 + 0.14 * Math.sin((performance.now() * Math.PI * 2) / 3200)
        : 1;
    for (let i = 0; i < 27; i++)
      if (mask & (1 << i)) {
        const p = xyz(i),
          cell = CubeStack.xyz(i);
        if (
          !moves.some((m) => {
            const [, axis, layer, side] = CubeStack.moves[m % 15];
            return layer === "wide"
              ? cell[axis] !== 2 - side
              : cell[axis] === layer;
          })
        )
          continue;
        const opacity =
          p.filter((v) => v !== 0).length === 1 &&
          !(state[S.FLOATING] & (1 << i))
            ? this.centerOpacity
            : this.activeOpacity;
        if (opacity <= 0) continue;
        const geometry = [];
        activeCubie(
          geometry,
          p,
          0.438 * breath,
          [1, 1, 1],i,state,this,
        );
        const unique = new Map();
        for (let j = 0; j < geometry.length; j += 9) {
          const world = geometry.slice(j, j + 3),
            q = this.project(world),
            key = q[0].toFixed(7) + "," + q[1].toFixed(7);
          if (!unique.has(key) || unique.get(key).q[2] < q[2])
            unique.set(key, { q, world });
        }
        const points = [...unique.values()].sort(
            (a, b) => a.q[0] - b.q[0] || a.q[1] - b.q[1],
          ),
          cross = (a, b, c) =>
            (b.q[0] - a.q[0]) * (c.q[1] - a.q[1]) -
            (b.q[1] - a.q[1]) * (c.q[0] - a.q[0]);
        const half = (ps) => {
          const h = [];
          for (const p of ps) {
            while (
              h.length > 1 &&
              cross(h[h.length - 2], h[h.length - 1], p) <= 0
            )
              h.pop();
            h.push(p);
          }
          h.pop();
          return h;
        };
        const hull = [...half(points), ...half(points.slice().reverse())];
        for (let j = 0; j < hull.length; j++)
          segment(
            outline,
            hull[j].world,
            hull[(j + 1) % hull.length].world,
            [0.015, 0.025, 0.035],
            6,
          );
      }
    push("hoverOutline", outline);
  }
}
