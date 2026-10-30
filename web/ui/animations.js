import {CubeStack} from "../engine/coordinates.js";
import { S } from "../engine/snapshot.js";
const $ = (id) => document.getElementById(id);
const names = ["", "O", "T", "L", "J", "S", "Z"];
const copyState=s=>{const copy=s.slice();if(s.rebuildIds)copy.rebuildIds=s.rebuildIds.slice();return copy;};
// Carry the visible active cells to the end of the player's completed turn.
export function landedState(before, move) {
  const state=copyState(before);
  if (move == null) return state;
  const [,axis,layer,side]=CubeStack.moves[move%15], sign=(move>=15)===(side===0) ? -1 : 1;
  state[S.ACTIVE]=0; state[S.FLOATING]=0;
  state.rebuildIds?.fill(0);
  state.fill(0,S.REBUILD_COLORS,S.REBUILD_COLORS+27);
  state.fill(0,S.BAND_IDS,S.BAND_IDS+27);
  for (let i=0;i<27;i++) {
    const p=CubeStack.xyz(i), a=(axis+1)%3,b=(axis+2)%3;
    if (layer==='wide' ? p[axis]!==2-side : p[axis]===layer) {
      const x=p[a]-1,y=p[b]-1; p[a]=1-sign*y;p[b]=1+sign*x;
    }
    const j=p[0]*9+p[1]*3+p[2];
    for (const field of [S.ACTIVE,S.FLOATING]) if (before[field] & (1<<i)) state[field]|=1<<j;
    if(state.rebuildIds)state.rebuildIds[j]=before.rebuildIds[i];
    state[S.REBUILD_COLORS+j]=before[S.REBUILD_COLORS+i];
    state[S.BAND_IDS+j]=before[S.BAND_IDS+i];
  }
  return state;
}
export function createAnimations(context) {
  let ghostTimer;
  function animate(ms, frame) {
    if (!context.animations.checked) {
      frame(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let start;
      const tick = (now) => {
        start ??= now;
        const t = Math.min(1, (now - start) / ms),
          ease = t * t * (3 - 2 * t);
        frame(ease);
        context.renderers.forEach((r) => r.draw());
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }
  function ghost(mask, piece) {
    clearTimeout(ghostTimer);
    context.renderers[0].ghost = { mask, piece };
    ghostTimer = setTimeout(() => {
      context.renderers[0].ghost = null;
      if (!context.busy) {
        context.renderers[0].setState(context.state);
        context.invalidate();
      }
    }, 2200);
  }
  async function resolveAnimations(before, after, trace, move = null) {
    let display = landedState(before, move);
    for (const e of trace) {
      const next = copyState(display);
      next.set(e.board, 0);
      next.set(e.ids, 27);

      if (e.kind === 5) {
        next.set(after.slice(S.BANDAGED), S.BANDAGED);
        next.rebuildIds=after.rebuildIds?.slice();
      }
      next[S.FLOATING] = e.floatMask || 0;
      next[S.FRAGMENT_TURNS] = e.fragmentTurns || 0;
      if (e.face) next[S.GRAVITY] = e.face;
      if (e.kind === 1) {
        const i = 31 - Math.clz32(e.mask),
          piece = e.board[i];

        $("message").textContent = `${names[piece]} placed. 🎈`;
      } else if (e.kind === 4)
        $("message").textContent = "Freed pieces lock into the stack.";
      else if (e.kind === 5)
        $("message").textContent =
          "Cleared-face perks: freed cubies are yours to move.";
      else
        $("message").textContent =
          e.kind === 2 ? "Face clear — making room." : "Pieces falling…";
      const placing = e.kind === 1 || e.kind === 4;
      const during = copyState(next);
      if (placing) {
        during[S.ACTIVE]=display[S.ACTIVE];
        during[S.FLOATING]=display[S.FLOATING];
        // A new stack occupying these cells is intentional, not an overlap.
        for (let i=0;i<27;i++) if (e.mask & (1<<i)) during[i]=display[i];
      } else {
        during[S.ACTIVE]=0;
      }
      context.renderers.forEach((r) => {
        r.prepareStackEvent?.(display,next,e);
        r.setState(during);
      });
      await animate(e.kind === 3 ? 180 : e.kind === 2 ? 400 : 320, (t) =>
        context.renderers.forEach((r) => r.stackFrame(display, next, e, t)),
      );
      // Only remove the source cubies after the seamless solid reaches full size.
      if (e.kind === 1) { next[S.ACTIVE]=0; ghost(e.mask, e.board[31-Math.clz32(e.mask)]); }
      context.renderers.forEach((r) => r.setState(next));
      if (e.kind !== 3) await animate(120, () => {});
      display = next;
    }
    context.invalidateMesh();
    context.update(
      after[S.OVER]
        ? undefined
        : trace.length
          ? `Placed${after[S.AUTO_PLACEMENTS] ? ` · ${after[S.AUTO_PLACEMENTS]} automatic gap fill${after[S.AUTO_PLACEMENTS] === 1 ? "" : "s"}` : ""}${after[S.CLEARS] > before[S.CLEARS] ? ` · ${after[S.CLEARS] - before[S.CLEARS]} planes cleared` : ""}.`
          : undefined,
    );
    if (trace.some(e => e.kind === 1)) {
      await animate(240, (t) =>
        context.renderers.forEach((r) =>
          r.setState(after, { kind: "spawn", t }),
        ),
      );
      context.renderers.forEach((r) => r.setState(after));
    }
  }
  return {
    animate,
    resolveAnimations,
    clearGhost() {
      clearTimeout(ghostTimer);
    },
  };
}
