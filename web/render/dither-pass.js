import {ScenePass} from './scene-pass.js';
import {visualSettings} from './visual-settings.js';
export function pixelLayout(width,height,ratio,size) {
  const block=Math.max(1,Math.round(ratio*size));
  return {block,width:Math.ceil(width/block),height:Math.ceil(height/block)};
}
const fragment=`#version 300 es
precision highp float;
uniform sampler2D scene;
uniform float blockSize;
out vec4 outColor;
void main() {
  ivec2 cell=ivec2(floor(gl_FragCoord.xy/blockSize));
  cell=clamp(cell,ivec2(0),textureSize(scene,0)-ivec2(1));
  vec4 color=texelFetch(scene,cell,0);
  outColor=vec4(color.rgb,1.);
}`;
// Rasterize geometry, depth, lighting and the Bayer pattern at the same low
// resolution. Nearest enlargement preserves complete pixels at every boundary.
export class DitherPass extends ScenePass {
  constructor(gl) {
    super(gl,fragment);
    this.blockUniform=gl.getUniformLocation(this.program,'blockSize');
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    for(const name of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D,name,gl.NEAREST);
  }
  begin(width,height) {
    this.outputWidth=width;this.outputHeight=height;
    this.layout=pixelLayout(width,height,Math.min(globalThis.devicePixelRatio||1,2),visualSettings.ditherSize);
    super.begin(this.layout.width,this.layout.height);
  }
  finish(pixelRatio) {
    const gl=this.gl;
    gl.viewport(0,0,this.outputWidth,this.outputHeight);
    gl.useProgram(this.program);gl.uniform1f(this.blockUniform,this.layout.block);
    super.finish(pixelRatio);
  }
}
