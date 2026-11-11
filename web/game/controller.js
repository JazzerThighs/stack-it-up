import {S} from '../engine/snapshot.js';

/** Own command admission and async lifecycle; effects own presentation.
 * @param {import("./controller-types.js").ControllerOptions} options
 */
export function createGameController({engine,state,isBusy,isStarting,isLockMode,isTurnLocked=isLockMode,setBusy,copyState,effects}) {
  const getEngine=()=>{const current=engine();if(!current)throw Error("Engine is not ready");return current;};
  let running=false;
  const blocked=()=>running||isBusy()||!engine();
  /** @param {import("./controller-types.js").Command} kind @param {(engine:import("../engine/types.js").EngineTransport)=>number|boolean|void} invoke @param {import("./controller-types.js").Details} details */
  async function execute(kind,invoke,details={}) {
    if(blocked())return false;
    const effect=effects[kind]||{};
    const before=copyState(state());
    running=true;
    try {
      if(!invoke(getEngine())) { effect.rejected?.(details);return false; }
      const transaction={before,after:getEngine().snapshot(),trace:getEngine().events(),...details};
      setBusy(true);
      try { await effect.present?.(transaction); }
      finally { setBusy(false);effect.settled?.(transaction); }
      effect.complete?.(transaction);
      return true;
    } finally {
      running=false;
    }
  }
  function coreOptions() {
    /** @type {number[]} */
    const masks=[];
    const current=engine();
    if(!current?.game_core_option)return masks;
    for(let i=0;i<144;i++){const mask=current.game_core_option(i);if(!mask)break;masks.push(mask);}
    return masks;
  }
  return {
    get running(){return running;},
    coreOptions,
    /** @param {number} move */
    play(move,fromT=0) {
      if(isTurnLocked()){effects.turn.locked?.();return Promise.resolve(false);}
      if(blocked()||isStarting()||state()[S.PENDING_FACES])return Promise.resolve(false);
      return execute('turn',e=>e.game_turn(move),{move,fromT});
    },
    hold() {
      if(blocked()||state()[S.OVER]||state()[S.PENDING_FACES]||state()[S.HOLD_USED])return Promise.resolve(false);
      return execute('hold',e=>e.game_hold());
    },
    /** @param {number} face */
    choose(face) {
      if(blocked()||!state()[S.PENDING_FACES])return Promise.resolve(false);
      return execute('choose',e=>e.game_choose(face));
    },
    /** @param {number} cell @param {boolean} earlyLock */
    lockBand(cell,earlyLock) {
      if(blocked()||!isLockMode()||state()[S.OVER]||state()[S.PENDING_FACES])return Promise.resolve(false);
      return execute('lock',e=>{e.game_set_early_lock(Number(earlyLock));return e.game_lock_band(cell);});
    },
    /** @param {number} direction */
    selectCore(direction,place=false) {
      if(blocked()||isStarting())return Promise.resolve(false);
      const masks=coreOptions();if(!masks.length)return Promise.resolve(false);
      const current=masks.indexOf(state()[S.ACTIVE]);
      const mask=place?state()[S.ACTIVE]:masks[current<0?(direction<0?masks.length-1:0):(current+direction+masks.length)%masks.length];
      if(!place) {
        if(!getEngine().game_preview_core(mask)){effects.core.rejected?.();return Promise.resolve(false);}
        effects.core.preview?.();return Promise.resolve(true);
      }
      return execute('core',e=>e.game_place_core(mask));
    },
    /** @param {number} held @param {number} piece */
    debugPiece(held,piece) {
      if(blocked()||isStarting())return Promise.resolve(false);
      return execute('debug',e=>e.game_debug_piece(held,piece));
    },
    /** @param {import("./controller-types.js").ReplayStep} step */
    replay(step) {
      if(blocked()||isStarting())return Promise.resolve(false);
      if(!['game_turn','game_choose','game_lock_band','game_place_core'].includes(step.method))return Promise.resolve(false);
      return execute('replay',e=>e[step.method](step.arg));
    },
    undo() {
      if(blocked()||isStarting()||!getEngine().game_undo())return false;
      effects.undo?.();return true;
    },
  };
}
