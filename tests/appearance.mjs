import assert from 'node:assert/strict';
const storage=new Map();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}});
const palette=await import('../web/render/palette.js');
const {colors,setPieceColor,resetPalette,defaultColors}=palette;
assert(!setPieceColor(0,'#ffffff'));assert(!setPieceColor(1,'red'));
assert(setPieceColor(4,'#AaBBcc'));assert.equal(colors[4],'#aabbcc');
const reloaded=await import('../web/render/palette.js?reload');
assert.equal(reloaded.colors[4],'#aabbcc');
assert.equal(reloaded.packingPalette.b,'#aabbcc');
resetPalette();assert.deepEqual(colors,defaultColors);
storage.set('stack-it-up.palette','not JSON');
const corrupted=await import('../web/render/palette.js?corrupted');assert.deepEqual(corrupted.colors,defaultColors);
const {AsciiPass}=await import('../web/render/ascii-pass.js');
let allocations=0,draws=0,deletions=0;const bindings=[];
const enums=new Map();
const gl=new Proxy({
 createProgram:()=>({}),createShader:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true,
 createTexture:()=>({}),createRenderbuffer:()=>({}),createFramebuffer:()=>({}),createVertexArray:()=>({}),
 checkFramebufferStatus:()=>gl.FRAMEBUFFER_COMPLETE,
 bindFramebuffer:(_,value)=>bindings.push(value),texImage2D:()=>allocations++,drawArrays:()=>draws++,
 deleteTexture:()=>deletions++,deleteRenderbuffer:()=>deletions++,deleteFramebuffer:()=>deletions++,deleteVertexArray:()=>deletions++,deleteProgram:()=>deletions++,
},{get:(o,k)=>k in o?o[k]:k===k.toUpperCase()?(enums.has(k)?enums.get(k):(enums.set(k,enums.size+1),enums.get(k))):()=>{}});
const pass=new AsciiPass(gl);
pass.begin(640,480);pass.finish(1);pass.begin(640,480);pass.finish(1);
assert.equal(allocations,1);assert.equal(draws,2);assert.equal(bindings.at(-1),null);
pass.begin(480,640);pass.finish(2);assert.equal(allocations,2);assert.equal(pass.height,640);
pass.destroy();assert.equal(deletions,5);
console.log('PASS: palette persistence/validation/reset and ASCII retained framebuffer, resize, target restoration and cleanup.');

const visual=await import('../web/render/visual-settings.js');
const {visualSettings,setVisualSetting,resetVisualSettings,faceLight,lightDirection}=visual;
assert.equal(visualSettings.ditherLevels,5);
assert(!setVisualSetting('missing',1));assert(!setVisualSetting('ditherLevels',NaN));
setVisualSetting('ditherLevels',3.7);assert.equal(visualSettings.ditherLevels,4);
setVisualSetting('asciiCoverage',0);assert.equal(visualSettings.asciiCoverage,.02);
setVisualSetting('lightIntensity',100);assert.equal(visualSettings.lightIntensity,3);
setVisualSetting('lightAzimuth',90);setVisualSetting('lightElevation',0);
assert(Math.abs(lightDirection()[0]-1)<1e-10);
faceLight();assert.deepEqual(lightDirection(),[0,0,1]);
setVisualSetting('asciiSize',1.5);resetVisualSettings('dither');
assert.equal(visualSettings.ditherLevels,5);assert.equal(visualSettings.asciiSize,1.5);
const restored=await import('../web/render/visual-settings.js?restore');assert.equal(restored.visualSettings.asciiSize,1.5);
resetVisualSettings();assert.equal(visualSettings.asciiSize,1);
console.log('PASS: lighting coordinates, saved filter controls, numeric validation and independent resets.');
