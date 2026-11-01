import {PackingStore} from './data-store.js';
const base=new URL('./data/',import.meta.url);
let store;
async function init() {
  const response=await fetch(new URL('manifest.json',base));if(!response.ok)throw Error('Local packing manifest unavailable; rebuild the app');
  const manifest=await response.json();
  const load=async name=>{
    const asset=manifest.assets[name];if(!asset)throw Error('Unknown dataset asset');
    const r=await fetch(new URL(name,base));if(!r.ok)throw Error(`Cannot load local packing asset ${name}`);
    const bytes=await r.arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    if(hash!==asset.sha256)throw Error('Packing asset checksum mismatch; reload the app');
    const decoded=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    if(decoded.byteLength!==asset.bytes)throw Error('Packing asset size mismatch');return decoded;
  };
  store=new PackingStore(manifest,await load('index.bin.gz'),load);
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
