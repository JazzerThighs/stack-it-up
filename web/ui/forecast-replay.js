import {moveLabels} from '../engine/coordinates.js';
import {stateKey} from '../engine/forecast-search.js';
export function actionLabel(step) {
 if (step.method === 'game_turn') return moveLabels[step.arg % 15] + (step.arg >= 15 ? "'" : '');
 if (step.method === 'game_choose') return 'Choose ' + ['U','D','F','B','L','R'][step.arg];
 return `Lock white group at cell ${step.arg}`;
}
export function createReplay({engine, act, refresh, isBusy, closeSettings}) {
 const $=id=>document.getElementById(id);
 let witness=null, replay=null, expected=null, running=false, cursor=0;
 function exit(){replay=null;expected=null;running=false;$('forecastReplayBar').hidden=true;refresh();}
 function show(){
  const step=replay.steps[cursor];
  $('forecastReplayStatus').textContent=step ? `${cursor+1}/${replay.steps.length}: ${actionLabel(step)}${step.placed ? ` - places ${step.placed} piece(s), including automatic locks` : ''}` : 'Verified path completed.';
  $('forecastStep').disabled=!step || running;
 }
 $('forecastReplay').onclick=()=>{
  if(!witness||isBusy())return;
  if(stateKey(engine().exportState())!==stateKey(witness.initial)){setWitness(null);return;}
  replay=witness;expected=engine().exportState();cursor=0;
  $('forecastReplayBar').hidden=false;closeSettings();show();
 };
 $('forecastStep').onclick=async()=>{
  if(!replay||running||isBusy()||cursor>=replay.steps.length)return;
  if(stateKey(engine().exportState())!==stateKey(expected)){exit();return;}
  running=true;show();
  try {
   const step=replay.steps[cursor];
   if(!await act(step))throw Error('Action rejected');
   expected=engine().exportState();cursor++;
   if(cursor===replay.steps.length&&stateKey(expected)!==stateKey(replay.finalState))throw Error('Replay differs from forecast');
   running=false;show();
  } catch(error){running=false;$('forecastStep').disabled=true;$('forecastReplayStatus').textContent=`Replay stopped: ${error.message}`;}
 };
 $('forecastRestore').onclick=()=>{
  if(!replay||running||isBusy())return;
  if(engine().importState(replay.initial))exit();
 };
 $('forecastExit').onclick=()=>{if(!running&&!isBusy())exit();};
 function setWitness(value){witness=value;$('forecastReplay').disabled=!value;$('forecastWitness').hidden=!value;
  $('forecastSequence').textContent=value ? value.steps.map((s,i)=>`${i+1}. ${actionLabel(s)}${s.placed ? ` [${s.placed} placed${s.over ? '; then top-out' : ''}]` : ''}`).join('  ') : '';
 }
 return {setWitness, suppress(){
  if(!replay)return false;
  if(running)return true;
  if(stateKey(engine().exportState())===stateKey(expected))return true;
  replay=null;expected=null;$('forecastReplayBar').hidden=true;return false;
 }};
}
