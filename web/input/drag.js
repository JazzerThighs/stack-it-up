import {pointerRay} from "../render/camera.js";
import { pickBand } from "./band-pick.js";
function stickerCenter(hit) {
  return hit.p.map((v, a) =>
    a === hit.axis
      ? Math.sign(v) * 1.5
      : Math.max(-1, Math.min(1, Math.round(v))),
  );
}
// The hover preview and drag picker share exactly the same slice candidates.
function sliceCandidates(r, hit, wide = false) {
  const result = [];
  for (let axis = 0; axis < 3; axis++) {
    if (axis === hit.axis) continue;
    const p = stickerCenter(hit),
      v = [0, 0, 0],
      a = (axis + 1) % 3,
      b = (axis + 2) % 3;
    v[a] = -p[b];
    v[b] = p[a];
    v[hit.axis] = 0;
    const magnitude = Math.hypot(...v);
    const tangent = v.map((n) => n / magnitude),
      q = r.project(p.map((v,i)=>v+tangent[i]*.01)).map((v,i)=>(v-r.project(p)[i])/.01),
      len = Math.hypot(q[0], q[1]);
    if (len < 1e-6) continue;
    const layer = Math.max(0, Math.min(2, Math.floor(p[axis] + 1.5))),
      face = [
        [4, 5],
        [1, 0],
        [2, 3],
      ][axis];
    let base = layer === 1 ? 6 + axis : face[layer === 2 ? 1 : 0];
    if (wide && base < 6) base += 9;
    result.push({
      axis,
      layer,
      wide: wide && layer !== 1,
      base,
      baseSign: layer === 2 ? -1 : 1,
      vx: q[0] / len,
      vy: -q[1] / len,
      projectedLength: len,
    });
  }
  return result;
}
// Projected drag selection: after 12px, choose the closest slice direction.
// A gesture starting on the cube never falls back to whole-cube rotation.
function installCubeDrag(r, onOrbit, context) {
  const canvas = r.canvas;
  let drag = null;
  let lastHover = null;
  const hover = (e) => {
    lastHover = e;
    if (context.lockMode) { r.hover = null; canvas.style.cursor = pickBand(r,e,context.state)>=0 ? "pointer" : "default"; context.invalidate(); return; }
    const hit = hitAt(e),
      rect = canvas.getBoundingClientRect();
    r.hover =
      hit && !r.isStack
        ? {
            hit,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            wide: !!(r.wideTurns || e.shiftKey || e.altKey),
          }
        : null;
    context.invalidate();
  };
  canvas.addEventListener("pointerleave", () => {
    r.hover = null;
    lastHover = null;
    context.invalidate();
  });
  r.refreshTurnHover = () => { if (!drag && lastHover) hover(lastHover); };
  for (const type of ["keydown", "keyup"]) document.addEventListener(type, (e) => {
    if ((e.key === "Shift" || e.key === "Alt") && lastHover && !drag) {
      hover({clientX: lastHover.clientX, clientY: lastHover.clientY, shiftKey: e.shiftKey, altKey: e.altKey});
    }
  });
  const hitAt = (e) => {
    if (r.pickHit) return r.pickHit(e);
    const {origin,dir}=pointerRay(r,e);
    let best = null,
      near = Infinity;
    for (let axis = 0; axis < 3; axis++)
      for (const side of [-1, 1]) {
        if (Math.abs(dir[axis]) < 1e-8) continue;
        const t = (side * 1.5 - origin[axis]) / dir[axis],
          p = origin.map((v, i) => v + t * dir[i]);
        if (t >= 0 && t < near && p.every((v) => Math.abs(v) <= 1.50001)) {
          near = t;
          best = { p, axis };
        }
      }
    return best;
  };
  const finish = async (cancel) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    r.orbitDragging = false;
    if (d.lockClick) {
      if (!cancel && !d.moved && d.lockCell >= 0) await context.lockBand(d.lockCell);
      return;
    }
    if (!d.turn) return;
    const t = d.t || 0;
    if (!cancel && t >= 0.28) {
      context.setBusy(false);
      await context.play(d.move, t);
    } else {
      try {
        await context.animate(140, (u) =>
          r.setState(context.state, {
            kind: "turn",
            move: d.move,
            t: t * (1 - u),
          }),
        );
        r.setState(context.state);
      } finally {
        context.setBusy(false);
        context.invalidate();
      }
    }
  };
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    if (drag) return;
    r.hover = null;
    context.invalidate();
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      hit: e.button !== 2 && !r.orbitOnly ? hitAt(e) : null,
      wide: !!(r.wideTurns || e.shiftKey || e.altKey),
    };
    if (e.button !== 2 && !r.isStack && context.lockMode && drag.hit) {
      drag.lockClick = true;
      drag.lockCell = pickBand(r, e, context.state);
    }
    r.orbitDragging = !drag.hit;
    r.arrowHover = null;
  });
  canvas.addEventListener("pointermove", (e) => {
    const d = drag;
    if (!d) {
      if (e.pointerType !== "touch") hover(e);
      return;
    }
    if (d.id !== e.pointerId) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (d.lockClick) { d.moved ||= Math.hypot(dx, dy) > 8; return; }
    if (d.hit && !d.turn) {
      if (
        r.isStack ||
        context.busy ||
        (!r.skipGameLocks && (context.state?.[66] || context.state?.[78]))
      )
        return;
      if (Math.hypot(dx, dy) < 12) return;
      let best = null;
      d.wide = !!(r.wideTurns || e.shiftKey || e.altKey);
      for (const c of (r.sliceCandidates ? r.sliceCandidates(d.hit, d.wide) : sliceCandidates(r, d.hit, d.wide))) {
        const dot = dx * c.vx + dy * c.vy,
          alignment = Math.abs(dot) / Math.hypot(dx, dy);
        if (!best || alignment > best.alignment)
          best = { ...c, dot, alignment };
      }
      if (!best) return;
      else {
        const { base, baseSign } = best;
        d.move = r.moveForCandidate ? r.moveForCandidate(best) : base + (Math.sign(best.dot) === baseSign ? 0 : 15);
        if (
          context.state?.[171] !== undefined &&
          !(context.state[171] & (1 << d.move))
        ) {
          r.setState(context.state);
          context.invalidate();
          return;
        }
        d.vx = best.vx * Math.sign(best.dot);
        d.vy = best.vy * Math.sign(best.dot);
        d.turn = true;
        context.setBusy(true);
      }
    }
    if (d.turn) {
      d.t = Math.max(0, Math.min(1, (dx * d.vx + dy * d.vy) / (r.unit * 1.7)));
      r.setState(context.state, { kind: "turn", move: d.move, t: d.t });
      context.invalidate();
    } else {
      onOrbit((e.clientX - d.lastX) * 0.009, (e.clientY - d.lastY) * 0.009);
    }
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  });
  canvas.addEventListener("pointerup", (e) => {
    if (drag?.id === e.pointerId) finish(false);
  });
  for (const type of ["pointercancel", "lostpointercapture"])
    canvas.addEventListener(type, (e) => {
      if (drag?.id === e.pointerId) finish(true);
    });
}

export { stickerCenter, sliceCandidates, installCubeDrag };
