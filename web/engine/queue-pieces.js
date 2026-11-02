import {pieces as catalog} from './pieces.js';
export const choices = id => id===10 ? [4,3] : id===11 ? [5,6] : [id];
export const pieces = [...catalog,
  {id:10,letter:'J/L',name:'J/L free tetromino',choices:[4,3],surfaceInventory:[1,2,2]},
  {id:11,letter:'S/Z',name:'S/Z free tetromino',choices:[5,6],surfaceInventory:[1,2,1]},
];
export const isSpatial = id => id>=7 && id<=9;
// Each option remains upright on its side of the fraction-like slash.
export function freePreview(id, colors) {
  const [left,right]=choices(id);
  const draw=(piece,x,y)=>{
    const shape=catalog[piece-1].planar;
    const w=Math.max(...shape.map(p=>p[0]))+1,h=Math.max(...shape.map(p=>p[1]))+1;
    return shape.map(([u,v])=>
      `<rect x="${x+(30-w*10)/2+u*10}" y="${y+(30-h*10)/2+v*10}" width="9" height="9" rx="1.5" fill="${colors[piece]}"/>`).join('');
  };
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 64">${draw(left,2,2)}<path d="M26 60L46 4" stroke="#d8e7ed" stroke-width="2"/>${draw(right,40,32)}</svg>`)}")`;

}

export function activePieceColor(piece, active, cell) {
  const options=choices(piece);
  if (options.length===1) return options[0];
  let before=active & ((1<<cell)-1), rank=0;
  while(before) {before&=before-1;rank++;}
  return options[rank%2];
}
