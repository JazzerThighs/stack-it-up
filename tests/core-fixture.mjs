import {pieceByLetter} from '../web/engine/pieces.js';
export function coreFixture(engine){
 engine.game_init(37);engine.game_configure_rules(1);engine.game_set_piece_pool(448,true);engine.game_debug_piece(0,7);
 const branch=pieceByLetter('B'),core=branch.placements.filter(m=>m&(1<<13));
 let gap;
 for(const a of core){for(const b of core){const g=a|b;if(a!==b&&!branch.surfacePlacements.some(m=>(m&g)===m)){gap=g;break;}}if(gap)break;}
 if(!gap)throw Error('No core fixture');
 const words=engine.exportState();words[3]=core.find(m=>m&~gap);words[4]=6;
 for(let i=0;i<27;i++){words[22+i]=(gap&(1<<i))?0:1;words[49+i]=words[22+i];}
 return words;
}
