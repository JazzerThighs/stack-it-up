import './fixtures/behavior-defaults.mjs';
import assert from 'node:assert/strict';
import {createBrowserFixture} from './fixtures/browser.mjs';
import {startupDefaults} from '../web/ui/startup-defaults.js';
import {visualSettings} from '../web/render/visual-settings.js';
import {colors} from '../web/render/palette.js';
import {displaySettings} from '../web/ui/display-settings.js';
const key='stack-it-up.view-appearance',saved=new Map([[key,JSON.stringify({version:1,views:{target:{effect:'cel'}}})]]);
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)}});
const store=await import('../web/ui/view-appearance.js');
const before=store.getViewAppearance('stack'),shared={visual:{...visualSettings},colors:colors.slice(),display:{...displaySettings}};
assert(store.setViewAppearance('active','extraCenterColor','#123456'));
assert(!store.setViewAppearance('active','extraCenterColor','red'));
assert.equal(store.getViewAppearance('stack').extraCenterColor,before.extraCenterColor);
const extraReload=await import('../web/ui/view-appearance.js?extraReload');
assert.equal(extraReload.getViewAppearance('active').extraCenterColor,'#123456');
assert(store.setViewAppearance('active','effect','ascii'));
assert(store.setViewAppearance('active','whole','cubies'));
assert(store.setViewAppearance('active','fragments','whole'));
assert(store.setViewAppearance('active','extras','solids'));
assert(store.setViewAppearance('active','opacity',37));
assert(!store.setViewAppearance('active','opacity',101));
assert(!store.setViewAppearance('active','effect','invalid'));
assert(!store.setViewAppearance('missing','effect','ascii'));
assert.deepEqual(store.getViewAppearance('stack'),before,'Editing Active cannot alter Stack');
assert.equal(JSON.parse(saved.get(key)).views.target.effect,'cel','Saving one view preserves unvisited saved views');
const renderer={modelShape:'angular',appearance:'matte'};
assert.throws(()=>store.withViewAppearance('active',renderer,config=>{
 assert.equal(renderer.appearance,'ascii');
 assert.deepEqual(displaySettings.activePieces,{whole:'cubies',fragments:'whole',extras:'solids'});
 assert.equal(config.opacity,37);
 throw Error('fixture failure');
}),/fixture failure/);
assert.deepEqual({visual:{...visualSettings},colors:colors.slice(),display:{...displaySettings}},shared,'Scoped geometry restores globals even on failure');
assert.deepEqual(renderer,{modelShape:'angular',appearance:'matte'});
const reload=await import('../web/ui/view-appearance.js?reload');
assert.equal(reload.getViewAppearance('active').effect,'ascii');assert.equal(reload.getViewAppearance('target').effect,'cel');
store.resetViewAppearance('active');
assert.equal(store.getViewAppearance('active').extraCenterColor,startupDefaults.appearance.extraCenterColor);
assert.equal(store.getViewAppearance('active').effect,startupDefaults.game.pieceAppearance);
assert.equal(store.getViewAppearance('active').opacity,100-Number(startupDefaults.game.activeTransparency));
assert.deepEqual(store.getViewAppearance('stack'),before);
const {palettePresets}=await import('../web/render/palette-presets.js');
for(const preset of palettePresets){
 assert(store.setViewPalettePreset('active',preset.id));
 assert.equal(store.viewPalettePreset('active'),preset.id);
 assert.deepEqual(store.getViewAppearance('stack'),before,'Presets affect only the chosen view');
 assert.equal(JSON.parse(saved.get(key)).views.active.palette[1],preset.colors.O);
}
assert(!store.setViewPalettePreset('active','missing'));
assert(!store.setViewPalettePreset('missing','standard'));
const custom=store.getViewAppearance('active').palette.slice();custom[1]='#123456';
store.setViewAppearance('active','palette',custom);assert.equal(store.viewPalettePreset('active'),'custom');
const paletteReload=await import('../web/ui/view-appearance.js?paletteReload');
assert.deepEqual(paletteReload.getViewAppearance('active').palette,custom);
const fixture=createBrowserFixture('');fixture.install();
try {
  for(const [id] of store.appearanceViews) {
    const page=store.createViewAppearancePage(id);
    assert.equal(page.children[1].children[1].id,'viewAppearance'+id+'-palettePreset');
    const swatches=page.children[2];
    assert.equal(swatches.className,'piece-color-swatches','Swatches stay directly under the preset on the same page');
    assert.equal(swatches.children.filter(c=>c.children?.some(input=>input.type==='color')).length,9);
    const extras=swatches.children.at(-1);
    assert.equal(extras.children.length,4);
    assert.ok(extras.children.every(row=>row.children.some(input=>input.type==='color')));
  }
} finally {fixture.restore();}
store.resetViewAppearance('active');assert.deepEqual(store.getViewAppearance('active').palette,shared.colors);
saved.set(key,JSON.stringify({version:999,views:{}}));
const future=await import('../web/ui/view-appearance.js?future');future.setViewAppearance('active','effect','cel');
assert.equal(JSON.parse(saved.get(key)).version,999,'Unknown preference versions remain intact');
console.log('PASS: independent view profiles, saved/reloaded preferences, validation, per-view resets, future versions and exception-safe geometry scopes.');
