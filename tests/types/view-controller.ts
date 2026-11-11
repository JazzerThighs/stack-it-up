import {createViewController} from '../../web/explorer/view-controller.js';
const controller=createViewController({cancelPractice(){},leaveFamily(){},show(mode){const valid: 'catalog'|'family'|'practice'=mode;void valid;},enterFamily:async()=>{},enterPractice(){},refresh(){}});
const result:Promise<boolean>=controller.select('family');void result;
// @ts-expect-error unsupported mode
controller.select('unknown');
// @ts-expect-error lifecycle effects are required
createViewController({show(){}});
