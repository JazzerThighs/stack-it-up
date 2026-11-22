import assert from 'node:assert/strict';
import {createBrowserFixture} from './fixtures/browser.mjs';
import {bindGameViewSwitching,bindApplicationTabs} from '../web/ui/view-switching.js';
const ids=['viewMode','stageFaceMap','combined','gamePage','explorerPage','gameTab','explorerTab','solverTab','screenSelect','screenMenu','explorer'];
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
 $('gameTab').onclick();assert(!$('gamePage').hidden);
 let mode; $('explorer').selectScreen=async value=>{mode=value;};await choose('solver');assert.equal(mode,'solver');assert.equal($('screenSelect').textContent,'Solver ▾');
 await choose('explorer');assert.equal(mode,'explorer');assert.equal($('screenSelect').textContent,'Explorer ▾');
 $('screenSelect').onclick();assert(!$('screenMenu').hidden);$('solverTab').listeners.keydown({key:'Escape'});assert($('screenMenu').hidden);
 let resolveLoad,calls=[];$('explorer').explorerReady=new Promise(resolve=>resolveLoad=resolve);
 $('explorer').selectScreen=async value=>calls.push(value);
 const stale=choose('solver'),latest=choose('explorer');resolveLoad();await Promise.all([stale,latest]);
 assert.deepEqual(calls,['explorer'],'An obsolete load must not switch back to Solver');
 console.log('PASS: split transitions, face-map exit, three-screen navigation, dropdown keyboard controls and stale-load protection.');
} finally {f.restore();}
