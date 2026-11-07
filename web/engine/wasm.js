import {seedStackShapes,moveFreedShapes,applyStackShapeEvent} from './stack-shapes.js';
import {visualSettings} from '../render/visual-settings.js';
import {IDENTITY,turnTransform,composeRotation,movedCell,transformPoint} from '../render/transforms.js';
import {CubeStack} from './coordinates.js';
import { S, SNAPSHOT_WORDS, EVENT_WORDS } from "./snapshot.js";
// ABI v4. Always copy buffers before another export can grow Wasm memory.
export async function createEngine(options) {
  const response = await fetch(new URL("../cube_stack.wasm", import.meta.url));
  if (!response.ok) throw Error("Unable to load game engine");
  const { instance } = await WebAssembly.instantiate(
    await response.arrayBuffer(),
  );
  return adaptEngine(instance.exports,options);
}
export function adaptEngine(w,{trackSolids=true}={}) {
  if (typeof w.game_set_piece_pool !== "function") throw Error("Incompatible engine: rebuild for spatial pieces.");
  if (typeof w.game_lock_band !== "function" || typeof w.band_mesh_ptr !== "function")
    throw Error("Incompatible game engine: rebuild the complete app for early locking.");
  const words = (ptr, len) =>
    new Uint32Array(w.memory.buffer, ptr, len).slice();
  let orientations=Array.from({length:27},()=>IDENTITY),orientationHistory=new Map();
  let shapes=null,shapeHistory=new Map(),shapeEvents=[];
  const api = {
    game_init: w.game_init,
    game_piece_pool: w.game_piece_pool,
    game_set_piece_pool: w.game_set_piece_pool,
    game_choice_mask: w.game_choice_mask,
    game_rules: () => w.game_rules() >>> 0,
    game_configure_rules: w.game_configure_rules,
    game_debug_piece: w.game_debug_piece,
    game_set_next: w.game_set_next,
    game_early_lock: w.game_early_lock,
    exportState() {
      const len = w.game_export();
      return Array.from(words(w.game_transfer_ptr(), len));
    },
    importState(data) {
      if (!Array.isArray(data) || data.length > 512 || !data.every(v => Number.isInteger(v) && v >= 0 && v <= 0xffffffff)) return false;
      const ptr = w.game_transfer_ptr();
      new Uint32Array(w.memory.buffer, ptr, data.length).set(data);
      return !!w.game_import(data.length);
    },
    game_core_option:w.game_core_option,
    game_preview_core:mask=>w.game_select_core(mask,0),
    game_place_core:mask=>w.game_select_core(mask,1),
    game_turn: w.game_turn,
    game_choose: w.game_choose,
    game_undo: w.game_undo,
    game_hold: w.game_hold,
    game_set_gravity: w.game_set_gravity,
    game_set_gravity_rules: w.game_set_gravity_rules,
    game_gravity_rules: w.game_gravity_rules,
    game_set_slice_clears: w.game_set_slice_clears,
    game_slice_clear_mode: w.game_slice_clear_mode,
    game_set_modes: w.game_set_modes,
    game_set_early_lock: w.game_set_early_lock,
    game_lock_band: w.game_lock_band,
    bandMesh(mask,cornerO=false) {
      const ptr = w.band_mesh_elbows_ptr(mask,Number(cornerO),visualSettings.jellyBevel/100,visualSettings.jellyOpening/100,visualSettings.jellyProfile,visualSettings.jellyElbows/100);
      return new Float32Array(w.memory.buffer, ptr, w.band_mesh_len()).slice();
    },
    game_set_fragments: w.game_set_fragments,
    game_set_release_rules:w.game_set_release_rules,
    game_release_rules:w.game_release_rules,
    snapshot() {
      const result = words(w.state_ptr(), w.state_len());
      if (result.length !== SNAPSHOT_WORDS || result[S.ABI_VERSION] !== 4)
        throw Error("Incompatible game engine: rebuild the complete app.");
      if(shapes)result.stackShapes=shapes.stack;
      result.canUndo=!!w.game_can_undo();
      result.groupRequirements=Uint32Array.from({length:27},(_,i)=>w.group_requirement_at(i));
      result.gameplayRules=w.game_rules() >>> 0;
      result.rebuildIds=Uint32Array.from({length:27},(_,i)=>w.active_group_at?.(i)||w.rebuild_id_at?.(i)||0);
      Object.defineProperty(result,'solidRotations',{value:orientations.slice(),configurable:true});
      return result;
    },
    mesh() {
      const ptr = w.mesh_ptr();
      return new Float32Array(w.memory.buffer, ptr, w.mesh_len()).slice();
    },
    events() {
      const ptr = w.events_ptr(),
        v = words(ptr, w.events_len()),
        out = [];
      for (let i = 0; i < v.length; i += EVENT_WORDS)
        out.push({
          kind: v[i],
          mask: v[i + 1],
          face: v[i + 2],
          board: v.slice(i + 3, i + 30),
          ids: v.slice(i + 30, i + 57),
          origins: v.slice(i + 57, i + 84),
          floatMask: v[i + 84],
          fragmentTurns: v[i + 85],
        });
      out.forEach((event,i)=>{if(shapeEvents[i])event.stackShapes=shapeEvents[i].stack;});
      return out;
    },
    placement_previews(moves) {
      const found = new Map();
      for (const move of moves) {
        const ptr = w.previews_ptr(move),
          v = words(ptr, w.previews_len());
        for (let i = 0; i < v.length; i += 3) {
          const old = found.get(v[i]);
          found.set(v[i], {
            mask: v[i],
            piece: v[i + 1],
            sourceMask: v[i + 2] | (old?.sourceMask || 0),
          });
        }
      }
      return [...found.values()];
    },
  };
  if(!trackSolids)return api;
  function saveVisualHistory(count,rotation,shape){
    if(count>=100)for(const history of [orientationHistory,shapeHistory]){for(let i=0;i<99;i++)history.set(i,history.get(i+1));history.delete(99);}
    const slot=Math.min(count,99);orientationHistory.set(slot,rotation);shapeHistory.set(slot,shape);
  }
  const init=api.game_init;
  api.game_init=(...args)=>{orientations=Array.from({length:27},()=>IDENTITY);orientationHistory.clear();shapeHistory.clear();shapeEvents=[];const result=init(...args);shapes=seedStackShapes(api.snapshot());return result;};
  const load=api.importState;
  api.importState=data=>{const before=api.snapshot(),old=orientations,ok=load(data);if(ok){saveVisualHistory(before[S.UNDO_COUNT],old,shapes);shapeEvents=[];shapes=seedStackShapes(api.snapshot());orientations=Array.from({length:27},()=>IDENTITY);}return ok;};
  for(const name of ['game_preview_core','game_place_core','game_set_piece_pool','game_configure_rules','game_debug_piece','game_turn','game_choose','game_hold','game_lock_band','game_set_next','game_set_gravity','game_set_gravity_rules','game_set_slice_clears','game_set_modes','game_set_early_lock','game_set_fragments','game_set_release_rules','game_undo']) {
    const original=api[name];if(!original)continue;
    api[name]=(...args)=>{
      const before=api.snapshot(),old=orientations;
      shapes??=seedStackShapes(before);
      const oldShapes=shapes;
      const result=original(...args),after=api.snapshot();
      if(name==='game_undo' && result){orientations=orientationHistory.get(after[S.UNDO_COUNT]) || Array.from({length:27},()=>IDENTITY);shapes=shapeHistory.get(after[S.UNDO_COUNT])||seedStackShapes(after);shapeEvents=[];}
      else {
        if(after[S.UNDO_COUNT]>before[S.UNDO_COUNT] || result && before[S.UNDO_COUNT]===100 && after[S.REVISION]!==before[S.REVISION] && ['game_preview_core','game_place_core','game_turn','game_hold','game_lock_band','game_debug_piece','game_set_piece_pool','game_set_next'].includes(name))saveVisualHistory(before[S.UNDO_COUNT],old,oldShapes);
        if(name==='game_turn' && result) {
          shapes=moveFreedShapes(shapes,args[0]);
          orientations=old.slice();const move=args[0],rotation=turnTransform(move,1);
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
    };
  }
  return api;
}
