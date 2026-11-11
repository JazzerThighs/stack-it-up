import {SHARE_FORMAT,SHARE_VERSION,SHARE_DIMENSIONS} from '../engine/game-contract.js';
import {S} from '../engine/snapshot.js';

export function encodeSharedState(engine,chooseNext=false) {
  const s=engine.snapshot(),hex=v=>(v>>>0).toString(16).padStart(7,'0');
  const masks={active:hex(s[S.ACTIVE]),floating:hex(s[S.FLOATING]),rebuilding:hex(s[S.REBUILD_MASK]),stack:[]};
  for(let color=1;color<=9;color++)masks.stack.push(hex(s.slice(0,27).reduce((mask,c,i)=>c===color?mask|(1<<i):mask,0)));
  return JSON.stringify({format:SHARE_FORMAT,version:SHARE_VERSION,dimensions:SHARE_DIMENSIONS,masks,words:engine.exportState().map(hex),chooseNext});
}
export function decodeSharedState(text) {
  if(typeof text!=='string')throw Error('Unsupported state format or dimensions.');
  if(text.length>16000)throw Error('State is too large.');
  const data=JSON.parse(text);
  if(!data||data.format!==SHARE_FORMAT||data.version!==SHARE_VERSION||JSON.stringify(data.dimensions)!==JSON.stringify(SHARE_DIMENSIONS)||!Array.isArray(data.words)||!data.words.every(v=>typeof v==='string'&&/^[0-9a-f]{1,8}$/i.test(v)))throw Error('Unsupported state format or dimensions.');
  return {words:data.words.map(v=>parseInt(v,16)),chooseNext:data.chooseNext===true};
}

/** Session state and engine setup/import policy, independent of dialogs/rendering. */
export function createGameSession({engine,isBusy}) {
  let starting=false,started=false;
  return {
    get starting(){return starting;},get started(){return started;},
    get canChooseNext(){const r=engine()?.game_rules();return r===0xffffffff||!!(r&1);},
    beginSetup(){if(isBusy())return false;starting=true;return true;},
    leaveSetup(){starting=false;},
    resume(){started=true;},
    start(config) {
      if(isBusy()||starting||!engine())return false;
      const e=engine();
      e.game_init(config.seed);
      e.game_set_release_rules(...config.releaseRules);
      e.game_set_early_lock(config.earlyLock);
      e.game_set_gravity(config.gravityMode);
      e.game_set_gravity_rules(...config.gravityRules);
      e.game_set_slice_clears(config.sliceClearMode);
      e.game_set_fragments(config.fragments);
      e.game_set_modes(config.bandaged,config.fragments&&config.randomCubies,config.rebuildMode);
      e.game_configure_rules(config.rules);
      e.game_set_piece_pool(config.pool,true);
      if(config.rules&1){if(config.current)e.game_debug_piece(0,config.current);e.game_debug_piece(1,config.held);}
      return true;
    },
    setNext(piece){return !starting&&!isBusy()&&!!engine()?.game_set_next(piece);},
    share(chooseNext=false){return isBusy()||!engine()?null:encodeSharedState(engine(),chooseNext);},
    load(text) {
      if(isBusy()||!engine())return null;
      const data=decodeSharedState(text);
      if(!engine().importState(data.words))throw Error('Invalid state. Your current game is unchanged.');
      started=true;
      return {chooseNext:data.chooseNext};
    },
  };
}
