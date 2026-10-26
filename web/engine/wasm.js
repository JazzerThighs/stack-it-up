import { S, SNAPSHOT_WORDS, EVENT_WORDS } from "./snapshot.js";
// ABI v4. Always copy buffers before another export can grow Wasm memory.
export async function createEngine() {
  const response = await fetch(new URL("../cube_stack.wasm", import.meta.url));
  if (!response.ok) throw Error("Unable to load game engine");
  const { instance } = await WebAssembly.instantiate(
    await response.arrayBuffer(),
  );
  return adaptEngine(instance.exports);
}
export function adaptEngine(w) {
  if (typeof w.game_lock_band !== "function" || typeof w.band_mesh_ptr !== "function")
    throw Error("Incompatible game engine: rebuild the complete app for early locking.");
  const words = (ptr, len) =>
    new Uint32Array(w.memory.buffer, ptr, len).slice();
  return {
    game_init: w.game_init,
    game_set_next: w.game_set_next,
    game_early_lock: w.game_early_lock,
    exportState() {
      const len = w.game_export();
      return Array.from(words(w.game_transfer_ptr(), len));
    },
    importState(data) {
      if (!Array.isArray(data) || data.length > 512 || !data.every(v => Number.isInteger(v) && v >= 0 && v <= 0xffffffff)) return false;
      new Uint32Array(w.memory.buffer, w.game_transfer_ptr(), data.length).set(data);
      return !!w.game_import(data.length);
    },
    game_turn: w.game_turn,
    game_choose: w.game_choose,
    game_undo: w.game_undo,
    game_hold: w.game_hold,
    game_set_gravity: w.game_set_gravity,
    game_set_gravity_rules: w.game_set_gravity_rules,
    game_gravity_rules: w.game_gravity_rules,
    game_set_slice_clears: w.game_set_slice_clears,
    game_slice_clear_mode: w.game_slice_clear_mode,
    game_set_modes: w.game_set_modes,
    game_set_early_lock: w.game_set_early_lock,
    game_lock_band: w.game_lock_band,
    bandMesh(mask) {
      const ptr = w.band_mesh_ptr(mask);
      return new Float32Array(w.memory.buffer, ptr, w.band_mesh_len()).slice();
    },
    game_set_fragments: w.game_set_fragments,
    snapshot() {
      const result = words(w.state_ptr(), w.state_len());
      if (result.length !== SNAPSHOT_WORDS || result[S.ABI_VERSION] !== 4)
        throw Error("Incompatible game engine: rebuild the complete app.");
      return result;
    },
    mesh() {
      const ptr = w.mesh_ptr();
      return new Float32Array(w.memory.buffer, ptr, w.mesh_len()).slice();
    },
    events() {
      const ptr = w.events_ptr(),
        v = words(ptr, w.events_len()),
        out = [];
      for (let i = 0; i < v.length; i += EVENT_WORDS)
        out.push({
          kind: v[i],
          mask: v[i + 1],
          face: v[i + 2],
          board: v.slice(i + 3, i + 30),
          ids: v.slice(i + 30, i + 57),
          origins: v.slice(i + 57, i + 84),
          floatMask: v[i + 84],
          fragmentTurns: v[i + 85],
        });
      return out;
    },
    placement_previews(moves) {
      const found = new Map();
      for (const move of moves) {
        const ptr = w.previews_ptr(move),
          v = words(ptr, w.previews_len());
        for (let i = 0; i < v.length; i += 3) {
          const old = found.get(v[i]);
          found.set(v[i], {
            mask: v[i],
            piece: v[i + 1],
            sourceMask: v[i + 2] | (old?.sourceMask || 0),
          });
        }
      }
      return [...found.values()];
    },
  };
}
