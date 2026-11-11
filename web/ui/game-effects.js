import {S} from '../engine/snapshot.js';
import {moveLabels} from '../engine/coordinates.js';

/** DOM/renderer effects for commands; no engine mutations belong here. */
export function createGameEffects({$,state,renderers,names,animate,resolveAnimations,update,invalidate,syncChoices,clearGhost,focusChoice}) {
  const active=()=>renderers()[0];
  const resolve=({before,after,trace})=>resolveAnimations(before,after,trace);
  const clear=()=>{clearGhost();active().ghost=null;active().preview=0;};
  const choicesSettled=()=>{syncChoices();invalidate();};
  return {
    turn:{
      locked(){ $('message').textContent='Select Resume turns to turn slices again.'; },
      rejected(){active().setState(state());invalidate();$('message').textContent='That turn would split a bandaged fragment.';},
      async present({before,after,trace,move,fromT}) {
        const label=`${moveLabels[move%15]}${move>=15?"'":''}`;
        $('message').textContent=`Turning ${label}.`;
        await animate(220*(1-fromT),t=>active().setState(before,{kind:'turn',move,t:fromT+(1-fromT)*t}));
        if(trace.length)await resolveAnimations(before,after,trace,move);
        else update(`${label} · Build ${names[after[S.PIECE]]}.`);
      },
      settled:choicesSettled,
      complete(){if(state()[S.PENDING_FACES])focusChoice();},
    },
    hold:{
      async present(transaction) {
        active().hover=null;
        if(transaction.trace.length)await resolve(transaction);
        else {
          update('Piece held. Build the new target.');
          await animate(180,t=>active().setState(transaction.after,{kind:'spawn',t}));
          active().setState(transaction.after);
        }
      },
      settled:invalidate,
    },
    choose:{
      async present(transaction){active().preview=0;await resolve(transaction);},
      settled:choicesSettled,
      complete(){($('classicControls').checked?$('tab-face'):$('settingsOpen')).focus();},
    },
    lock:{
      rejected(){ $('message').textContent='This white group cannot lock here: its cells must be clear of the stack.'; },
      async present(transaction){active().hover=null;await resolve(transaction);},
      complete(){update('White group locked. Your colored piece is unchanged; switch back to turns to continue.');},
    },
    core:{
      rejected(){update('Freed groups must be ready before placing the core piece.');},
      preview(){update('Core orientation preview. Place here to confirm, or keep turning.');},
      present:resolve,
      settled(){update();},
    },
    debug:{
      async present(transaction){clear();if(transaction.trace.length)await resolve(transaction);update('Debug piece changed. Undo restores the previous state.');},
      settled:invalidate,
    },
    replay:{present:resolve,complete(){update();}},
    undo(){clear();update('Previous turn restored.');},
  };
}
