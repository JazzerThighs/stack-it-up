/** Catalog records and bounded session caches. No views, geometry or DOM state. */
export function createFamilySession({lookup,constructPath,filters=()=>undefined,lookupLimit=256,pathLimit=32,recentLimit=50}) {
  const ledger=new Map(),recent=[],lookups=new Map(),paths=new Map();
  function remember(records) {
    let added=false;
    for(const record of records) {
      const key=`${record.dataset}:${record.lineNumber}`;
      if(ledger.has(key))continue;
      ledger.set(key,record);recent.push(record);
      if(recent.length>recentLimit)recent.shift();
      added=true;
    }
    return added;
  }
  function find(family,masks) {
    const key=JSON.stringify([family,masks.slice().sort((a,b)=>a-b),filters()]);
    if(lookups.has(key))return lookups.get(key);
    const promise=lookup(family,masks).catch(error=>{
      // An evicted request may fail after a replacement for the same key starts.
      if(lookups.get(key)===promise)lookups.delete(key);
      throw error;
    });
    lookups.set(key,promise);
    if(lookups.size>lookupLimit)lookups.delete(lookups.keys().next().value);
    return promise;
  }
  async function path(source,target) {
    const key=JSON.stringify([source,target]);
    if(paths.has(key))return paths.get(key);
    const moves=await constructPath(source,target);
    paths.set(key,moves);
    if(paths.size>pathLimit)paths.delete(paths.keys().next().value);
    return moves;
  }
  return {remember,lookup:find,path,
    get ledger(){return {count:ledger.size,recent:recent.slice()};},
  };
}
