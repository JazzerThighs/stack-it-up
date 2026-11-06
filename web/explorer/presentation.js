import {packingCells,practicePair,displayIndex,cellsOf} from './model.js';
import {OFFICIAL_MASKS} from './data-store.js';
import {detectPieces} from './family-exploration.js';
import {detectedColor} from './family-colors.js';
const FULL=(1<<27)-1;
const officialKeys=[...'brogym']; // J, Z, L, S, O, T in the reference frame.
export function packingPresentation(p,mode='canonical') {
  const official=p.familyId===562;
  if(mode==='officialMulticolor')mode=official?'official':'multicolor';
  const palette=Array(27).fill('w');palette[13]='l';
  const center=cellsOf(p.extras).find(i=>[Math.floor(i/9),Math.floor(i/3)%3,i%3].filter(v=>v!==1).length===1);
  if(center!==undefined)palette[center]='k';
  let cells=packingCells(p,palette);
  if(official) {
    const reference={masks:OFFICIAL_MASKS,extras:FULL^OFFICIAL_MASKS.reduce((a,b)=>a|b,0)};
    const pair=practicePair(reference,p);
    if(!pair.compatible)throw Error('Packing does not match the official center configuration');
    cells=pair.right;
    // Extras are aligned with the reference, including the black D center.
    for(let i=0;i<27;i++)if(reference.extras&(1<<i)) {
      cells[displayIndex(i)].color=i===13?'l':i===12?'k':'w';
    }
  }
  const detected=new Map(detectPieces(cells).map(piece=>[piece.id,piece.letter]));
  const fixed=mode==='multicolor'||mode==='official'&&official;
  for(const cell of cells)if(cell.piece>=0)cell.color=mode==='official'&&official
    ?officialKeys[cell.piece]:mode==='multicolor'?'bymogr'[cell.piece]:detectedColor(detected.get(cell.piece),'d');
  const masks=Array(6).fill(0),cellColors=Array(27);
  for(let i=0;i<27;i++){const c=cells[displayIndex(i)];cellColors[i]=c.color;if(c.piece>=0)masks[c.piece]|=1<<i;}
  return {cells,fixed,packing:{...p,masks,extras:FULL^masks.reduce((a,b)=>a|b,0),cellColors},palette:cellColors};
}
