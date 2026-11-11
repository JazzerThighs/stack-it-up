import assert from 'node:assert/strict';
import {createBrowserFixture} from './fixtures/browser.mjs';
import {bindGameViewSwitching,bindApplicationTabs} from '../web/ui/view-switching.js';
const ids=['viewMode','stageFaceMap','combined','gamePage','explorerPage','gameTab','explorerTab','explorer'];
const f=createBrowserFixture(ids.map(id=>'<div id="'+id+'"></div>').join(''),{globals:{matchMedia:()=>({matches:false})}});
f.install();
try {
 const $=f.$;let refresh=0,invalid=0,maps=0,draws=0;
 const cube={combined:true,state:[1],setState(s){assert.equal(s,this.state);},draw(){draws++;}};
 const animations={checked:true};$('combined').checked=true;
 bindGameViewSwitching({$,getRenderers:()=>[cube],animations,refreshSettings:()=>refresh++,invalidate:()=>invalid++,syncFaceMapLayout:()=>maps++});
 $('viewMode').onclick();assert(!$('combined').checked);$('viewMode').onclick();assert.equal(refresh,1);
 f.flush({time:performance.now()+500});assert(!cube.combined);assert(draws>0);assert.equal(invalid,1);
 animations.checked=false;$('viewMode').onclick();assert(cube.combined);assert($('combined').checked);
 $('stageFaceMap').checked=true;$('viewMode').onclick();assert.equal(maps,1);assert(!$('stageFaceMap').checked);
 let mounts=0,setups=0;const choose=bindApplicationTabs({$,mountExplorer:async()=>{mounts++;$('explorer').explorerReady=true;},startupCheck(){},startupError:e=>{throw e;},invalidate(){},setupGame:()=>setups++});
 choose(true);await Promise.resolve();assert($('gamePage').hidden);assert(!$('explorerPage').hidden);assert.equal(mounts,1);
 choose(false);choose(true);assert.equal(mounts,1);assert.equal(setups,1);
 $('explorerTab').listeners.keydown({key:'Home',preventDefault(){}});assert(!$('gamePage').hidden);
 console.log('PASS: split transition admission, reduced motion, face-map exit and application tab reuse/keyboard navigation.');
} finally {f.restore();}
