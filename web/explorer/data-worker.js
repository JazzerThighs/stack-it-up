import {loadPackingAsset} from './asset-loader.js';
import {PackingStore} from './data-store.js';
const base=new URL('./data/',import.meta.url);
let store;
const report = progress => self.postMessage({progress});
async function init() {
  const response=await fetch(new URL('manifest.json',base));if(!response.ok)throw Error('Local packing manifest unavailable; rebuild the app');
  const manifest=await response.json();
  report({phase:'manifest',total:manifest.count});
  const load=async name=>{
    const asset=manifest.assets[name];if(!asset)throw Error('Unknown dataset asset');
    const index=name==='index.bin.gz';
    return loadPackingAsset(new URL(name,base),asset,event=>report({
      ...event,asset:index?'index':'family',name,
      ...(index&&event.phase==='decode'?{packings:Math.floor(event.loaded/20),packingTotal:manifest.count}:{})
    }));
  };
  const index=await load('index.bin.gz');
  report({phase:'metadata',loaded:0,total:manifest.families.length});
  store=new PackingStore(manifest,index,load,report);
  report({phase:'metadata',loaded:manifest.families.length,total:manifest.families.length});
  return {dataset:manifest.dataset,version:manifest.version,count:manifest.count,families:manifest.families,bags:manifest.bags,officialFamily:store.officialFamily};
}
let chain=Promise.resolve();
self.onmessage=({data:{id,method,args=[]}})=>{
  // Serial requests keep shared query caches deterministic; all work is off the UI thread.
  chain=chain.then(async()=>{try {
    const value=method==='init'?await init():await store[method](...args);
    self.postMessage({id,value});
  }catch(e){self.postMessage({id,error:String(e.message||e)});}});
};
