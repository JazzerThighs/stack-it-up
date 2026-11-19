import {ScenePass} from './scene-pass.js';
import {ASCII_FRAGMENT} from './ascii-pass.js';
import {appearanceIndex} from './appearance.js';

// One shared depth buffer keeps the combined cube physically occluded. A second
// color attachment records which view owns each pixel, so post effects cannot
// turn the other view into glyphs or apply its pixel size to the whole scene.
const glyphs=ASCII_FRAGMENT.slice(ASCII_FRAGMENT.indexOf('const int glyphs'),ASCII_FRAGMENT.indexOf('void main()'));
const fragment=`#version 300 es
precision highp float;
uniform sampler2D scene, owners;
uniform vec2 resolution;
uniform float pixelRatio;
uniform int effects[2];
uniform float sizes[2], exposure[2], density[2], coverage[2], blend[2], pixels[2];
out vec4 outColor;
${glyphs}
vec3 convert(int id,vec4 original){
  if(effects[id]==1){
    float size=max(1.,pixels[id]*pixelRatio);
    vec2 uv=(floor(gl_FragCoord.xy/size)+.5)*size/resolution;
    // Avoid borrowing color from the other view across a silhouette.
    return texture(owners,uv)[id]>.5?texture(scene,uv).rgb:original.rgb;
  }
  if(effects[id]!=4)return original.rgb;
  vec2 cellSize=vec2(8.,12.)*pixelRatio*sizes[id];
  vec2 cell=floor(gl_FragCoord.xy/cellSize);
  vec4 sum=vec4(0.);float peak=0.;
  for(int y=0;y<3;y++)for(int x=0;x<3;x++){
    vec2 uv=clamp((cell+(vec2(float(x),float(y))+.5)/3.)*cellSize/resolution,vec2(0.),vec2(1.));
    vec4 color=texture(scene,uv);float weight=texture(owners,uv)[id];
    sum+=color*weight;peak=max(peak,color.a*weight);
  }
  if(sum.a<.001)return vec3(0.);
  vec3 straight=clamp(sum.rgb/sum.a*exposure[id],0.,1.);
  float visibility=peak*smoothstep(0.,coverage[id],sum.a/(9.*max(peak,.001)));
  float level=clamp(dot(straight,vec3(.2126,.7152,.0722))*8.*density[id],0.,6.);
  int glyph=int(floor(level));
  ivec2 pixel=ivec2(floor(fract(gl_FragCoord.xy/cellSize)*vec2(8.,12.)));
  float ink=mix(glyphInk(glyph,pixel.x-1,9-pixel.y),glyphInk(min(glyph+1,6),pixel.x-1,9-pixel.y),mix(step(.5,fract(level)),smoothstep(0.,1.,fract(level)),blend[id]));
  return straight*ink*visibility;
}
void main(){
  vec2 uv=gl_FragCoord.xy/resolution;vec4 color=texture(scene,uv);
  vec2 weights=texture(owners,uv).rg;
  outColor=vec4(convert(0,color)*weights.x+convert(1,color)*weights.y+color.rgb*max(0.,1.-weights.x-weights.y),1.);
}`;
export class ViewEffectsPass extends ScenePass {
  constructor(gl){
    super(gl,fragment);
    for(const name of ['owners','effects','sizes','exposure','density','coverage','blend','pixels'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
    this.owners=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,this.owners);
    for(const name of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,name,gl.NEAREST);
    for(const name of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,name,gl.CLAMP_TO_EDGE);
  }
  begin(width,height){
    const gl=this.gl,resized=width!==this.width||height!==this.height;
    // Resize both attachments before ScenePass checks framebuffer completeness.
    if(resized){gl.bindTexture(gl.TEXTURE_2D,this.owners);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);}
    super.begin(width,height);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,this.owners,0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  }
  finish(pixelRatio){
    const gl=this.gl;gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.owners);gl.uniform1i(this.uniforms.owners,1);
    gl.uniform1iv(this.uniforms.effects,this.profiles.map(p=>appearanceIndex(p.effect)));
    for(const [name,key]of [['sizes','asciiSize'],['exposure','asciiExposure'],['density','asciiDensity'],['coverage','asciiCoverage'],['blend','asciiBlend'],['pixels','ditherSize']])gl.uniform1fv(this.uniforms[name],this.profiles.map(p=>p[key]));
    super.finish(pixelRatio);
  }
  destroy(){this.gl.deleteTexture(this.owners);super.destroy();}
}
