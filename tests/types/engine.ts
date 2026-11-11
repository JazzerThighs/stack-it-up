import type {EngineTransport, EngineSnapshot, EngineEvent} from '../../web/engine/types.js';
import type {WasmExports} from '../../web/engine/wasm-exports.js';
import {adaptTransport} from '../../web/engine/transport.js';
declare const wasm: WasmExports;
const engine: EngineTransport=adaptTransport(wasm);
engine.game_init(1);
engine.game_turn(0);
engine.game_set_piece_pool(511,1);
engine.game_set_modes(1,0,2);
const snapshot: EngineSnapshot=engine.snapshot();
const event: EngineEvent | undefined=engine.events()[0];
const canUndo: boolean=snapshot.canUndo;
engine.bandMesh(15,false,{bevel:.15,opening:.24,profile:2,elbows:1});
engine.placement_previews([0,15]);
engine.importState('malformed input is accepted for runtime validation');
// These must remain errors: a broad any/interface regression fails this file.
// @ts-expect-error command arguments are numeric
engine.game_turn('U');
// @ts-expect-error required modes cannot be omitted
engine.game_set_modes(1);
// @ts-expect-error redeal is required by the native signature
engine.game_set_piece_pool(511);
// @ts-expect-error pure transport requires explicit geometry options
engine.bandMesh(15,false);
// @ts-expect-error mesh profile is required
engine.bandMesh(15,false,{bevel:.15,opening:.24,elbows:1});
// @ts-expect-error snapshots carry booleans, not integer flags here
const flag: number=snapshot.canUndo;
// @ts-expect-error preview moves must be numeric
engine.placement_previews(['U']);
// @ts-expect-error presentation metadata is not owned by transport
snapshot.solidRotations;
