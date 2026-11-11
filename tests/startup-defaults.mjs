import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startupDefaults,createStartupDefaults,applyStartupDefaults} from '../web/ui/startup-defaults.js';
import {createSettingsStore} from '../web/ui/settings-store.js';
// The author's function is authoritative, including resets and saved-value precedence.
const original=startupDefaults.appearance.cubieScale;
startupDefaults.appearance.cubieScale=72;
const schema=JSON.parse(fs.readFileSync(new URL('../data/appearance-settings.json',import.meta.url)));
const saved=new Map();const storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
const a=createSettingsStore(schema,storage);assert.equal(a.values.cubieScale,72);
a.set('cubieScale',85);
const b=createSettingsStore(schema,storage);assert.equal(b.values.cubieScale,85);
b.reset('cubie');assert.equal(b.values.cubieScale,72);
assert.equal(JSON.parse(saved.get(schema.storageKey)).values.cubieScale,72);
startupDefaults.appearance.cubieScale=original;
assert.notEqual(createStartupDefaults(),startupDefaults,'Defaults function creates independent values');
// Initialization is root-specific and never rewrites live choices on reuse.
const controls=new Map(Object.keys(startupDefaults.game).map(id=>[id,{}]));
const root={getElementById:id=>controls.get(id)};
applyStartupDefaults(root,'game');assert.equal(controls.get('modelShape').value,startupDefaults.game.modelShape);
controls.get('modelShape').value='gameboy';applyStartupDefaults(root,'game');assert.equal(controls.get('modelShape').value,'gameboy');
applyStartupDefaults({getElementById:id=>controls.get(id)},'game');assert.equal(controls.get('modelShape').value,'gameboy','A new wrapper around the same controls does not reset them');
const other=new Map(Object.keys(startupDefaults.explorer).map(id=>[id,{}]));
applyStartupDefaults({getElementById:id=>other.get(id)},'explorer');
assert.equal(other.get('modelShape').value,startupDefaults.explorer.modelShape);
assert.equal(other.get('oneOfEach').checked,false);
// Every authored default must have a corresponding field; catch typo/no-op edits.
for(const domain of ['appearance','display','controls','orbit']){
 const schema=JSON.parse(fs.readFileSync(new URL(`../data/${domain}-settings.json`,import.meta.url)));
 for(const id of Object.keys(startupDefaults[domain]))assert(Object.hasOwn(schema.fields,id),`${domain}.${id} exists`);
 const module=await import(`../web/ui/${domain}-schema.js`);
 createSettingsStore(module[domain+'Schema']);
}
for(const scope of ['game','explorer']){
 const html=fs.readFileSync(new URL(scope==='game'?'../web/index.html':'../web/explorer/index.html',import.meta.url),'utf8');
 for(const id of Object.keys(startupDefaults[scope]))assert(html.includes(`id="${id}"`),`${scope}.${id} exists`);
}
console.log('PASS: curated defaults precede saved preferences, resets use curated values, startup runs once per root and every default names a real setting.');
