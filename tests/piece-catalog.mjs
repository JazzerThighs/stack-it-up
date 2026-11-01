import assert from 'node:assert/strict';
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
assert.deepEqual(defaultColors,['#000000',...pieces.map(p=>p.color)]);
for(const letter of ['B','D','F']) {
  const p=pieceByLetter(letter);
  for(const mask of p.placements)assert.equal(placedTetracubeColor(mask),p.color);
}
assert.equal(tetracubeColors.left,'#c8c8c8');assert.equal(tetracubeColors.right,'#505050');
assert.equal(tetracubeColors.branch,'#996633');
assert.deepEqual(pieceByLetter('B').surfaceInventory,[2,3,1]);
assert.deepEqual(pieceByLetter('D').surfaceInventory,[2,2,1]);
console.log('PASS: generated catalog, IDs, colors, chirality and browser inventory');
