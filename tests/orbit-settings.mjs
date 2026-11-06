import assert from 'node:assert/strict';
import {orbitSpecs,orbitSettings,orbitAvailability,bindOrbitSettings,setOrbitMode,setOrbitSetting,subscribeOrbit,bindOrbitToggle} from '../web/input/orbit-settings.js';
function root(){
 const ids=[...Object.keys(orbitSpecs),'orbitMode','orbitModeHelp','orbitToleranceHelp','orbitSnapHelp','freeOrbit','orbitDiagnostics','resetOrbitSettings'];
 const elements=Object.fromEntries(ids.map(id=>[id,{value:'',checked:false,disabled:false,hidden:false,textContent:'',events:{},addEventListener(type,fn){this.events[type]=fn;},setAttribute(){}}]));
 return {elements,getElementById:id=>elements[id]};
}
const game=root(),explorer=root(),offGame=bindOrbitSettings(game),offExplorer=bindOrbitSettings(explorer);
let changes=0;const off=subscribeOrbit(()=>changes++);
setOrbitMode('confined');assert.equal(changes,1);assert.equal(explorer.elements.orbitMode.value,'confined');
assert(!orbitSpecs.orbitTolerance);assert(!game.elements.freeOrbit.disabled);
setOrbitSetting('orbitSnap',false);
for(const id of ['orbitHorizontal','orbitVertical','orbitRoll','orbitSettleTime','orbitSettleDelay'])assert(game.elements[id].disabled);
assert(!game.elements.orbitSmoothing.disabled);
setOrbitSetting('orbitDiagonalRoll',false);assert(explorer.elements.orbitCubeFB.disabled);assert(!game.elements.orbitCubeLR.disabled);
assert(game.elements.orbitDebugOverlay.disabled);setOrbitSetting('orbitDebug',true);assert(!game.elements.orbitDebugOverlay.disabled);
setOrbitMode('smooth');assert.equal(explorer.elements.orbitMode.value,'confined');
setOrbitMode('classic');assert(!game.elements.orbitSensitivity.disabled);setOrbitSetting('mouseBothEnabled',false);assert(game.elements.mouseBoth.disabled);assert(!game.elements.freeOrbit.disabled);assert(game.elements.orbitSensitivity.disabled);assert(game.elements.orbitDiagnostics.hidden);
assert(!orbitAvailability().orbitDebugOverlay);
// The select updates mode atomically and immediately syncs the other app.
game.elements.orbitMode.value='confined';game.elements.orbitMode.events.change();assert.equal(explorer.elements.orbitMode.value,'confined');
const button={setAttribute(){}};const stopToggle=bindOrbitToggle(button);button.onclick();assert.equal(game.elements.orbitMode.value,'classic');assert.equal(button.hidden,false);
const mouseBefore=[orbitSettings.mouseLeft,orbitSettings.mouseRight,orbitSettings.mouseBoth];button.onclick();assert.equal(game.elements.orbitMode.value,'confined');assert.deepEqual([orbitSettings.mouseLeft,orbitSettings.mouseRight,orbitSettings.mouseBoth],mouseBefore);
game.elements.resetOrbitSettings.onclick();assert.equal(explorer.elements.orbitMode.value,'confined');assert.equal(button.textContent,'XYZ Orbit');assert(!game.elements.orbitHorizontal.disabled);assert(game.elements.orbitDebugOverlay.disabled);
setOrbitSetting('mouseRight','smooth');assert.equal(explorer.elements.mouseRight.value,'xyz');
setOrbitSetting('mouseRight','invalid');assert.equal(orbitSettings.mouseRight,'xyz');
off();offGame();offExplorer();stopToggle();
console.log('PASS: camera mode synchronization, atomic changes, Classic/smooth/confined dependencies, snap/roll/debug dependencies and reset.');
