import {trackPresentation} from '../../web/engine/presentation.js';
import type {EngineTransport} from '../../web/engine/types.js';
declare const transport:EngineTransport;
const engine=trackPresentation(transport);
const rotations:number[][]|undefined=engine.snapshot().solidRotations;
void rotations;engine.game_turn(2);
// @ts-expect-error decorators must preserve command types
engine.game_turn('U');
// @ts-expect-error the transport does not own presentation rotations
transport.snapshot().solidRotations;
