import assert from 'node:assert/strict';
import {startupDefaults} from '../web/ui/startup-defaults.js';
import {readFile} from 'node:fs/promises';
import {pieces,pieceById,pieceByLetter} from '../web/engine/pieces.js';
import {placedTetracubeColor,tetracubeColors} from '../web/render/tetracube-colors.js';
import {defaultColors,pieceNames} from '../web/render/palette.js';
const source=JSON.parse(await readFile(new URL('../data/pieces.json',import.meta.url),'utf8'));
assert.equal(pieces.length,9);
for(const p of pieces) {
  const seed=source.pieces[p.id-1];
  for(const key of Object.keys(seed)) assert.deepEqual(p[key],seed[key]);
  assert.equal(pieceById(p.id),p);assert.equal(pieceByLetter(p.letter),p);
  assert(Object.isFrozen(p.cells[0]));
}
assert.equal(pieceById(0),undefined);assert.equal(pieceById(1.5),undefined);
assert.equal(pieceByLetter('b'),undefined,'case is metadata, not a separate identity');
assert.deepEqual(pieceNames,['','O','T','L','J','S','Z','B','D','F']);
// Piece identity is fixed; the author chooses its palette independently.
assert.deepEqual(defaultColors,['#000000',...pieces.map(p=>startupDefaults.palette[p.letter].toLowerCase())]);
for(const letter of ['B','D','F']) {
 const p=pieceByLetter(letter);
 for(const mask of p.placements)assert.equal(placedTetracubeColor(mask),defaultColors[p.id]);
}
assert.equal(tetracubeColors.left, defaultColors[pieceByLetter('F').id]);
assert.equal(tetracubeColors.right, defaultColors[pieceByLetter('D').id]);
assert.equal(tetracubeColors.branch,defaultColors[pieceByLetter('B').id]);
assert.deepEqual(pieceByLetter('B').surfaceInventory,[2,3,1]);
assert.deepEqual(pieceByLetter('D').surfaceInventory,[2,2,1]);
console.log('PASS: generated catalog, IDs, colors, chirality and browser inventory');
