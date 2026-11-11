import {createTransport} from '../engine/transport.js';
import {createGeometryPreparation,packGeometry} from './geometry-preparation.js';
let preparation;
async function getPreparation(){
  if(!preparation){
    const engine=await createTransport();
    preparation=createGeometryPreparation((mask,corner)=>engine.bandMesh(mask,corner,settings));
  }
  return preparation;
}
let settings,chain=Promise.resolve();
self.onmessage=({data:{id,method,args}})=>{
  chain=chain.then(async()=>{
    try{
      if(method!=='prepare')throw Error('Unknown geometry request');
      const request=args[0],s=request.settings;
      const prepare=await getPreparation();
      settings={bevel:s.jellyBevel/100,opening:s.jellyOpening/100,profile:s.jellyProfile,elbows:s.jellyElbows/100,scale:s.cubieScale/100};
      const {value,transfer}=packGeometry(prepare(request));
      self.postMessage({id,value},transfer);
    }catch(error){self.postMessage({id,error:String(error.message||error)});}
  });
};
