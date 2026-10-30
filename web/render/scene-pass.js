import {visualSettings} from "./visual-settings.js";
const vertex = `#version 300 es
void main() {
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  gl_Position=vec4(p*2.-1.,0.,1.);
}`;
export class ScenePass {
  constructor(gl, fragment, settingNames=[]) {
    this.settingNames=settingNames;
    this.gl=gl; this.width=0; this.height=0;
    this.program=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(this.program,shader);gl.deleteShader(shader);
    }
    gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(this.program));
    this.uniforms=Object.fromEntries(['scene','resolution','pixelRatio',...settingNames].map(n=>[n,gl.getUniformLocation(this.program,n)]));
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
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw Error('Scene framebuffer unavailable');
    }
    gl.viewport(0,0,width,height);
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
    for(const key of this.settingNames)
      gl.uniform1f(this.uniforms[key],visualSettings[key]);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  destroy() {
    const gl=this.gl;
    gl.deleteTexture(this.texture);gl.deleteRenderbuffer(this.depth);
    gl.deleteFramebuffer(this.framebuffer);gl.deleteVertexArray(this.triangleArray);gl.deleteProgram(this.program);
  }
}
