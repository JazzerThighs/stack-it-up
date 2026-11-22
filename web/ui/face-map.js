import {S} from '../engine/snapshot.js';
import {activePieceColor} from '../engine/queue-pieces.js';
import {landedState} from './animations.js';
import {createStickerGrid,solidSticker} from './sticker-grid.js';
import {getViewAppearance,hasViewAppearance} from './view-appearance.js';
import {displaySettings} from './display-settings.js';
import {assemblyKind} from '../render/assembly.js';
import {extraCubieColor} from '../render/extra-colors.js';
import {identifyMask} from '../explorer/family-exploration.js';
import {placedTetracubeColor} from '../render/tetracube-colors.js';
import {rebuildSlots} from '../render/active-cubie.js';
import {pieceIdentitySlots} from '../render/piece-mesh.js';
import {rgb} from '../render/geometry.js';

function gameStickers(state, active, stack, slots, legacyActive, spatialStack) {
  const stackMasks = new Map(), activeMasks = new Map(), stackSlots = pieceIdentitySlots(state,state.subarray(S.IDS,S.IDS+27));
  const group = i => !(state[S.FLOATING] & (1<<i)) ? 'current' : state.rebuildIds?.[i] ? 'rebuild'+state.rebuildIds[i]
    : state[S.BAND_IDS+i] ? 'band'+state[S.BAND_IDS+i] : 'extra'+i;
  const stackKey = i => state[S.IDS+i]+':'+state[i];
  for (let i=0;i<27;i++) {
    if (state[i]) {
      const key=stackKey(i);
      stackMasks.set(key,(stackMasks.get(key)||0)|(1<<i));
    }
    if ((state[S.ACTIVE]|state[S.FLOATING]) & (1<<i)) {
      const key=group(i);
      activeMasks.set(key,(activeMasks.get(key)||0)|(1<<i));
    }
  }
  return Array.from({length:27},(_,i)=>{
    if ((state[S.ACTIVE]|state[S.FLOATING]) & (1<<i)) {
      const key=group(i), extra=key.startsWith('extra'), current=key==='current';
      const color=current ? active.palette[activePieceColor(state[S.PIECE],state[S.ACTIVE],i)]
        : state[S.REBUILD_COLORS+i] ? active.palette[state[S.REBUILD_COLORS+i]]
        : extra ? extraCubieColor(i,active) : '#ffffff';
      const legacyBall=current && legacyActive && (state[S.ACTIVE] & (1<<13));
      const kind=assemblyKind(active,!!identifyMask(activeMasks.get(key)),extra);
      let sticker;
      if (legacyBall) sticker={kind:'ball',color:'rgb('+rgb(color).map(v=>Math.round(255*(v*.6+.4))).join(',')+')'};
      else if (kind==='solids' && current) sticker={kind:'ball',color};
      else if (kind==='solids') {
        const slot=slots.get(state.rebuildIds?.[i]) ?? Math.max(0,(state[S.BAND_IDS+i]||state[S.REBUILD_COLORS+i]||1)-1);
        sticker=solidSticker(slot,color,extra,active);
      } else sticker={kind:extra?'extra':'filled',color};
      sticker.overlap=!!state[i];
      return sticker;
    }
    if (!state[i]) return null;
    const mask=stackMasks.get(stackKey(i)), valid=!!identifyMask(mask);
    const color=stack.palette[state[i]];
    if (assemblyKind(stack,valid)==='solids') return solidSticker(stackSlots.get(state[S.IDS+i]),color,false,stack);
    const spatial=spatialStack && placedTetracubeColor(mask);
    return {kind:'filled',color:spatial||color};
  });
}

export function createGameFacemaps(hosts) {
  const grids=hosts.map(host => createStickerGrid(host));
  let prevState,prevMove,before,after,slots=new Map();
  return (state,animation) => {
    if (!state) return;
    const moving=animation?.kind==='turn';
    if (!moving || prevState!==state || animation.move!==prevMove) {
      const active=getViewAppearance('active'), stack=getViewAppearance('stack');
      slots=rebuildSlots(state,slots);
      const legacyActive=!hasViewAppearance('active');
      const spatialStack=!hasViewAppearance('stack') && displaySettings.stackPieces!=='retained';
      before=gameStickers(state,active,stack,slots,legacyActive,spatialStack);
      after=moving?gameStickers(landedState(state,animation.move),active,stack,slots,legacyActive,spatialStack):before;
      prevState=state;prevMove=moving?animation.move:null;
    }
    for(const render of grids) render(state,before,after,moving?animation.t:0);
  };
}
