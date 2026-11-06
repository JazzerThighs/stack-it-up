import {turn,parseMoves} from './model.js';
import {CubeStack} from '../engine/coordinates.js';
const slots=Array.from({length:27},(_,i)=>i),inverse=m=>(m+15)%30;
const moves=[0,1,2,3,4,5,15,16,17,18,19,20];
const permutations=Array.from({length:30},(_,m)=>{const result=turn(slots,m),dest=[];result.forEach((source,target)=>dest[source]=target);return dest;});
const kinds=slots.map(i=>CubeStack.xyz(i).filter(v=>v!==1).length);
const cycles=new Map();
function cycleLibrary(kind){
 if(cycles.has(kind))return cycles.get(kind);
 const algorithm=parseMoves((kind===3?"R U R' D R U' R' D'":"R U' R U R U R U' R' U' R2").split(' '));
 const result=algorithm.reduce(turn,slots),dest=[];result.forEach((source,target)=>dest[source]=target);
 const a=slots.find(i=>dest[i]!==i),base=[a,dest[a],dest[dest[a]]];
 if(base.some(i=>kinds[i]!==kind)||slots.filter(i=>dest[i]!==i).length!==3)throw Error('Invalid three-cycle generator');
 const queue=[base],paths=new Map([[base.join(','),[]]]);
 for(let n=0;n<queue.length;n++)for(const move of moves){
  const next=queue[n].map(i=>permutations[move][i]),key=next.join(',');
  if(!paths.has(key)){paths.set(key,[...paths.get(queue[n].join(',')),move]);queue.push(next);}
 }
 const library={algorithm,paths};cycles.set(kind,library);return library;
}
function rotateThree(a,b,c,kind){
 const {algorithm,paths}=cycleLibrary(kind),path=paths.get([a,b,c].join(','));
 if(!path)throw Error('No legal three-cycle');
 return [...path.slice().reverse().map(inverse),...algorithm,...path];
}
export function compactMoves(sequence){
 const result=[];
 for(const move of sequence){const base=move%15,amount=move<15?1:3,last=result.at(-1);if(last?.base===base){last.amount=(last.amount+amount)%4;if(!last.amount)result.pop();}else result.push({base,amount});}
 return result.flatMap(({base,amount})=>amount===3?[base+15]:Array(amount).fill(base));
}
// Positions alone matter here: cells carry piece identity, not sticker orientation.
// Center rotations followed by pure corner/edge three-cycles construct a witness.
export function planPracticePath(source,target){
 let current=source.slice();const sequence=[];
 const apply=word=>{for(const m of word)current=turn(current,m);sequence.push(...word);};
 if(current[13]!==target[13])throw Error('Core identities differ');
 const centers=slots.filter(i=>kinds[i]===1),key=cells=>centers.map(i=>cells[i]).join(','),wanted=key(target);
 const queue=[{cells:current,path:[]}],seen=new Set([key(current)]);let alignment=null;
 for(let n=0;n<queue.length;n++){
  const node=queue[n];if(key(node.cells)===wanted){alignment=node.path;break;}
  for(const m of [6,7,8,21,22,23]){const next=turn(node.cells,m),k=key(next);if(!seen.has(k)){seen.add(k);queue.push({cells:next,path:[...node.path,m]});}}
 }
 if(!alignment)throw Error('Center configurations cannot be aligned');apply(alignment);
 for(const kind of [3,2]){
  const positions=slots.filter(i=>kinds[i]===kind),available=positions.slice();
  const labels=positions.map(i=>{const j=available.findIndex(p=>target[p]===current[i]);if(j<0)throw Error('Piece compositions differ');return available.splice(j,1)[0];});
  let parity=0;for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)if(labels[i]>labels[j])parity^=1;
  if(parity){let pair=null;for(let i=0;i<positions.length&&!pair;i++)for(let j=i+1;j<positions.length;j++)if(current[positions[i]]===current[positions[j]]){pair=[i,j];break;}
   if(!pair)throw Error('Permutation parity cannot be matched');const [i,j]=pair;[labels[i],labels[j]]=[labels[j],labels[i]];
  }
  let guard=0;
  while(positions.some((p,i)=>labels[i]!==p)){
   if(guard++>30)throw Error('Path construction failed');
   const a=positions.find(p=>labels[positions.indexOf(p)]!==p),b=positions[labels.indexOf(a)],c=positions.find(p=>p!==a&&p!==b&&labels[positions.indexOf(p)]!==p);
   if(c===undefined)throw Error('Unresolved parity');
   apply(rotateThree(b,a,c,kind));
   const ai=positions.indexOf(a),bi=positions.indexOf(b),ci=positions.indexOf(c),old=labels.slice();labels[ai]=old[bi];labels[ci]=old[ai];labels[bi]=old[ci];
  }
 }
 if(current.some((v,i)=>v!==target[i]))throw Error('Path verification failed');
 const compact=compactMoves(sequence),verified=compact.reduce(turn,source);
 if(verified.some((v,i)=>v!==target[i]))throw Error('Compacted path verification failed');return compact;
}
