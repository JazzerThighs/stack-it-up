import {refreshStyleTuning} from './style-tuning.js';
import {assemblyUsesSolids} from '../render/assembly.js';
import {displaySettings} from './display-settings.js';
import {S} from '../engine/snapshot.js';

// Disable containers, never rewrite preferences or the engine-owned control locks.
export function refreshSettingsAvailability(root = document, state = null) {
  const $ = id => root.getElementById(id);
  const checked = id => $(id).checked;
  const value = id => $(id).value;
  const enabled = (id, on) => {
    $(id).disabled = !on;
    $(id + 'Reason').hidden = !!on;
  };
  refreshStyleTuning(root);
  const fragments = checked('fragmentPerk');
  const random = value('releaseTrigger') !== '0';
  const rebuilding = value('rebuildMode') !== '0' || !!state?.[S.REBUILD_MASK];
  const floating = !!state?.[S.FLOATING_COUNT];
  const bands = state?.slice(S.BAND_IDS, S.BAND_IDS + 27).some(Boolean);
  const lottery = random || value('rebuildMode') === '2' || (fragments && checked('randomCubies'));
  enabled('gravityOptions0', value('gravityMode') !== '1');
  enabled('gravityOptions1', value('gravityMode') !== '1');
  enabled('brokenOptions0', fragments);
  enabled('brokenOptions1', fragments);
  enabled('randomReleaseOptions0', random || floating);
  enabled('selectionOptions0', lottery);
  enabled('scatteredOptions0', rebuilding || random || floating);
  enabled('earlyLockOptions0', bands || (fragments && checked('bandagedFragments')) || (random && checked('releaseBandaged')));
  enabled('arrowOptions', checked('showArrows'));
  enabled('ringOptions', checked('hoverRings'));
  enabled('rebuildShapeOptions', rebuilding);
  enabled('solidOptions', ['activePieces','stackPieces'].some(k=>assemblyUsesSolids(displaySettings[k])));
  enabled('solidColorOptions', checked('solidUniform'));
  enabled('solidGrayOptions', !checked('solidUniform'));
  enabled('ditherTuning', value('pieceAppearance') === 'dither');
  enabled('asciiTuning', value('pieceAppearance') === 'ascii');
  enabled('transparencyStyle', value('pieceAppearance') !== 'dither');
  enabled('splitGridOptions', !checked('combined'));
  enabled('combinedGridOptions', checked('combined'));
  enabled('rearGridOptions', checked('combined') ? checked('combinedGrid') : checked('controlGrid'));
  enabled('layerOptions', checked('customLayers'));
  const scattered = checked('releaseScattered');
  $('rebuildRequirements').textContent = scattered
    ? 'Scattered locking is on: rebuilding cubies do not need to form tetrominos. They lock when the current sphere piece succeeds, provided none overlaps the stack.'
    : 'Rebuilding cubies must form complete planar tetrominos, clear of the stack, when the current sphere piece locks.';
  $('scatteredExplanation').textContent = scattered
    ? 'Current rule: freed rebuilding pieces and random stack groups may lock in separate locations when the sphere piece succeeds.'
    : 'Current rule: rebuilding pieces must form complete tetrominos; randomly freed stack groups must be connected when they lock.';
  $('selectionExplanation').textContent = [
    'Each eligible group has an equal chance. Exception: the random-single-cubie perk chooses uniformly among cubies.',
    'Chances follow occupied cells: a four-cell piece is four times as likely as a single fragment.',
    'Try one of all 27 cube cells per release attempt. Empty or ineligible cells miss; there is no retry.',
    'Choose the largest eligible connected group, breaking equal-size ties randomly.',
    'Choose the smallest eligible connected group, breaking equal-size ties randomly.',
  ][Number(value('releaseSelection'))] || '';
  const rewards = [];
  if (fragments) rewards.push(checked('randomCubies') ? 'broken fragments and random cubies' : 'broken fragments');
  if (value('rebuildMode') !== '0') rewards.push(value('rebuildMode') === '1' ? 'all whole pieces' : 'one random whole piece per plane');
  if (random) rewards.push(value('releaseTrigger') === '1' ? 'one stack group per plane' : 'one stack group per new piece');
  $('settingsRulesSummary').textContent = 'Freed pieces: ' + (rewards.length ? rewards.join('; ') + '.' : 'none from future events.') + (floating ? ' Freed pieces are currently in play.' : '');
}
