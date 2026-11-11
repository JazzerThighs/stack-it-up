/**
 * @typedef {'catalog'|'family'|'practice'} ExplorerMode
 * @typedef {{cancelPractice:()=>void,leaveFamily:()=>void,show:(mode:ExplorerMode)=>void,enterFamily:()=>unknown,enterPractice:()=>unknown,refresh:()=>void}} ViewEffects
 */
// View lifecycle policy; adapters own DOM and rendering effects.
/** @param {ViewEffects} effects */
export function createViewController(effects) {
  /** @type {ExplorerMode} */
  let mode='catalog';
  let revision=0;
  return {
    get mode(){return mode;},
    /** @param {ExplorerMode} next */
    async select(next){
      if(!['catalog','family','practice'].includes(next))throw Error('Unknown explorer mode');
      mode=next;const token=++revision;
      if(next!=='practice')effects.cancelPractice();
      if(next!=='family')effects.leaveFamily();
      effects.show(next);
      if(next==='family')await effects.enterFamily();
      if(next==='practice')await effects.enterPractice();
      if(token!==revision)return false;
      effects.refresh();return true;
    },
  };
}
