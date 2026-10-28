import {CAMERA_DISTANCE} from "../render/camera.js";
import {compositeMesh} from "../render/piece-mesh.js";
import { Renderer } from "../render/renderer.js";
import { balloon, box, xyz, rgb, rotateCell } from "../render/geometry.js";
import { renderPackets } from "../render/pipeline.js";
import { PALETTE, NOTATION, turn } from "./model.js";

// Uses the game's WebGL buffers, shaders, camera, rounded geometry and drag
// picker. Packing state is independent of the game's rules and shared context.
export class PackingCube extends Renderer {
  constructor(
    host,
    { readOnly = false, onChange = () => {}, controls = true } = {},
  ) {
    const canvas = document.createElement("canvas"),
      labels = document.createElement("canvas");
    canvas.className = "packing-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      readOnly
        ? "Target packing. Drag to orbit."
        : "Packing cube. Drag a sticker to turn; right-drag or drag background to orbit.",
    );
    host.replaceChildren(canvas);
    let view;
    const context = {
      get state() {
        return view?.cells;
      },
      get busy() {
        return view?.busy;
      },
      setBusy: (v) => (view.busy = v),
      play: (m, t) => view.play(m, t),
      animate: (ms, fn) => view.animate(ms, fn),
      invalidate: () => view?.invalidate(),
    };
    super(canvas, labels, {
      onOrbit: (dx, dy) => {
        view.orbit(dx, dy);
        view.invalidate();
      },
      inputContext: context,
    });
    view = this;
    this.host = host;
    this.orbitOnly = readOnly;
    this.onChange = onChange;
    this.cells = [];
    this.history = [];
    this.busy = false;
    this.generation = 0;
    this.opacity = 1;
    this.connected = false;
    this.status = document.createElement("span");
    this.status.className = "packing-move-status";
    this.status.setAttribute("role", "status");
    const toolbar = document.createElement("div");
    toolbar.className = "packing-actions";
    const button = (text, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.onclick = fn;
      toolbar.append(b);
      return b;
    };
    if (!readOnly && controls) {
      this.moveSelect = document.createElement("select");
      this.moveSelect.setAttribute("aria-label", "Cube move");
      for (let m = 0; m < 30; m++) {
        const o = document.createElement("option");
        o.value = m;
        o.textContent = NOTATION[m % 15] + (m >= 15 ? "'" : "");
        this.moveSelect.append(o);
      }
      toolbar.append(this.moveSelect);
      button("Turn", () => this.play(Number(this.moveSelect.value)));
      this.undoButton = button("Undo", () => this.undo());
      button("Reset", () => this.reset());
    }
    button("Reset view", () => {
      this.resetOrientation();
      this.invalidate();
    });
    toolbar.append(this.status);
    host.append(toolbar);
    this.observer = new ResizeObserver(() => this.invalidate());
    this.observer.observe(host);
    canvas.addEventListener("keydown", (e) => {
      if (e.key === "Home") {
        this.resetOrientation();
        this.invalidate();
        e.preventDefault();
      }
      const m = NOTATION.indexOf(e.key.toUpperCase());
      if (!readOnly && m >= 0 && m < 9 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.play(m + (e.shiftKey ? 15 : 0));
      }
    });
    canvas.addEventListener("webglcontextlost", () => {
      this.status.textContent =
        "Graphics unavailable. Reload to restore the cube.";
    });
  }
  setCells(cells) {
    this.generation++;
    this.busy = false;
    this.cells = cells.slice();
    this.initial = cells.slice();
    this.history = [];
    this.setState(this.cells);
    this.changed();
  }
  setState(cells, animation = null) {
    const out = [];
    if (this.connected && this.meshGenerator && !animation) {
      const mesh=compositeMesh(cells.map(c=>c?.color || 0), cells.map((c,i)=>c?.piece>=0 ? c.piece+1 : i+100), PALETTE, this.meshGenerator, this.appearance);
      this.upload(this.solid,mesh); this.invalidate(); this.onFrame?.(cells,animation); return;
    }
    cells.forEach((cell, i) => {
      if (!cell) return;
      const start = out.length;
      (this.appearance === "voxel" ? box : balloon)(out, xyz(i), 0.465, rgb(PALETTE[cell.color] || PALETTE.d));
      if (animation?.kind === "turn") rotateCell(out, start, i, animation.move, animation.t);
    });
    this.upload(this.solid, new Float32Array(out));
    this.invalidate();
    this.onFrame?.(cells, animation);
  }
  changed() {
    if (this.undoButton) this.undoButton.disabled = !this.history.length;
    this.status.textContent = `${this.history.length} turns`;
    this.onChange(this);
  }
  async animate(ms, fn) {
    const generation = this.generation;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fn(1);
      return;
    }
    const start = performance.now();
    await new Promise((resolve) => {
      const frame = (now) => {
        if (generation !== this.generation) {
          resolve();
          return;
        }
        const t = this.isVisible() ? Math.min(1, (now - start) / ms) : 1;
        fn(t);
        this.invalidate();
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }
  async play(move, start = 0) {
    if (this.busy || this.orbitOnly || !this.cells.length) return;
    this.busy = true;
    const generation = this.generation,
      from = this.cells.slice();
    await this.animate(180 * (1 - start), (t) =>
      this.setState(from, { kind: "turn", move, t: start + (1 - start) * t }),
    );
    if (generation !== this.generation) return;
    this.history.push({ cells: from, move });
    this.cells = turn(from, move);
    this.busy = false;
    this.setState(this.cells);
    this.changed();
  }
  undo() {
    if (this.busy || !this.history.length) return;
    this.cells = this.history.pop().cells;
    this.setState(this.cells);
    this.changed();
  }
  reset() {
    if (this.initial) this.setCells(this.initial);
  }
  isVisible() {
    return !document.hidden && !document.getElementById("explorerPage")?.hidden;
  }
  invalidate() {
    if (!this.isVisible()) return;
    if (this.pendingFrame) return;
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = 0;
      this.draw();
    });
  }
  draw() {
    if (!this.isVisible()) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const gl = this.gl,
      dpr = Math.min(devicePixelRatio || 1, 2),
      w = Math.round(rect.width * dpr),
      h = Math.round(rect.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.unit = Math.max(8, Math.min(rect.width - 32, rect.height - 120) / (this.fitScale || 6.0));
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform1f(this.uniforms.cameraDistance,this.perspective ? CAMERA_DISTANCE : 0);
    gl.uniformMatrix3fv(this.uniforms.orientation, false, this.orientation);
    gl.uniform2f(
      this.uniforms.scale,
      (2 * this.unit) / rect.width,
      (2 * this.unit) / rect.height,
    );
    gl.disable(gl.CULL_FACE);
    renderPackets.call(
      this,
      [
        {
          id: "packing",
          target: this.solid,
          type: gl.TRIANGLES,
          opacity: this.opacity,
          unlit: false,
          breathe: 1,
        },
      ],
      { customLayers: false, layerOrder: [] },
    );
  }
  destroy() {
    this.generation++;
    this.observer.disconnect();
    if (this.pendingFrame) cancelAnimationFrame(this.pendingFrame);
    for (const value of Object.values(this))
      if (value?.vao) {
        this.gl.deleteBuffer(value.buffer);
        this.gl.deleteVertexArray(value.vao);
      }
    this.gl.deleteProgram(this.program);
    this.host.replaceChildren();
  }
}
