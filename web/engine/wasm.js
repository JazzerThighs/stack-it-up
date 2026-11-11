import {adaptTransport,createTransport} from './transport.js';
import {trackPresentation} from './presentation.js';
import {visualSettings} from '../render/visual-settings.js';

// Compatibility facade for browser callers. Search workers use transport directly.
function present(transport,options) {
  const api=trackPresentation(transport,options);
  api.bandMesh=(mask,cornerO=false)=>transport.bandMesh(mask,cornerO,{
    bevel:visualSettings.jellyBevel/100,
    opening:visualSettings.jellyOpening/100,
    profile:visualSettings.jellyProfile,
    elbows:visualSettings.jellyElbows/100,
    scale:visualSettings.cubieScale/100,
  });
  return api;
}
export async function createEngine(options) {
  return present(await createTransport(),options);
}
export function adaptEngine(exports,options) {
  return present(adaptTransport(exports),options);
}
