import assert from 'node:assert/strict';
import {createBrowserFixture} from './fixtures/browser.mjs';
import {createGameFacemaps} from '../web/ui/face-map.js';
import {getViewAppearance,setViewAppearance} from '../web/ui/view-appearance.js';
import {createFamilyFacemaps} from '../web/explorer/family-facemaps.js';
import {readFileSync} from 'node:fs';
import {adaptTransport} from '../web/engine/transport.js';
import {moveLabels,notationMove,formatMove} from '../web/engine/coordinates.js';
import {actionLabel} from '../web/ui/forecast-replay.js';
import {NOTATION,turn, PALETTE} from '../web/explorer/model.js';
import {solidSticker,faceMapCell} from '../web/ui/sticker-grid.js';
import {landedState} from '../web/ui/animations.js';
import {S} from '../web/engine/snapshot.js';

// Use the engine's real face grids so a mirrored basis cannot pass by
// merely selecting the correct nine cells from the middle plane.
const wasm=readFileSync(new URL('../target/wasm32-unknown-unknown/release/cube_stack.wasm',import.meta.url));
const engine=adaptTransport((await WebAssembly.instantiate(wasm)).instance.exports);
engine.game_init(123);
const coordinates=engine.snapshot(), ids=Array.from({length:27},(_,i)=>i);
for(const labels of [moveLabels,NOTATION]){
  for(const [slice,face] of [['M','L'],['E','D'],['S','F']]){
    for(const prime of [false,true]){
      for(const letter of [slice,face]){
        const map=labels.indexOf(letter), move=notationMove(map+(prime?15:0),labels);
        const token=letter+(prime?"'":'');
        assert.equal(formatMove(move,"'",labels),token);
        if(labels===moveLabels) assert.equal(actionLabel({method:'game_turn',arg:move}),token);
        const grid=ids.slice(0,9).map(c=>faceMapCell(coordinates,map,c,labels));
        const after=turn(ids,move);
        assert.deepEqual(grid.map(i=>grid.indexOf(after[i])),
          prime?[2,5,8,1,4,7,0,3,6]:[6,3,0,7,4,1,8,5,2],token);
      }
    }
  }
}

const fixture=createBrowserFixture(['net','stageNet','familyMapPanel','familyFacemaps','familyExplorePanel','familyNet']
  .map(id=>'<div id="'+id+'"></div>').join(''));
fixture.install();
try {
  const state=new Uint32Array(300);
  state[S.PIECE]=1;state[S.ACTIVE]=1;state[S.FLOATING]=2;state[0]=2;state[2]=2;
  for(let c=0;c<54;c++)state[80+c]=c%27;
  for(let c=0;c<9;c++){
    const row=Math.floor(c/3), col=c%3;
    state[80+4*9+c]=row*3+col;
    state[80+5*9+c]=18+row*3+2-col;
    state[80+1*9+c]=row*9+col;
    state[80+2*9+c]=row*9+col*3;
  }
  for(let f=6;f<9;f++){
    const plane=Array.from({length:9},(_,c)=>faceMapCell(state,f,c));
    assert.equal(new Set(plane).size,9);assert.equal(plane[4],13);
    for(const i of plane)assert.equal([Math.floor(i/9),Math.floor(i/3)%3,i%3][f-6],1);
  }
  const hosts=['net','stageNet'].map(fixture.$);
  const draw=createGameFacemaps(hosts);
  for(let move=0;move<30;move++){
    for(const t of [0,.5,.2,1]){
      draw(state,{kind:'turn',move,t});
      const end=landedState(state,move);
      for(const host of hosts)host.children.forEach((group,f)=>{
        group.children[1].children.forEach((cell,c)=>{
          const i=faceMapCell(state,f,c);
          for(const [layer,snapshot] of [[0,state],[1,end]]){
            const occupied=!!(snapshot[i] || ((snapshot[S.ACTIVE]|snapshot[S.FLOATING]) & (1<<i)));
            assert.equal(cell.children[layer].className==='map-layer map-empty',!occupied);
            const overlap=!!(snapshot[i] && ((snapshot[S.ACTIVE]|snapshot[S.FLOATING]) & (1<<i)));
            assert.equal(cell.children[layer].className.includes('map-overlap'),overlap);
          }
          assert.equal(host.style['--map-boundary'],((1-t)*100)+'%');
        });
      });
    }
    draw(state);
    assert.equal(hosts[0].style['--map-boundary'],'100%');
  }
  // Game layers use the palette of the cube that owns each cell.
  for(const [id,index,color] of [['active',1,'#123456'],['stack',2,'#789abc']]){
    const palette=getViewAppearance(id).palette.slice();
    palette[index]=color;
    setViewAppearance(id,'palette',palette);
    setViewAppearance(id,'fragments','cubies');
  }
  setViewAppearance('active','extras','cubies');
  setViewAppearance('active','extraEdgeColor','#abcdef');
  draw(state);
  for(const host of hosts){
    const [current,extra,placed]=host.children[0].children[1].children.map(cell=>cell.children[0]);
    assert.equal(current.style.color,'#123456');
    assert.equal(extra.className,'map-layer map-extra');
    assert.equal(extra.style.color,'#abcdef');
    assert.equal(placed.style.color,'#789abc');
  }
  const solidSettings={solidGray:false,solidUniform:false};
  for(const [slot,count] of [4,6,8,12,20,0,6,10,12].entries()){
    const marker=solidSticker(slot,'#123456',false,solidSettings);
    assert.equal(marker.kind,count?'number':'ball');
    assert.equal(marker.text,count?String(count):'');
    assert.equal(marker.color,'rgb(18,52,86)');
  }

  // Turning part of the O breaks its detected shape. Its fixed identity now
  // selects a tetrahedron, even for cells that didn't move during the turn.
  const cells=Array(27).fill(null);
  for(const i of [0,1,3,4]) cells[i]={piece:0,color:'b',assemblyOrigin:i};
  cells[26]={piece:-1,color:'w',assemblyOrigin:26};
  const view={cells,initial:cells,assembly:{whole:'whole',fragments:'solids',extras:'cubies'},
    invalidate(){},setState(cells,animation){family(view,cells,animation);}};
  const family=createFamilyFacemaps(fixture.$,state,()=>view);
  fixture.$('familyMapPanel').hidden=true;
  fixture.$('familyFacemaps').onclick();
  const familyNet=fixture.$('familyNet');
  const markers=layer=>familyNet.children.flatMap(group=>group.children[1].children.map(cell=>{
    const node=cell.children[layer];
    return [node.className,node.style.color,node.textContent];
  }));
  const start=markers(0);
  assert(start.some(([kind,color])=>kind==='map-layer map-filled' && color===PALETTE.y));
  assert(start.some(([kind])=>kind==='map-layer map-extra'));
  const move=Array.from({length:30},(_,i)=>i).find(i=>{
    view.setState(turn(cells,i));
    return markers(0).some(([kind])=>kind==='map-layer map-number');
  });
  assert.notEqual(move,undefined);
  const end=markers(0);
  assert(end.some(([kind,,text])=>kind==='map-layer map-number' && text==='4'));
  for(const t of [0,.75,.25,1]){
    view.setState(cells,{kind:'turn',move,t});
    assert.equal(familyNet.style['--map-boundary'],(1-t)*100+'%');
    assert.deepEqual(markers(0),start);
    assert.deepEqual(markers(1),end);
  }
  view.setState(cells);
  assert.deepEqual(markers(0),start);
  view.setState(turn(cells,move));
  assert.deepEqual(markers(0),end);
  view.assembly.extras='solids';
  view.setState(cells);
  assert(markers(0).some(([kind])=>kind==='map-layer map-ball'));
} finally {fixture.restore();}
console.log('PASS: Game and Explorer sticker appearance, overlap outlines, face counts and turn endpoints.');
