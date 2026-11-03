import {S} from '../engine/snapshot.js';
const checks = {scienceMode:0,clearFullFace:1,clearRingFace:2,clearFullSlice:3,clearRingSlice:4,gravityEnabled:5,freedomEnabled:9,freeSize1:10,freeSize2:11,freeSize3:12,freeSize4:13,fragmentsConnected:14,rebuildQueueShapes:21,rebuildOriginalShape:22,fallOneCell:20,planeGravity:24};
const radios = {gravityDirection:[6,4],gravityOccurrence:[8,2],freedomEvent:[16,3],freedomMethod:[18,4]};
export const gameplayIds = [...Object.keys(checks),...Object.entries(radios).flatMap(([key,[,n]])=>Array.from({length:n},(_,i)=>key+i))];
export function readGameplay(root=document) {
  const $=id=>root.getElementById(id);let word=1<<23;
  for(const [id,bit] of Object.entries(checks)) if($(id).checked)word|=1<<bit;
  for(const [key,[bit,n]] of Object.entries(radios))for(let i=0;i<n;i++)if($(key+i).checked)word|=i<<bit;
  return word;
}
export function writeGameplay(word,root=document) {
  if(word===0xffffffff)return;
  const $=id=>root.getElementById(id);
  for(const [id,bit] of Object.entries(checks))$(id).checked=!!(word&(1<<bit));
  if(!(word&(1<<23))){$('rebuildQueueShapes').checked=true;$('rebuildOriginalShape').checked=false;}
  for(const [key,[bit,n]] of Object.entries(radios))for(let i=0;i<n;i++)$(key+i).checked=((word>>bit)&(n===2?1:3))===i;
}
export function validateGameplay(root=document,changed=null) {
  const $=id=>root.getElementById(id);let text='';
  for(const [ids,enabled,message] of [
    [['clearFullFace','clearRingFace','clearFullSlice','clearRingSlice'],true,'Keep at least one clear type enabled.'],
    [['freeSize1','freeSize2','freeSize3','freeSize4'],$('freedomEnabled').checked,'Select at least one size of piece to free.'],
  ])if(enabled&&!ids.some(id=>$(id).checked)) {$(ids.includes(changed)?changed:ids[0]).checked=true;text=message;}
  $('gameplayValidation').textContent=text;
  return readGameplay(root);
}
export function refreshGameplay(root=document,{starting=false,busy=false,state=null}={}) {
  const $=id=>root.getElementById(id),r=readGameplay(root);
  $('legacyRuleNote').hidden=starting||state?.gameplayRules!==0xffffffff;
  const locked=!starting&&(busy||!!state?.[S.PENDING_FACES]);
  for(const id of gameplayIds)$(id).disabled=locked;
  const gravity=!!(r&32),freedom=!!(r&512),connected=!!(r&(1<<14));
  $('planeGravity').disabled=locked||!gravity;
  $('sliceGravity').disabled=locked||!gravity;
  for(const id of ['gravityDirectionOptions','gravityOccurrenceOptions','gravityDistanceOptions'])$(id).disabled=!gravity;
  for(const id of ['freedomSizeOptions','freedomReconstructionOptions','freedomEventOptions'])$(id).disabled=!freedom;
  $('freedomMethodOptions').disabled=!freedom||((r>>16)&3)===2;
  $('reconstructionShapeRules').hidden=!connected;
  for(const id of ['rebuildQueueShapes','rebuildOriginalShape'])$(id).disabled=locked||!freedom||!connected;
  $('gravityDependency').hidden=gravity;$('freedomDependency').hidden=freedom;
  $('scienceOptions').hidden=!(r&1);
  $('nextPieceControls').hidden=!$('chooseNext').checked||!(r&1);
  for(const id of ['applyCurrent','applyHeld']){$(id).hidden=starting;$(id).disabled=locked||!(r&1)||!!state?.[S.OVER];}
  $('applyCurrent').disabled ||= !+$('debugCurrent').value;
  $('debugEditNote').textContent=starting?'Random uses the queue. Empty clears the hold pocket.':'Press Set to apply. Replacing the current piece may auto-place it; Undo restores the puzzle.';
  $('freedomMethodNote').textContent=((r>>16)&3)===2?'All eligible groups are freed; selection is unused.':['Each eligible group has equal odds.','Pick one of 27 cells. Empty or ineligible cells miss; no retry.','Largest eligible group; random ties.','Smallest eligible group; random ties.'][(r>>18)&3];
  $('settingsRulesSummary').textContent=`${r&1?'For Science (Cheating)!':'Standard play'} · ${gravity?'Gravity on':'Gravity off'} · ${freedom?'Stack-piece release on':'Stack-piece release off'}`;
  const rebuild=freedom||!!state?.[S.FLOATING];
  $('activeSpheres').disabled=!rebuild||$('rebuildSolidIdentities').checked;
  $('activeSpheres').title=$('rebuildSolidIdentities').checked?'Turn off distinct solids to change loose-fragment shapes.':'';
  $('rebuildShapeOptions').disabled=!rebuild;$('rebuildShapeOptionsReason').hidden=rebuild;
  $('solidOptions').disabled=!rebuild||!$('rebuildSolidIdentities').checked;
  $('solidOptionsReason').hidden=!$('solidOptions').disabled;
}
export function initializeGameplay(context) {
  const $=id=>document.getElementById(id);
  for(const id of gameplayIds)$(id).onchange=()=>{
    // Native radio grouping also works in the two dialogs because they share one form subtree.
    for(const [key,[,n]] of Object.entries(radios))if(id.startsWith(key))for(let i=0;i<n;i++)$(key+i).checked=id===key+i;
    const rules=validateGameplay(document,id);
    if(context.settingUp){refreshGameplay(document,{starting:true});return;}
    if(context.busy||context.state?.[S.PENDING_FACES])return;
    context.engine.game_configure_rules(rules);context.update();
  };
  for(const [button,held,select] of [['applyCurrent',false,'debugCurrent'],['applyHeld',true,'debugHeld']])$(button).onclick=()=>{
    if(context.busy||context.settingUp)return;
    return context.debugPiece(held?1:0,+$(select).value);
  };
}
