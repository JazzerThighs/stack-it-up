import {compositeMesh} from "./piece-mesh.js";
import { S } from "../engine/snapshot.js";
import { sceneDecorations } from "./decorations.js";
import { renderPackets } from "./pipeline.js";
import { VS, FS } from "./shaders.js";
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
import {
  installCubeDrag,
  stickerCenter,
  sliceCandidates,
} from "../input/drag.js";
import { CubeStack, moveLabels } from "../engine/coordinates.js";
const $ = (id) => document.getElementById(id);
let context;
export function configureRenderer(value) {
  context = value;
}
class Renderer {
  constructor(
    canvas,
    labels,
    { stack = false, onOrbit, onLayout, inputContext = context } = {},
  ) {
    this.onLayout = onLayout;
    this.canvas = canvas;
    this.labels = labels;
    this.isStack = stack;
    this.yaw = Math.PI - 0.55;
    this.pitch = 0.4;
    this.resetOrientation();
    this.xray = true;
    this.gravity = 0;
    this.activeOutlines = false;
    this.breathing = true;
    this.controlGrid = true;
    this.stackGrid = true;
    this.combinedGrid = true;
    this.activeOpacity = 1;
    this.centerOpacity = 1;
    this.stackOpacity = 1;
    const gl = (this.gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      stencil: true,
      powerPreference: "low-power",
    }));
    if (!gl)
      throw new Error(
        "WebGL 2 is unavailable. Please enable hardware acceleration or try a current browser.",
      );
    this.program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VS],
      [gl.FRAGMENT_SHADER, FS],
    ]) {
      let shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(this.program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw Error(gl.getProgramInfoLog(this.program));
    this.uniforms = Object.fromEntries(
      ["orientation", "scale", "unlit", "opacity", "breath", "surfacePulse"].map((n) => [
        n,
        gl.getUniformLocation(this.program, n),
      ]),
    );
    this.activeLines = this.buffer();
    this.centers = this.buffer();
    this.overlaps = this.buffer();
    this.grid = this.buffer();
    this.solid = this.buffer();
    this.lines = this.buffer();
    this.empty = this.buffer();
    this.stackMesh = this.buffer();
    this.ghostSolid = this.buffer();
    this.ghostLines = this.buffer();
    this.previewLines = this.buffer();
    this.combined = false;
    this.ghost = null;
    this.preview = 0;
    this.activeOnly = this.buffer();
    this.floatingMesh = this.buffer();
    this.bandMesh = this.buffer();
    this.bandCache = new Map();
    this.decorBuffers = {};
    this.transparentBuffer = this.buffer();
    installCubeDrag(this, onOrbit, inputContext);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      const message = document.getElementById("message");
      if (message)
        message.textContent =
          "Graphics context lost. Reload the page to restart the renderer.";
    });
  }
  buffer() {
    let gl = this.gl;
    const vao = gl.createVertexArray(),
      buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [i, name] of ["position", "normal", "color"].entries()) {
      let loc = gl.getAttribLocation(this.program, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 36, i * 12);
    }
    return { vao, buffer, count: 0 };
  }
  upload(target, data) {
    target.data = data;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, target.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    target.count = data.length / 9;
  }
  setMesh(data) {
    this.upload(this.stackMesh, data);
  }
  setState(s, animation = null) {
    this.gridKey = null;
    this.state = s;
    this.animation = animation;
    this.gravity = s[S.GRAVITY];
    const grid = [],
      activeLines = [],
      lines = [],
      solid = [],
      empty = [],
      ghostSolid = [],
      ghostLines = [],
      preview = [],
      centers = [],
      overlaps = [];
    if (!this.isStack) surfaceGrid(grid);
    if (this.isStack) wire(lines, [0, 0, 0], 1.5, [0.29, 0.38, 0.4]);
    else
      for (let i = 0; i < 27; i++) {
        if (i === 13 && !(s[S.FLOATING] & (1 << i))) continue;
        const floating = !!(s[S.FLOATING] & (1 << i));
        const p = xyz(i),
          active = !!((s[S.ACTIVE] | s[S.FLOATING]) & (1 << i)),
          occupied = s[i] !== 0,
          startLine = lines.length,
          startSolid = solid.length,
          startEmpty = empty.length,
          startOverlap = overlaps.length,
          startCenter = centers.length,
          startActiveLine = activeLines.length;
        if (active) wire(activeLines, p, 0.445, [1, 0.95, 0.77]);
        if (active) {
          if (!s[S.BAND_IDS + i]) (cubieShape(!(s[S.FLOATING] & (1 << i)), !!s[S.REBUILD_COLORS + i], this.activeSpheres))(
            !floating && p.filter((v) => v !== 0).length === 1
              ? centers
              : solid,
            p,
            0.438 * (animation?.kind === "spawn" ? animation.t : 1),
            floating
              ? s[S.REBUILD_COLORS + i]
                ? rgb(colors[s[S.REBUILD_COLORS + i]])
                : [1, 1, 1]
              : rgb(colors[s[S.PIECE]]),
          );
          if (occupied) overlapMarks(overlaps, p);
        } else box(empty, p, 0.438, [0.13, 0.18, 0.21]);
        if (animation?.kind === "turn")
          for (const [out, start] of [
            [lines, startLine],
            [solid, startSolid],
            [empty, startEmpty],
            [overlaps, startOverlap],
            [centers, startCenter],
            [activeLines, startActiveLine],
          ])
            rotateCell(out, start, i, animation.move, animation.t);
      }
    const bands = [];
    if (!this.isStack && s[S.BANDAGED]) {
      const groups = new Map();
      for (let i=0;i<27;i++) if (s[S.BAND_IDS+i] && (s[S.FLOATING] & (1<<i)))
        groups.set(s[S.BAND_IDS+i], (groups.get(s[S.BAND_IDS+i]) || 0) | (1<<i));
      for (const mask of groups.values()) {
        if (!this.bandCache.has(mask)) {
          if (this.bandCache.size >= 128) this.bandCache.delete(this.bandCache.keys().next().value);
          this.bandCache.set(mask, context.engine.bandMesh(mask));
        }
        const start = bands.length;
        for (const value of this.bandCache.get(mask)) bands.push(value);
        if (animation?.kind === "turn") {
          const cell = 31 - Math.clz32(mask & -mask);
          rotateCell(bands, start, cell, animation.move, animation.t);
        }
      }
    }
    this.upload(this.bandMesh, new Float32Array(bands));
    this.upload(this.activeLines, new Float32Array(activeLines));
    this.upload(this.centers, new Float32Array(centers));
    this.upload(this.overlaps, new Float32Array(overlaps));
    if (!this.isStack && this.ghost) {
      for (let i = 0; i < 27; i++)
        if (this.ghost.mask & (1 << i)) {
          balloon(ghostSolid, xyz(i), 0.46, rgb(colors[this.ghost.piece]));
          wire(ghostLines, xyz(i), 0.47, [0.85, 1, 0.92]);
        }
    }
    if (!this.isStack && this.preview)
      for (let i = 0; i < 27; i++)
        if (this.preview & (1 << i)) wire(preview, xyz(i), 0.49, [1, 1, 1]);
    const activeGeometry = [],
      floatingGeometry = [];
    for (let i = 0; i < solid.length; i += 9)
      (solid[i + 6] === 1 && solid[i + 7] === 1 && solid[i + 8] === 1
        ? floatingGeometry
        : activeGeometry
      ).push(...solid.slice(i, i + 9));
    this.upload(this.activeOnly, new Float32Array(activeGeometry));
    this.upload(this.floatingMesh, new Float32Array(floatingGeometry));
    this.upload(this.grid, new Float32Array(grid));
    this.upload(this.solid, new Float32Array(solid));
    this.upload(this.empty, new Float32Array(empty));
    this.upload(this.lines, new Float32Array(lines));
    this.upload(this.ghostSolid, new Float32Array(ghostSolid));
    this.upload(this.ghostLines, new Float32Array(ghostLines));
    this.upload(this.previewLines, new Float32Array(preview));
  }
  stackFrame(from, to, event, t) {
    const source = event.kind === 2 ? from : to;
    if (this.stackEvent !== event) {
      this.stackEvent = event;
      this.transitionMesh = compositeMesh(source.slice(0,27),source.slice(27,54),colors,mask=>context.engine.bandMesh(mask));
    }
    const out = this.transitionMesh.slice();
    for (let n=0;n<out.length;n+=9) {
      const cell = [0,1,2].map(k=>Math.max(-1,Math.min(1,Math.floor(out[n+k]+.5))));
      const i=(cell[0]+1)*9+(cell[1]+1)*3+cell[2]+1;
      const scale = event.mask & (1<<i) ? event.kind===2 ? 1-t : (event.kind===1 || event.kind===4) ? t : 1 : 1;
      for (let k=0;k<3;k++) {
        out[n+k]=cell[k]+(out[n+k]-cell[k])*scale;
        if (event.kind===3) out[n+k]+=(xyz(event.origins[i])[k]-cell[k])*(1-t);
      }
    }
    this.upload(this.stackMesh,out);
  }

  draw() {
    const gl = this.gl,
      rect = this.canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 2);
    if (!rect.width || !rect.height) return;
    const width = Math.max(1, Math.round(rect.width * dpr)),
      height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.labels.width = width;
      this.labels.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.stencilMask(255);
    gl.clearStencil(0);
    gl.disable(gl.STENCIL_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.useProgram(this.program);
    const margin = document.getElementById("showArrows").checked ? 5.6 : 5.05;
    const unit = (this.unit = Math.max(
      8,
      Math.min((rect.width - 24) / margin, (rect.height - 150) / margin),
    ));
    this.onLayout?.(rect.width, rect.height, unit, (p) => this.project(p));
    gl.uniform1f(this.uniforms.breath, 1);
    gl.uniformMatrix3fv(this.uniforms.orientation, false, this.orientation);
    gl.uniform2f(
      this.uniforms.scale,
      (2 * unit) / rect.width,
      (2 * unit) / rect.height,
    );
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.uniform1i(this.uniforms.unlit, 0);
    gl.uniform1f(this.uniforms.opacity, 1);
    gl.disable(gl.BLEND);
    const breath =
      this.breathing && this.animation?.kind !== "turn"
        ? 0.90 +
          0.14 *
            Math.sin(
              ((globalThis.performance?.now() || 0) * Math.PI * 2) / 3200,
            )
        : 1;
    const packets = [],
      add = (id, target, type, opacity = 1, unlit = false, breathe = 1, pulse = 0) => {
        if (target.count && opacity > 0)
          packets.push({ id, target, type, opacity, unlit, breathe, pulse });
      };
    if (this.isStack || this.combined)
      add("stack", this.stackMesh, gl.TRIANGLES, this.stackOpacity);
    if (!this.isStack) {
      if (!this.xray && !this.combined) add("empty", this.empty, gl.TRIANGLES);
      add(
        "centers",
        this.centers,
        gl.TRIANGLES,
        this.centerOpacity,
        false,
        breath,
      );
      add(
        "active",
        this.activeOnly,
        gl.TRIANGLES,
        this.activeOpacity,
        false,
        breath,
      );
      add(
        "floating",
        this.floatingMesh,
        gl.TRIANGLES,
        this.activeOpacity,
        false,
        breath,
      );
      add("floating", this.bandMesh, gl.TRIANGLES, this.activeOpacity, false, 1, this.breathing && this.animation?.kind !== "turn" ? (breath - 1.04) * 0.10 : 0);
      add("recent", this.ghostSolid, gl.TRIANGLES, 0.18);
      add("recent", this.ghostLines, gl.LINES, 0.45, true);
      if (this.activeOutlines)
        add("outlines", this.activeLines, gl.LINES, 1, true, breath);
      add("overlaps", this.overlaps, gl.LINES, 0.95, true);
      add("choice", this.previewLines, gl.LINES, 1, true);
    }
    const gridKey = this.rearGridOnly ? this.orientation.join(",") : "all";
    if (this.gridKey !== gridKey) {
      const grid = [];
      surfaceGrid(grid, this.rearGridOnly ? (p) => this.project(p) : null);
      this.upload(this.grid, new Float32Array(grid));
      this.gridKey = gridKey;
    }
    if (
      this.isStack
        ? this.stackGrid
        : this.combined
          ? this.combinedGrid
          : this.controlGrid
    )
      add("grid", this.grid, gl.LINES, 0.45, true);
    this.sceneDecorations(add, unit);
    this.renderPackets(packets);
    const ctx = this.labels.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
  }
  renderPackets(packets) {
    return renderPackets.call(this, packets, context);
  }

  sceneDecorations(add, unit) {
    return sceneDecorations.call(this, add, unit, context);
  }

  resetOrientation() {
    const cy = Math.cos(this.yaw),
      sy = Math.sin(this.yaw),
      cp = Math.cos(this.pitch),
      sp = Math.sin(this.pitch);
    this.orientation = [
      cy,
      sy * sp,
      -sy * cp,
      0,
      cp,
      sp,
      sy,
      -cy * sp,
      cy * cp,
    ];
  }
  orbit(dx, dy) {
    const c = Math.cos(dx),
      s = Math.sin(dx),
      a = Math.cos(dy),
      b = Math.sin(dy);
    for (let i = 0; i < 9; i += 3) {
      const [x, y, z] = this.orientation.slice(i, i + 3),
        u = c * x + s * z,
        v = -s * x + c * z;
      this.orientation.splice(i, 3, u, a * y - b * v, b * y + a * v);
    }
  }
  project([x, y, z]) {
    const m = this.orientation;
    return [
      m[0] * x + m[3] * y + m[6] * z,
      m[1] * x + m[4] * y + m[7] * z,
      m[2] * x + m[5] * y + m[8] * z,
    ];
  }
}

export { Renderer, colors, faceLabels };
