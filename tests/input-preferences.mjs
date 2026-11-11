import assert from 'node:assert/strict';
import {controlsSchema} from '../web/ui/controls-schema.js';
import {orbitSchema} from '../web/ui/orbit-schema.js';
import {createSettingsStore} from '../web/ui/settings-store.js';
const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
saved.set(controlsSchema.storageKey,JSON.stringify({hoverRings:false,wideTurns:true,freeOrbit:'false',unknown:true}));
saved.set(orbitSchema.storageKey,JSON.stringify({mouseRight:'smooth',orbitSensitivity:.537,orbitDeadZone:400,orbitSnap:false,orbitDebug:'true'}));
let controls=createSettingsStore(controlsSchema,storage),orbit=createSettingsStore(orbitSchema,storage);
assert.equal(controls.values.hoverRings,false);assert.equal(controls.values.wideTurns,true);assert.equal(controls.values.freeOrbit,true);
assert.equal(orbit.values.mouseRight,'xyz');assert.equal(orbit.values.orbitSensitivity,.537);assert.equal(orbit.values.orbitDeadZone,96);assert.equal(orbit.values.orbitSnap,false);assert.equal(orbit.values.orbitDebug,false);
assert(!controls.set('hoverRings',1));assert(!orbit.set('orbitSnap','false'));assert(!orbit.set('orbitSensitivity',NaN));assert(!orbit.set('mouseLeft','invalid'));
orbit.set('orbitSensitivity',10);assert.equal(orbit.values.orbitSensitivity,2);orbit.set('orbitSensitivity',.537);assert.equal(orbit.values.orbitSensitivity,.537);
controls.set('hoverRings',true);assert.equal(JSON.parse(saved.get(controlsSchema.storageKey)).version,1);assert.equal(createSettingsStore(controlsSchema,storage).values.wideTurns,true);
assert.equal(createSettingsStore(orbitSchema,storage).values.mouseRight,'xyz');
for(const schema of [controlsSchema,orbitSchema]){const future=JSON.stringify({version:100,values:{}});saved.set(schema.storageKey,future);const store=createSettingsStore(schema,storage);store.reset();assert.equal(saved.get(schema.storageKey),future);}
// Existing command API keeps coercion, orbit mode changes stay atomic.
saved.clear();globalThis.localStorage=storage;
const {setControlSetting,controlSettings}=await import('../web/input/control-settings.js');
const {setOrbitMode,orbitSettings,subscribeOrbit}=await import('../web/input/orbit-settings.js');
setControlSetting('wideTurns',1);assert.equal(controlSettings.wideTurns,true);
const seen=[],stop=subscribeOrbit(()=>seen.push([orbitSettings.orbitSettling,orbitSettings.orbitConfined]));setOrbitMode('classic');setOrbitMode('smooth');assert.deepEqual(seen,[[false,false],[true,true]]);stop();
assert.equal(JSON.parse(saved.get(orbitSchema.storageKey)).values.orbitConfined,true);
console.log('PASS: input legacy/versioned migration, strict saved booleans, action aliases, fractional clamping, future protection and atomic mode changes.');
