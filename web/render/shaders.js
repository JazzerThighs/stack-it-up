// Retained WebGL geometry. Orbiting changes uniforms only; no mesh rebuilds,
// triangle sorting, or continuous animation loop while the game is idle.
const VS = `#version 300 es
in vec3 position; in vec3 normal; in vec3 color;
uniform mat3 orientation; uniform vec2 scale; uniform float breath; uniform float surfacePulse; uniform float cameraDistance;
out vec3 n; out vec3 rgb;
vec3 rotate(vec3 p){return orientation*p;}
void main(){vec3 cell=floor(position+vec3(.5));vec3 p=rotate(cell+(position-cell)*breath+normal*surfacePulse);float w=cameraDistance>0.?1.-p.z/cameraDistance:1.;float clipZ=cameraDistance>0.?((21./19.)*(cameraDistance-p.z)-40./19.)/cameraDistance:-p.z/8.;gl_Position=vec4(p.xy*scale,clipZ,w);n=rotate(normal);rgb=color;}`;
const FS = `#version 300 es
precision highp float;
in vec3 n;in vec3 rgb;uniform bool unlit;uniform float opacity;uniform int appearance;out vec4 outColor;
void main(){vec3 norm=normalize(n);float light=max(0.,dot(norm,normalize(vec3(-.35,.65,.68))));float shine=pow(max(0.,dot(norm,normalize(vec3(-.18,.32,.93)))),28.)*.24;vec3 shaded=rgb*(.48+.52*light)+shine;
if(appearance==1) shaded=rgb*(.32+.68*light)+pow(max(0.,dot(norm,normalize(vec3(-.18,.32,.93)))),64.)*.30;
if(appearance==2) shaded=rgb*(.65+.35*light);
if(appearance==3) shaded=rgb*(.40+.60*light);
if(appearance==4) shaded=rgb*(light<.25?.40:light<.65?.72:1.);
outColor=vec4(unlit?rgb:shaded,opacity);}`;

export { VS, FS };
