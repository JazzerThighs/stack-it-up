import {ScenePass} from "./scene-pass.js";
// Whole-view character conversion keeps complete glyphs at silhouettes.
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
export class AsciiPass extends ScenePass {
  constructor(gl) {
    super(gl,ASCII_FRAGMENT,['asciiSize','asciiExposure','asciiDensity','asciiCoverage','asciiBlend']);
  }
}
