import {arrangePrintLayout} from './print-layout.js';
import {visualSettings} from '../render/visual-settings.js';
import {PALETTE} from './model.js';

// glTF 2.0 uses metres and linear vertex colors. Renderer colors are sRGB.
const linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
export function encodeModelGLB(parts,{sizeMm=60,layout='assembled',gapMm=5,...metadata}={}) {
  if(!Number.isFinite(sizeMm)||sizeMm<=0||sizeMm>10000)throw Error('Cube size must be greater than 0 and at most 10000 mm.');
  if(!['assembled','print'].includes(layout))throw Error('Unknown export layout.');
  if(layout==='print')parts=arrangePrintLayout(parts,{sizeMm,gapMm});
  const doc={asset:{version:'2.0',generator:'Stack It Up'},scene:0,scenes:[{name:layout==='print'?'Pieces on floor':'Family explorer cube',nodes:[]}],nodes:[],meshes:[],
    materials:[{name:'Piece colors',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.8}}],
    accessors:[],bufferViews:[],buffers:[{byteLength:0}],extras:{...metadata,layout,...(layout==='print'?{pieceSpacingMm:gapMm,floorAxis:'Y'}:{}),nominalCubeSizeMm:sizeMm,units:'metres'}};
  const chunks=[],groups=new Map();let byteLength=0;
  for(const part of parts){
    const mesh=part.data;if(!mesh?.length)continue;
    if(mesh.length%27)throw Error('Model geometry contains an incomplete triangle.');
    const count=mesh.length/9,bytes=new Uint8Array(mesh.byteLength),view=new DataView(bytes.buffer),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<mesh.length;i+=9){
      for(let a=0;a<9;a++)if(!Number.isFinite(mesh[i+a]))throw Error('Model geometry contains non-finite values.');
      const length=Math.hypot(mesh[i+3],mesh[i+4],mesh[i+5]);if(!length)throw Error('Model geometry contains a zero normal.');
      for(let a=0;a<3;a++){
        const v=mesh[i+a]*sizeMm/3000;min[a]=Math.min(min[a],Math.fround(v));max[a]=Math.max(max[a],Math.fround(v));
        view.setFloat32((i+a)*4,v,true);view.setFloat32((i+a+3)*4,mesh[i+a+3]/length,true);
        view.setFloat32((i+a+6)*4,linear(Math.max(0,Math.min(1,mesh[i+a+6]))),true);
      }
    }
    const bufferView=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:bytes.length,byteStride:36,target:34962});chunks.push(bytes);byteLength+=bytes.length;
    const attributes={};for(const [i,name] of ['POSITION','NORMAL','COLOR_0'].entries()){
      attributes[name]=doc.accessors.length;doc.accessors.push({bufferView,byteOffset:i*12,componentType:5126,count,type:'VEC3',...(i===0?{min,max}:{})});
    }
    const key=part.piece>=0?'Piece '+(part.piece+1):'Extra cell '+part.cells[0];
    if(!groups.has(key)){
      const meshIndex=doc.meshes.length,nodeIndex=doc.nodes.length;doc.meshes.push({name:key,primitives:[]});
      doc.nodes.push({name:key,mesh:meshIndex,extras:{pieceId:part.piece,cells:[]}});doc.scenes[0].nodes.push(nodeIndex);groups.set(key,nodeIndex);
    }
    const node=doc.nodes[groups.get(key)];node.extras.cells.push(...part.cells);doc.meshes[node.mesh].primitives.push({attributes,material:0,mode:4});
  }
  if(!chunks.length)throw Error('The current cube has no geometry to export.');
  doc.buffers[0].byteLength=byteLength;
  const json=new TextEncoder().encode(JSON.stringify(doc)),jsonSize=(json.length+3)&~3,total=12+8+jsonSize+8+byteLength;
  const output=new Uint8Array(total),header=new DataView(output.buffer);
  header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,total,true);
  header.setUint32(12,jsonSize,true);header.setUint32(16,0x4e4f534a,true);output.fill(32,20,20+jsonSize);output.set(json,20);
  const bin=20+jsonSize;header.setUint32(bin,byteLength,true);header.setUint32(bin+4,0x004e4942,true);
  let offset=bin+8;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}return output;
}
const pack=cells=>cells.map(c=>c?{...c,assemblyOrigin:c.assemblyOrigin,solidRotation:c.solidRotation}:c);
export async function captureFamilyModel(view,options={}) {
  if(!view||view.busy||view.currentAnimation)throw Error('Finish the current turn or playback before exporting.');
  const generation=view.generation;
  if(view.geometry&&!await view.geometry.ready())throw Error('Retry graphics before exporting.');
  if(view.busy||view.currentAnimation||view.destroyed||view.generation!==generation)throw Error('The cube is changing. Try exporting again when it settles.');
  const cells=view.cells,key=view.geometry?.base.key,revision=view.geometry?.revision;
  const request=structuredClone({...view.geometry?.base,key:key||'export',cells:pack(cells),initial:pack(view.initial),
    shape:view.modelShape,assembly:view.assembly,settings:{...visualSettings},palette:{...PALETTE},solids:view.explorationSolids,
    gray:view.explorationGray,fixedColors:view.fixedPieceColors,individual:view.individualPieces,filters:view.detectionFilters||{},exportModel:true});
  const result=view.geometry?await view.geometry.client.request(request):
    (await import('../workers/geometry-preparation.js')).createGeometryPreparation(view.meshGenerator)(request);
  if(!result||view.destroyed||view.busy||view.currentAnimation||view.cells!==cells||view.generation!==generation||view.geometry&&(view.geometry.base.key!==key||view.geometry.revision!==revision))throw Error('The cube changed during export. Please try again.');
  return encodeModelGLB(result.exportParts,{...options,shape:request.shape,assembly:request.assembly,cells:request.cells,appearance:request.settings});
}
export function downloadModel(bytes,filename){
  const url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'})),link=document.createElement('a');
  link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
