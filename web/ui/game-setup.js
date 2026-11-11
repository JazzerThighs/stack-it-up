import {readGameplay} from './gameplay-settings.js';
import {pieces} from '../engine/queue-pieces.js';

/** Read the setup controls once; application of rules belongs to the session. */
export function readGameSetup($,seed) {
  return {
    seed,rules:readGameplay(),current:+$('debugCurrent').value,held:+$('debugHeld').value,
    releaseRules:[+$('releaseTrigger').value,$('releaseBandaged').checked,$('releaseScattered').checked,+$('releaseSelection').value],
    earlyLock:$('earlyLock').checked,gravityMode:+$('gravityMode').value,
    gravityRules:[$('sliceGravity').checked,$('gravityOneStep').checked],
    sliceClearMode:+$('sliceClearMode').value,fragments:$('fragmentPerk').checked,
    bandaged:$('bandagedFragments').checked,randomCubies:$('randomCubies').checked,rebuildMode:+$('rebuildMode').value,
    pool:pieces.reduce((mask,p)=>mask|($('poolPiece'+p.id).checked?1<<(p.id-1):0),0),
  };
}
