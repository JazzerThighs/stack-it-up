import {colors, pieceNames, setPieceColor, resetPalette, subscribePalette} from '../render/palette.js';
export function initializePaletteControls(root = document) {
  const inputs = [];
  for (let id=1;id<=6;id++) {
    const input=root.getElementById('pieceColor'+pieceNames[id]);
    input.value=colors[id];
    input.addEventListener('input',()=>setPieceColor(id,input.value));
    inputs.push([id,input]);
  }
  root.getElementById('resetPieceColors').onclick=resetPalette;
  return subscribePalette(()=>{for (const [id,input] of inputs) input.value=colors[id];});
}
