import {seedStackShapes,moveFreedShapes,applyStackShapeEvent} from './stack-shapes.js';
import {IDENTITY,turnTransform,composeRotation,movedCell,transformPoint} from '../render/transforms.js';
import {CubeStack} from './coordinates.js';
import {S} from './snapshot.js';
// Add visual metadata and its undo history to a transport without changing rules.
/** @param {import("./types.js").EngineTransport} transport */
export function trackPresentation(transport,{trackSolids=true}={}) {
  const api=/** @type {Omit<import("./types.js").EngineTransport,"snapshot"> & {snapshot:()=>import("./types.js").PresentationSnapshot}} */ ({...transport});
  let orientations=Array.from({length:27},()=>IDENTITY),orientationHistory=new Map();
  /** @type {import("./types.js").ShapeState|null} */
  let shapes=null;
  /** @type {Map<number,import("./types.js").ShapeState|null>} */
  const shapeHistory=new Map();
  /** @type {import("./types.js").ShapeState[]} */
  let shapeEvents=[];
  api.snapshot=()=>{
    const result=transport.snapshot();
    if(shapes)result.stackShapes=shapes.stack;
    Object.defineProperty(result,'solidRotations',{value:orientations.slice(),configurable:true});
    return result;
  };
  api.events=()=>{
    const events=transport.events();
    events.forEach((event,i)=>{if(shapeEvents[i])event.stackShapes=shapeEvents[i].stack;});
    return events;
  };
  if(!trackSolids)return api;
  /** @param {number} count @param {number[][]} rotation @param {import("./types.js").ShapeState|null} shape */
  function saveVisualHistory(count,rotation,shape){
    if(count>=100)for(const history of [orientationHistory,shapeHistory]){for(let i=0;i<99;i++)history.set(i,history.get(i+1));history.delete(99);}
    const slot=Math.min(count,99);orientationHistory.set(slot,rotation);shapeHistory.set(slot,shape);
  }
  const init=api.game_init;
  api.game_init=(...args)=>{orientations=Array.from({length:27},()=>IDENTITY);orientationHistory.clear();shapeHistory.clear();shapeEvents=[];const result=init(...args);shapes=seedStackShapes(api.snapshot());return result;};
  const load=api.importState;
  api.importState=data=>{const before=api.snapshot(),old=orientations,ok=load(data);if(ok){saveVisualHistory(before[S.UNDO_COUNT],old,shapes);shapeEvents=[];shapes=seedStackShapes(api.snapshot());orientations=Array.from({length:27},()=>IDENTITY);}return ok;};
  for(const name of ['game_preview_core','game_place_core','game_set_piece_pool','game_configure_rules','game_debug_piece','game_turn','game_choose','game_hold','game_lock_band','game_set_next','game_set_gravity','game_set_gravity_rules','game_set_slice_clears','game_set_modes','game_set_early_lock','game_set_fragments','game_set_release_rules','game_undo']) {
    // The wrapper forwards the original command arguments unchanged. The public
    // API retains the exact generated transport signatures.
    const original=/** @type {(...args:(number|boolean)[])=>number|boolean|void} */ (api[/** @type {keyof typeof api} */(name)]);
    if(!original)continue;
    Object.defineProperty(api,name,{value:/** @param {(number|boolean)[]} args */ (...args)=>{
      const before=api.snapshot(),old=orientations;
      shapes??=seedStackShapes(before);
      const oldShapes=shapes;
      const result=original(...args),after=api.snapshot();
      if(name==='game_undo' && result){orientations=orientationHistory.get(after[S.UNDO_COUNT]) || Array.from({length:27},()=>IDENTITY);shapes=shapeHistory.get(after[S.UNDO_COUNT])||seedStackShapes(after);shapeEvents=[];}
      else {
        if(after[S.UNDO_COUNT]>before[S.UNDO_COUNT] || result && before[S.UNDO_COUNT]===100 && after[S.REVISION]!==before[S.REVISION] && ['game_preview_core','game_place_core','game_turn','game_hold','game_lock_band','game_debug_piece','game_set_piece_pool','game_set_next'].includes(name))saveVisualHistory(before[S.UNDO_COUNT],old,oldShapes);
        if(name==='game_turn' && result) {
          shapes=moveFreedShapes(shapes,Number(args[0]));
          orientations=old.slice();const move=Number(args[0]),rotation=turnTransform(move,1);
          for(let i=0;i<27;i++)if(movedCell(i,move)) {
            const p=transformPoint(CubeStack.xyz(i).map(v=>v-1),{rotation}).map(v=>Math.round(v)+1),j=p[0]*9+p[1]*3+p[2];
            orientations[j]=composeRotation(rotation,old[i]);
          }
        }
        // A new reconstruction group gets fresh solids; surviving groups keep theirs.
        if(name!=='game_turn')orientations=orientations.map((r,i)=>before.rebuildIds[i]===after.rebuildIds[i]?r:IDENTITY);
      }
      // Only these successful commands produce fresh animation traces. Settings
      // setters leave the old trace intact and must never replay its gravity.
      if(result && after[S.REVISION]!==before[S.REVISION] && ['game_preview_core','game_place_core','game_turn','game_choose','game_hold','game_lock_band','game_debug_piece','game_set_piece_pool'].includes(name)){
        shapeEvents=[];
        for(const event of api.events()){shapes=applyStackShapeEvent(shapes,event);shapeEvents.push(shapes);}
      }
      return result;
    }});
  }
  return api;
}
