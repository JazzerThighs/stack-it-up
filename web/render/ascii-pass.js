import {visualSettings} from "./visual-settings.js";
// One GPU-only character-grid pass. No readPixels, DOM glyphs, or CPU redraw.
const vertex = `#version 300 es
void main() {
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  gl_Position=vec4(p*2.-1.,0.,1.);
}`;
export const ASCII_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D scene;
uniform vec2 resolution;
uniform float pixelRatio;
uniform float asciiSize, asciiExposure, asciiDensity, asciiCoverage, asciiBlend;
out vec4 outColor;
// Seven rows of five bits: . : - + * # @, low to high density.
const int glyphs[49]=int[49](
  0,0,0,0,0,4,0,
  0,4,4,0,4,4,0,
  0,0,0,31,0,0,0,
  0,4,4,31,4,4,0,
  0,21,14,31,14,21,0,
  10,10,31,10,31,10,10,
  14,17,23,21,23,16,14
);
float glyphInk(int glyph, int x, int y) {
  if(x<0 || x>=5 || y<0 || y>=7) return 0.;
  return float((glyphs[glyph*7+y]>>(4-x))&1);
}
void main() {
  vec2 cellSize=vec2(8.,12.)*pixelRatio*asciiSize;
  vec2 cell=floor(gl_FragCoord.xy/cellSize);
  // Coverage across the cell keeps silhouettes when the center misses them.
  // All fragments in a character use the same nine cached texture samples.
  vec4 sum=vec4(0.);
  float peakAlpha=0.;
  for(int y=0;y<3;y++) for(int x=0;x<3;x++) {
    vec2 uv=(cell+(vec2(float(x),float(y))+.5)/3.)*cellSize/resolution;
    vec4 sampleColor=texture(scene,clamp(uv,vec2(0.),vec2(1.)));
    sum+=sampleColor;
    peakAlpha=max(peakAlpha,sampleColor.a);
  }
  if(sum.a<.001) {outColor=vec4(0.,0.,0.,1.);return;}
  vec3 straight=clamp(sum.rgb/sum.a*asciiExposure,0.,1.);
  float coverage=sum.a/(9.*max(peakAlpha,.001));
  float visibility=peakAlpha*smoothstep(0.,asciiCoverage,coverage);
  float luminance=dot(straight,vec3(.2126,.7152,.0722));
  // Blend adjacent glyphs instead of switching at a hard light threshold.
  float density=clamp(luminance*8.*asciiDensity,0.,6.);
  int glyph=int(floor(density));
  ivec2 pixel=ivec2(floor(fract(gl_FragCoord.xy/cellSize)*vec2(8.,12.)));
  int x=pixel.x-1, y=9-pixel.y;
  float ink=mix(glyphInk(glyph,x,y),glyphInk(min(glyph+1,6),x,y),mix(step(.5,fract(density)),smoothstep(0.,1.,fract(density)),asciiBlend));
  // Composite explicitly onto black, including between glyphs and at edges.
  outColor=vec4(straight*ink*visibility,1.);
}`;
export class AsciiPass {
  constructor(gl) {
    this.gl=gl; this.width=0; this.height=0;
    this.program=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,ASCII_FRAGMENT]]) {
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(this.program,shader);gl.deleteShader(shader);
    }
    gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(this.program));
    this.uniforms=Object.fromEntries(['scene','resolution','pixelRatio','asciiSize','asciiExposure','asciiDensity','asciiCoverage','asciiBlend'].map(n=>[n,gl.getUniformLocation(this.program,n)]));
    this.triangleArray=gl.createVertexArray();
    this.texture=gl.createTexture();this.depth=gl.createRenderbuffer();this.framebuffer=gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    for(const name of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D,name,gl.LINEAR);
    for(const name of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D,name,gl.CLAMP_TO_EDGE);
  }
  begin(width,height) {
    const gl=this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);
    if(width!==this.width || height!==this.height) {
      this.width=width;this.height=height;
      gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.texture,0);
      gl.bindRenderbuffer(gl.RENDERBUFFER,this.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.depth);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw Error('ASCII framebuffer unavailable');
    }
    gl.depthMask(true);gl.clearColor(0,0,0,0);gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  }
  finish(pixelRatio) {
    const gl=this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
    gl.useProgram(this.program);gl.bindVertexArray(this.triangleArray);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.uniform1i(this.uniforms.scene,0);
    gl.uniform2f(this.uniforms.resolution,this.width,this.height);
    gl.uniform1f(this.uniforms.pixelRatio,pixelRatio);
    for(const key of ['asciiSize','asciiExposure','asciiDensity','asciiCoverage','asciiBlend'])
      gl.uniform1f(this.uniforms[key],visualSettings[key]);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  destroy() {
    const gl=this.gl;
    gl.deleteTexture(this.texture);gl.deleteRenderbuffer(this.depth);
    gl.deleteFramebuffer(this.framebuffer);gl.deleteVertexArray(this.triangleArray);gl.deleteProgram(this.program);
  }
}
