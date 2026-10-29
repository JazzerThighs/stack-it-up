import {colors} from "./palette.js";
const faceLabels = ["U", "D", "F", "B", "R", "L"];
const faces = [
  [1, 2],
  [1, 0],
  [2, 0],
  [2, 2],
  [0, 0],
  [0, 2],
];
const xyz = (i) => [
  Math.floor(i / 9) - 1,
  (Math.floor(i / 3) % 3) - 1,
  (i % 3) - 1,
];
const rgb = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
function box(out, p, h, color) {
  for (let axis = 0; axis < 3; axis++)
    for (let side of [-1, 1]) {
      const a = (axis + 1) % 3,
        b = (axis + 2) % 3,
        n = [0, 0, 0];
      n[axis] = side;
      const q = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([u, v]) => {
        const q = p.slice();
        q[axis] += side * h;
        q[a] += u * h;
        q[b] += v * h;
        return q;
      });
      for (const i of side === 1 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2])
        out.push(...q[i], ...n, ...color);
    }
}
function wire(out, p, h, color) {
  for (let axis = 0; axis < 3; axis++)
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        for (const side of [-1, 1]) {
          let q = p.slice();
          q[axis] += side * h;
          q[(axis + 1) % 3] += a * h;
          q[(axis + 2) % 3] += b * h;
          out.push(...q, 0, 0, 1, ...color);
        }
}
// One shared grid on the cube surface: 12 edges and 24 face divisions.
function surfaceGrid(out, project = null) {
  const color = [0.52, 0.64, 0.68],
    seen = new Set();
  for (let axis = 0; axis < 3; axis++)
    for (const side of [-1.5, 1.5]) {
      const normal = [0, 0, 0];
      normal[axis] = Math.sign(side);
      if (project && project(normal)[2] > 0) continue;
      for (const offset of [-1.5, -0.5, 0.5, 1.5])
        for (const direction of [1, 2]) {
          const a = (axis + direction) % 3,
            b = 3 - axis - a,
            ends = [-1.5, 1.5].map((end) => {
              const p = [0, 0, 0];
              p[axis] = side;
              p[a] = end;
              p[b] = offset;
              return p;
            });
          const key = ends
            .map((p) => p.join(","))
            .sort()
            .join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          for (const p of ends) out.push(...p, 0, 0, 1, ...color);
        }
    }
}
// Rounded cells shrink about their own center, including the internal core cell.
// Current: spheres; reconstruction: rounded cubes; loose fragments: diamonds.
function cubieShape(current, rebuilding, whiteSpheres = false) {
  return current ? sphere : rebuilding ? balloon : whiteSpheres ? sphere : diamond;
}
function diamond(out, p, h, color) {
  if (h < 0.001) return;
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const vertices = [[x,0,0],[0,y,0],[0,0,z]];
    const normal = [x,y,z].map(v => v / Math.sqrt(3));
    for (const i of x*y*z > 0 ? [0,1,2] : [0,2,1])
      out.push(...p.map((v,j) => v + vertices[i][j]*h), ...normal, ...color);
  }
}
function sphere(out, p, h, color) {
  if (h < 0.001) return;
  const rows = 16,
    cols = 24;
  const vertex = (row, col) => {
    const phi = (row * Math.PI) / rows,
      theta = (col * Math.PI * 2) / cols,
      n = [
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ];
    return [...p.map((v, i) => v + n[i] * h), ...n, ...color];
  };
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const q = [
        vertex(row, col),
        vertex(row + 1, col),
        vertex(row + 1, col + 1),
        vertex(row, col + 1),
      ];
      for (const i of [0, 1, 2, 0, 2, 3]) out.push(...q[i]);
    }
}
function balloon(out, p, h, color) {
  if (h < 0.001) return;
  const r = h * 0.32,
    inner = h - r,
    N = 4;
  for (let axis = 0; axis < 3; axis++)
    for (const side of [-1, 1]) {
      const a = (axis + 1) % 3,
        b = (axis + 2) % 3;
      const vertex = (u, v) => {
        const q = [0, 0, 0];
        q[axis] = side * h;
        q[a] = ((u / N) * 2 - 1) * h;
        q[b] = ((v / N) * 2 - 1) * h;
        const c = q.map((x) => Math.max(-inner, Math.min(inner, x))),
          n = q.map((x, k) => x - c[k]),
          length = Math.hypot(...n);
        for (let k = 0; k < 3; k++) n[k] /= length;
        return [...c.map((x, k) => p[k] + x + n[k] * r), ...n, ...color];
      };
      for (let u = 0; u < N; u++)
        for (let v = 0; v < N; v++) {
          const q = [
            vertex(u, v),
            vertex(u + 1, v),
            vertex(u + 1, v + 1),
            vertex(u, v + 1),
          ];
          for (const i of side === 1 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2])
            out.push(...q[i]);
        }
    }
}
function rotateCell(out, start, i, move, t) {
  const m = move % 15,
    reverse = move >= 15;
  let axis,
    side,
    layer,
    wide = false;
  if (m < 6) {
    [axis, side] = faces[m];
    layer = side;
  } else if (m < 9) {
    axis = m - 6;
    side = 0;
    layer = 1;
  } else {
    [axis, side] = faces[m - 9];
    layer = side;
    wide = true;
  }
  const p = xyz(i).map((x) => x + 1);
  if (wide ? p[axis] === 2 - side : p[axis] !== layer) return;
  const angle = (((reverse === (side === 0) ? -1 : 1) * Math.PI) / 2) * t,
    c = Math.cos(angle),
    sn = Math.sin(angle),
    a = (axis + 1) % 3,
    b = (axis + 2) % 3;
  for (let j = start; j < out.length; j += 9)
    for (const offset of [0, 3]) {
      const x = out[j + offset + a],
        y = out[j + offset + b];
      out[j + offset + a] = x * c - y * sn;
      out[j + offset + b] = x * sn + y * c;
    }
}
function overlapMarks(out, p) {
  const color = [1, 0.39, 0.56];
  wire(out, p, 0.49, color);
  for (let axis = 0; axis < 3; axis++)
    for (const side of [-1, 1])
      for (const diagonal of [-1, 1])
        for (const end of [-1, 1]) {
          const q = p.slice();
          q[axis] += side * 0.492;
          q[(axis + 1) % 3] += end * 0.25;
          q[(axis + 2) % 3] += end * diagonal * 0.25;
          out.push(...q, 0, 0, 1, ...color);
        }
}

export {
  colors,
  faceLabels,
  faces,
  xyz,
  rgb,
  box,
  wire,
  surfaceGrid,
  sphere,
  diamond,
  cubieShape,
  balloon,
  rotateCell,
  overlapMarks,
};
