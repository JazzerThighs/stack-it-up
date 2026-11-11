import {createGameController} from '../../web/game/controller.js';
import type {ControllerOptions} from '../../web/game/controller-types.js';
declare const options:ControllerOptions;
const commands=createGameController(options);
const result:Promise<boolean>=commands.play(2);void result;
commands.lockBand(4,true);commands.replay({method:'game_turn',arg:2});
// @ts-expect-error move must be numeric
commands.play('U');
// @ts-expect-error replay is limited to supported commands
commands.replay({method:'game_init',arg:2});
// @ts-expect-error early lock flag must be boolean
commands.lockBand(4,'yes');
