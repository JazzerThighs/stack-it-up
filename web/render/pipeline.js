import { appearanceIndex } from "./appearance.js";
const $ = (id) => document.getElementById(id);
export function renderPackets(packets, context) {
  const { layerOrder } = context;
  const custom = context.customLayers ?? $("customLayers")?.checked;
  const gl = this.gl;
  gl.uniform1i(this.uniforms.appearance, appearanceIndex(this.appearance));
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.STENCIL_TEST);
  const draw = (p) => {
    gl.uniform1f(this.uniforms.breath, p.breathe);
    gl.uniform1f(this.uniforms.surfacePulse, p.pulse || 0);
    gl.uniform1i(this.uniforms.unlit, p.unlit ? 1 : 0);
    gl.uniform1f(this.uniforms.opacity, p.opacity);
    gl.bindVertexArray(p.target.vao);
    gl.drawArrays(p.type, 0, p.target.count);
  };
  const group = (items) => {
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    for (const p of items) if (p.opacity >= 1) draw(p);
    // Sort every translucent primitive globally within this depth group. This
    // prevents submission order from masquerading as physical occlusion.
    const primitives = [];
    for (const p of items)
      if (p.opacity < 1) {
        const size = p.type === gl.LINES ? 18 : 27,
          data = p.target.data;
        for (let i = 0; i < data.length; i += size) {
          const vertices = [];
          let depth = 0;
          for (let j = i; j < i + size; j += 9) {
            const point = [0, 1, 2].map((a) => {
              const cell = Math.floor(data[j + a] + 0.5);
              return cell + (data[j + a] - cell) * p.breathe + data[j + 3 + a] * (p.pulse || 0);
            });
            depth += this.project(point)[2];
            vertices.push(...point, ...data.slice(j + 3, j + 9));
          }
          primitives.push({ p, vertices, depth: depth / (size / 9) });
        }
      }
    primitives.sort((a, b) => a.depth - b.depth);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(!!custom);
    let run = null,
      vertices = [];
    const flush = () => {
      if (!run) return;
      this.upload(this.transparentBuffer, new Float32Array(vertices));
      draw({ ...run, target: this.transparentBuffer, breathe: 1, pulse: 0 });
    };
    for (const primitive of primitives) {
      const p = primitive.p;
      if (
        !run ||
        run.type !== p.type ||
        run.opacity !== p.opacity ||
        run.unlit !== p.unlit
      ) {
        flush();
        vertices = [];
        run = p;
      }
      vertices.push(...primitive.vertices);
    }
    flush();
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  };
  if (custom) {
    for (const id of layerOrder.slice().reverse()) {
      const items = packets.filter((p) => p.id === id);
      if (!items.length) continue;
      gl.depthMask(true);
      gl.clearDepth(1);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      group(items);
    }
  } else group(packets);
  gl.uniform1f(this.uniforms.breath, 1);
  gl.uniform1f(this.uniforms.opacity, 1);
}
