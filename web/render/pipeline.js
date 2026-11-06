import {hoverIdentityPackets} from './hover-identities.js';
import {voxelMesh} from './voxel-mesh.js';
import {categorySeed} from './transparency.js';
import {IDENTITY,transformPoint} from './transforms.js';
import {appearanceIndex} from "./appearance.js";
import {DitherPass} from "./dither-pass.js";
import {AsciiPass} from "./ascii-pass.js";
import {visualSettings,lightDirection} from "./visual-settings.js";
export function lightingMode(packet,shape,settings=visualSettings) {
  const kind=packet.lightingClass || packet.target.lightingClass ||
    (['stack','packing'].includes(packet.id)?'Pieces':['active','centers','floating'].includes(packet.id)?'Cubies':'Other');
  const mode=settings['light'+kind]??1;
  return mode===2 || (mode===0 && shape==='gameboy');
}
const $ = (id) => document.getElementById(id);
export function renderPackets(packets, context) {
  const { layerOrder } = context;
  const custom = context.customLayers ?? $("customLayers")?.checked;
  const gl = this.gl;
  packets=hoverIdentityPackets(this,packets);
  packets=packets.map(p=>({...p,positionalLighting:lightingMode(p,this.modelShape)}));
  // Keep original buffers intact: changing style never changes game geometry.
  if(this.modelShape==='voxel' || this.appearance==='voxel') {
    this.voxelTargets ??= new Map();
    packets=packets.map(p=>{
      let entry=this.voxelTargets.get(p.target);
      if(!entry){entry={target:this.buffer()};this.voxelTargets.set(p.target,entry);}
      if(entry.source!==p.target.data || entry.type!==p.type) {
        entry.source=p.target.data;entry.type=p.type;
        this.upload(entry.target,voxelMesh(p.target.data,p.type===gl.LINES));
      }
      return {...p,target:entry.target,type:gl.TRIANGLES};
    });
  }
  const pixelRatio=Math.min(globalThis.devicePixelRatio || 1,2);
  const ascii=this.appearance === 'ascii';
  if(this.canvas?.dataset && this.canvas.dataset.appearance !== this.appearance)
    this.canvas.dataset.appearance=this.appearance || 'jelly';
  let screenPass=null;
  if(ascii) screenPass=this.asciiPass ??= new AsciiPass(gl);
  else if(this.appearance==='dither') screenPass=this.ditherPass ??= new DitherPass(gl);
  if(screenPass) screenPass.begin(this.canvas.width,this.canvas.height);
  gl.useProgram(this.program);
  gl.uniform1i(this.uniforms.appearance,appearanceIndex(this.appearance));
  gl.uniform1f(this.uniforms.pixelRatio,pixelRatio);
  gl.uniform3fv(this.uniforms.lightDirection,lightDirection());
  for(const key of ['lightIntensity','lightAmbient','ditherLevels','ditherSize','ditherContrast','ditherMidpoint'])
    gl.uniform1f(this.uniforms[key],visualSettings[key]);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.STENCIL_TEST);
  const stippled=p=>this.appearance==='dither' || !!visualSettings.ditherTransparency || p.id==='recent';
  const draw = (p) => {
    gl.uniform1i(this.uniforms.gameboyLighting,p.positionalLighting?1:0);
    gl.uniform1i(this.uniforms.fixedShape,p.fixedShape?1:0);
    gl.uniformMatrix3fv(this.uniforms.modelRotation,false,p.rotation || IDENTITY);
    gl.uniform1f(this.uniforms.modelScale,p.modelScale ?? 1);
    gl.uniform3fv(this.uniforms.modelOffset,p.offset || [0,0,0]);
    gl.uniform1i(this.uniforms.ditherSeed,categorySeed(p.id));
    gl.uniform1i(this.uniforms.screenDoor,stippled(p)?1:0);
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
    for (const p of items) if (p.opacity > 0 && (p.opacity >= 1 || stippled(p))) draw(p);
    // Sort every translucent primitive globally within this depth group. This
    // prevents submission order from masquerading as physical occlusion.
    const primitives = [];
    for (const p of items)
      if (p.opacity > 0 && p.opacity < 1 && !stippled(p)) {
        const size = p.type === gl.LINES ? 18 : 27,
          data = p.target.data;
        for (let i = 0; i < data.length; i += size) {
          const vertices = [];
          let depth = 0;
          for (let j = i; j < i + size; j += 9) {
            const localPoint = [0, 1, 2].map((a) => {
              const cell = Math.floor(data[j + a] + 0.5);
              return cell + (data[j + a] - cell) * p.breathe + data[j + 3 + a] * (p.pulse || 0);
            });
            const center=localPoint.map(v=>Math.floor(v+.5));
            const point=p.fixedShape?transformPoint(center,p).map((v,a)=>v+(localPoint[a]-center[a])*(p.modelScale??1)):transformPoint(localPoint,p);
            depth += this.project(point)[2];
            vertices.push(...point, ...transformPoint(Array.from(data.slice(j+3,j+6)),{rotation:p.fixedShape?undefined:p.rotation}),...data.slice(j+6,j+9));
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
      draw({ ...run, target: this.transparentBuffer, breathe: 1, pulse: 0, rotation:IDENTITY,modelScale:1,offset:[0,0,0],fixedShape:false });
    };
    for (const primitive of primitives) {
      const p = primitive.p;
      if (
        !run ||
        run.type !== p.type ||
        run.opacity !== p.opacity ||
        run.unlit !== p.unlit || run.positionalLighting !== p.positionalLighting
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
  if(screenPass) screenPass.finish(pixelRatio);
}
