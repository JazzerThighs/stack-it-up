import assert from 'node:assert/strict';
import {createBrowserFixture} from './fixtures/browser.mjs';

const html='<input id="toggle" checked><input id="slider" value="24"><div id="panel" hidden></div>';
const first=createBrowserFixture(html);
const second=createBrowserFixture(html,{defaultValue:'',uniformLocation:()=>({}),globals:{window:{testWindow:true}}});
assert(first.$('toggle').checked);assert(first.$('panel').hidden);assert.equal(first.$('slider').value,'24');
assert.throws(()=>first.$('missing-control'),/missing missing-control/);
assert.equal(first.$('toggle').value,'0');assert.equal(second.$('toggle').value,'');
first.$('slider').value='99';assert.equal(second.$('slider').value,'24','fixtures must not share elements');
const original=new Map(['document','fetch','requestAnimationFrame','window'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
try {
 first.install();
 assert.equal(document.getElementById('slider'),first.$('slider'));
 assert.throws(()=>first.install(),/already installed/);
 let calls=0;
 const again=time=>{assert.equal(time,800);calls++;requestAnimationFrame(again);};
 requestAnimationFrame(again);
 first.flush({limit:3});assert.equal(calls,3);assert.equal(first.frames.length,1,'flush is bounded even when frames reschedule');
 second.install();
 assert.equal(document.getElementById('slider'),second.$('slider'));
 assert.equal(window.testWindow,true);assert.equal(second.frames.length,0);
 const a=first.gl.createBuffer(),b=second.gl.createBuffer(),vertices=new Float32Array([1,2,3]);
 first.gl.bindBuffer(first.gl.ARRAY_BUFFER,a);first.gl.bufferData(first.gl.ARRAY_BUFFER,vertices);
 assert.equal(a.data,vertices);assert.equal(b.data,undefined,'GPU fixture state must not leak across instances');
 second.restore();assert.equal(document,first.document);
 first.restore();first.restore();
 for(const [key,descriptor] of original)assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,key),descriptor,`${key} restored`);
 assert.equal(first.frames.length,0);
} finally {second.restore();first.restore();}
console.log('PASS: browser fixtures isolate DOM/GPU/frame state, fail on missing controls and restore global descriptors.');
