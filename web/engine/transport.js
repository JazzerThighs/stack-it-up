import { S, E, E_LENGTH, ABI_VERSION, SNAPSHOT_WORDS, EVENT_WORDS } from "./snapshot.js";
// Pure Wasm transport. No render settings, visual history or browser storage.
// Copy every buffer before another export can grow Wasm memory.
export async function createTransport() {
  const response = await fetch(new URL('../cube_stack.wasm', import.meta.url));
  if (!response.ok) throw Error('Unable to load game engine');
  const {instance} = await WebAssembly.instantiate(await response.arrayBuffer());
  return adaptTransport(/** @type {import('./wasm-exports.js').WasmExports} */ (/** @type {unknown} */ (instance.exports)));
}
/** @param {import('./wasm-exports.js').WasmExports} w */
export function adaptTransport(w) {
  if (typeof w.game_set_piece_pool !== "function") throw Error("Incompatible engine: rebuild for spatial pieces.");
  if (typeof w.game_lock_band !== "function" || typeof w.band_mesh_ptr !== "function")
    throw Error("Incompatible game engine: rebuild the complete app for early locking.");
  /** @param {number} ptr @param {number} len */
  const words = (ptr, len) =>
    new Uint32Array(w.memory.buffer, ptr, len).slice();
  const api = {
    game_init: w.game_init,
    game_piece_pool: w.game_piece_pool,
    game_set_piece_pool: w.game_set_piece_pool,
    game_choice_mask: w.game_choice_mask,
    game_rules: () => w.game_rules() >>> 0,
    game_configure_rules: w.game_configure_rules,
    game_debug_piece: w.game_debug_piece,
    game_set_next: w.game_set_next,
    game_early_lock: w.game_early_lock,
    exportState() {
      const len = w.game_export();
      return Array.from(words(w.game_transfer_ptr(), len));
    },
    /** @param {unknown} data */
    importState(data) {
      if (!Array.isArray(data) || data.length > 512 || !data.every(v => Number.isInteger(v) && v >= 0 && v <= 0xffffffff)) return false;
      const ptr = w.game_transfer_ptr();
      new Uint32Array(w.memory.buffer, ptr, data.length).set(data);
      return !!w.game_import(data.length);
    },
    game_core_option:w.game_core_option,
    game_preview_core:/** @param {number} mask */ mask=>w.game_select_core(mask,0),
    game_place_core:/** @param {number} mask */ mask=>w.game_select_core(mask,1),
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
    /** @param {number} mask @param {boolean} cornerO @param {import('./types.js').MeshOptions} options */
    bandMesh(mask,cornerO=false,{bevel,opening,profile,elbows,scale=1}) {
      const ptr = w.band_mesh_sized_ptr(mask,Number(cornerO),bevel,opening,profile,elbows,scale);
      return new Float32Array(w.memory.buffer, ptr, w.band_mesh_len()).slice();
    },
    game_set_fragments: w.game_set_fragments,
    game_set_release_rules:w.game_set_release_rules,
    game_release_rules:w.game_release_rules,
    /** @returns {import('./types.js').EngineSnapshot} */
    snapshot() {
      const result = words(w.state_ptr(), w.state_len());
      if (result.length !== SNAPSHOT_WORDS || result[S.ABI_VERSION] !== ABI_VERSION)
        throw Error("Incompatible game engine: rebuild the complete app.");
      return Object.assign(result,{
        canUndo:!!w.game_can_undo(),
        groupRequirements:Uint32Array.from({length:27},(_,i)=>w.group_requirement_at(i)),
        gameplayRules:w.game_rules() >>> 0,
        rebuildIds:Uint32Array.from({length:27},(_,i)=>w.active_group_at?.(i)||w.rebuild_id_at?.(i)||0),
      });
    },
    mesh() {
      const ptr = w.mesh_ptr();
      return new Float32Array(w.memory.buffer, ptr, w.mesh_len()).slice();
    },
    /** @returns {import('./types.js').EngineEvent[]} */
    events() {
      const ptr = w.events_ptr(),
        v = words(ptr, w.events_len()),
        out = [];
      if (v.length % EVENT_WORDS) throw Error("Invalid engine event buffer length");
      for (let i = 0; i < v.length; i += EVENT_WORDS)
        out.push({
          kind: v[i + E.KIND],
          mask: v[i + E.MASK],
          face: v[i + E.FACE],
          board: v.slice(i + E.BOARD, i + E.BOARD + E_LENGTH.BOARD),
          ids: v.slice(i + E.IDS, i + E.IDS + E_LENGTH.IDS),
          origins: v.slice(i + E.ORIGINS, i + E.ORIGINS + E_LENGTH.ORIGINS),
          floatMask: v[i + E.FLOAT_MASK],
          fragmentTurns: v[i + E.FRAGMENT_TURNS],
        });
      return out;
    },
    /** @param {Iterable<number>} moves @returns {import('./types.js').PlacementPreview[]} */
    placement_previews(moves) {
      /** @type {Map<number, import('./types.js').PlacementPreview>} */
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
  return api;
}
