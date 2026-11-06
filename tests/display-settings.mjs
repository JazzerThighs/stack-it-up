import assert from 'node:assert/strict';
import {displaySettings,setDisplaySetting,initializeDisplayControls} from '../web/ui/display-settings.js';
import {compositeParts} from '../web/render/piece-mesh.js';
const board=Array(27).fill(0);for(const i of [0,1,3,4])board[i]=1;
const ids=Array(27).fill(1),palette=['','#ff0000'],generate=()=>{throw Error('Angular must be native-free');};
const whole=compositeParts(board,ids,palette,generate,'angular',false,0,false);
const cells=compositeParts(board,ids,palette,generate,'angular',false,0,true);
assert.equal(whole.length,1);assert.equal(cells.length,4);assert(whole[0].length>0);assert(cells.every(m=>m.length>0));
setDisplaySetting('gameActiveSize',145);assert.equal(displaySettings.gameActiveSize,145);setDisplaySetting('gameActiveSize',999);assert.equal(displaySettings.gameActiveSize,145);
setDisplaySetting('uiTheme','violet');assert.equal(displaySettings.uiTheme,'violet');setDisplaySetting('stackPieces','cubies');assert.equal(displaySettings.stackPieces,'cubies');
console.log('PASS: separate whole/cubie geometry, validated size settings, theme and assembly preferences.');

const properties=new Map(),host={style:{setProperty:(k,v)=>properties.set(k,v)},setAttribute(){}};
const stop=initializeDisplayControls({host,getElementById:()=>null});
setDisplaySetting('uiTheme','amber');assert.equal(properties.get('--accent'),'#efca82');assert.equal(properties.get('--bg'),'#201b14');stop();
console.log('PASS: shared theme applies to the scoped explorer host.');

const {detectPieces,allowedDetectedPiece}=await import('../web/explorer/family-exploration.js');
const {explorationMeshes}=await import('../web/explorer/exploration-mesh.js');
const oMask=27,fragmentMask=11;
const makeCells=mask=>Array.from({length:27},(_,i)=>mask&(1<<i)?{piece:0,color:'y'}:null);
const allowed={counts:[{type:'O',min:0,max:6}]},excluded={counts:[{type:'O',min:0,max:0}]};
assert.equal(detectPieces(makeCells(oMask),allowed)[0].letter,'O');
assert.equal(detectPieces(makeCells(oMask),excluded)[0].letter,null);
assert.equal(allowedDetectedPiece(oMask,'O',{counts:[{type:'Facebound',max:0}]}),false);
assert.equal(allowedDetectedPiece((1<<0)|(1<<1)|(1<<4)|(1<<13),'F',{spatial:'none'}),false);
assert.equal(explorationMeshes(makeCells(oMask),generate,'angular',false,true,true,false,allowed).length,1);
assert.equal(explorationMeshes(makeCells(oMask),generate,'angular',false,true,true,false,excluded).length,4);
assert.equal(explorationMeshes(makeCells(fragmentMask),generate,'angular').length,3);
assert.equal(explorationMeshes(makeCells(oMask),generate,'angular',true,true,true,false,allowed,true).length,4);
const fragmentBoard=board.map((v,i)=>fragmentMask&(1<<i)?v:0);
assert.equal(compositeParts(fragmentBoard,ids,palette,generate,'angular',false,0,'whole').length,3);
assert.equal(compositeParts(board,ids,palette,generate,'angular',false,0,'solids').length,4);
for(const key of ['familyPieces','practiceStartPieces','practiceTargetPieces','activePieces','stackPieces'])for(const mode of ['cubies','whole','solids']){setDisplaySetting(key,mode);assert.equal(displaySettings[key],mode);}
console.log('PASS: five assembly preferences, complete tetracubes only, filter-aware exclusions, fragments and solids.');

const {assemblyOptions,assemblyKind}=await import('../web/render/assembly.js');
assert.equal(assemblyOptions.length,5);
const extraCells=Array(27).fill(null);extraCells[13]={piece:-1,color:'w'};
const extrasBaseline=explorationMeshes(extraCells,generate,'angular');
for(const [mode]of assemblyOptions){
  const full=explorationMeshes(makeCells(oMask),generate,'angular',true,true,true,false,{},false,mode);
  const fragment=explorationMeshes(makeCells(fragmentMask),generate,'angular',true,true,true,false,{},false,mode);
  assert.equal(full.length,assemblyKind(mode,true)==='whole'?1:4);
  assert.equal(full.filter(m=>m.identityCell!==undefined).length,assemblyKind(mode,true)==='solids'?4:0);
  assert.equal(fragment.filter(m=>m.identityCell!==undefined).length,assemblyKind(mode,false)==='solids'?3:0);
  assert.deepEqual(explorationMeshes(extraCells,generate,'angular',true,true,true,false,{},false,mode),extrasBaseline);
  assert.equal(compositeParts(board,ids,palette,generate,'angular',false,0,mode).length,assemblyKind(mode,true)==='whole'?1:4);
  for(const key of ['familyPieces','practiceStartPieces','practiceTargetPieces','activePieces','stackPieces']){setDisplaySetting(key,mode);assert.equal(displaySettings[key],mode);}
}
console.log('PASS: all five assembly combinations distinguish complete groups, fragments, and cube-shaped extras.');
