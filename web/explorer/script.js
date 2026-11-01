import {initializeSpatialExplorer} from './spatial-explorer.js';
export async function initializeExplorer(root=document, options={}) {
  try {return await initializeSpatialExplorer(root,options);}
  catch(e){root.getElementById('status').textContent=`Could not load local tetracube data: ${e.message}`;throw e;}
}
export const ready=document.getElementById('cubeLayout')
  ?initializeExplorer(document,{dataset:new URLSearchParams(globalThis.location?.search||'').get('packings')==='classic'?'classic':'spatial'})
  :null;
