import {gameboyLightingGLSL} from './gameboy-lighting.js';
import {transparencyGLSL} from './transparency.js';
// Retained WebGL geometry. Orbiting changes uniforms only; no mesh rebuilds,
// triangle sorting, or continuous animation loop while the game is idle.
const VS = `#version 300 es
in vec3 position; in vec3 normal; in vec3 color; in vec3 coveragePosition;
uniform bool fixedShape;uniform mat3 modelRotation; uniform float modelScale; uniform vec3 modelOffset;
uniform mat3 orientation; uniform vec2 scale; uniform float breath; uniform float surfacePulse; uniform float cameraDistance;
out vec3 viewPosition; out vec3 n; out vec3 rgb; flat out vec3 coverageAnchor;
vec3 rotate(vec3 p){return orientation*p;}
void main(){vec3 cell=floor(position+vec3(.5));vec3 local=cell+(position-cell)*breath+normal*surfacePulse;vec3 p=rotate((fixedShape?modelRotation*(cell*modelScale)+(local-cell)*modelScale:modelRotation*(local*modelScale))+modelOffset);float w=cameraDistance>0.?1.-p.z/cameraDistance:1.;float clipZ=cameraDistance>0.?((21./19.)*(cameraDistance-p.z)-40./19.)/cameraDistance:-p.z/8.;viewPosition=p;gl_Position=vec4(p.xy*scale,clipZ,w);n=rotate(fixedShape?normal:modelRotation*normal);rgb=color;coverageAnchor=coveragePosition;}`;
const FS = `#version 300 es
precision highp float;
in vec3 viewPosition;in vec3 n;in vec3 rgb;uniform bool gameboyLighting;uniform int ditherSeed;flat in vec3 coverageAnchor;uniform bool screenDoor;uniform bool unlit;uniform float opacity;uniform int appearance;uniform float pixelRatio;
uniform vec3 lightDirection;
uniform float transparencyGrain, transparencyResponse;
uniform float lightIntensity, lightAmbient, ditherLevels, ditherSize, ditherContrast, ditherMidpoint;
out vec4 outColor;
float bayer(vec2 point) {
  ivec2 p=ivec2(mod(floor(point),4.));
  const float matrix[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return (matrix[p.y*4+p.x]+.5)/16.;
}
${transparencyGLSL}
${gameboyLightingGLSL}
void main(){
if(screenDoor && opacity<1.) {
  vec2 pixel=floor(gl_FragCoord.xy/(transparencyGrain*(appearance==1?1.:max(pixelRatio,1.))));
  float threshold=transparencyThreshold(pixel,coverageAnchor);
  if(pow(opacity,transparencyResponse)<=threshold)discard;
}
vec3 norm=normalize(n);
float direct=gameboyLighting?gameboyLight(viewPosition,norm,lightDirection):max(0.,dot(norm,lightDirection));
float light=clamp(direct*lightIntensity,0.,1.);
float illumination=clamp(lightAmbient+(1.-lightAmbient)*light,0.,1.);
float shine=pow(max(0.,dot(norm,normalize(lightDirection+vec3(0.,0.,1.001)))),28.)*.24*lightIntensity;
// Game Boy's dark ink must not acquire an additive white specular highlight.
vec3 shaded=gameboyLighting?rgb*illumination:rgb*illumination+shine;
// Keep the same 4x4 steps, but let illumination reach both endpoints.
if(appearance==1) {
  float coverage=clamp((illumination-ditherMidpoint)*ditherContrast+.5,0.,1.);
  coverage=floor(coverage*(ditherLevels-1.)+.5)/(ditherLevels-1.);
  shaded=rgb*step(bayer(gl_FragCoord.xy),coverage);
}
if(appearance==2) shaded=rgb*(lightAmbient+(1.-lightAmbient)*(.25+.75*light));
if(appearance==3) shaded=rgb*(illumination<.4?.3:illumination<.7?.65:1.);
if(appearance==5) shaded=rgb*illumination;
if(appearance==4) shaded=clamp(rgb*(lightAmbient+.20+1.70*light),0.,1.);
outColor=vec4(unlit?rgb:shaded,screenDoor?1.:opacity);}`;

export { VS, FS };
