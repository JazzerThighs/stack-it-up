import {startupDefaults} from './startup-defaults.js';
// Browser-independent preferences. Storage is optional; callers inject it in tests.
export function createSettingsStore(schema,storage){
 const domain={'stack-it-up.visual':'appearance','stack-it-up.display':'display','stack-it-up.controls':'controls','stack-it-up.settling-orbit':'orbit'}[schema.storageKey];
 const specs=schema.fields,values=Object.fromEntries(Object.entries(specs).map(([id,s])=>[id,s.value])),listeners=new Set();
 let writable=true;
 const valid=(id,value)=>{
  const s=Object.hasOwn(specs,id)?specs[id]:null;if(!s)return null;
  if(s.valueAliases&&Object.hasOwn(s.valueAliases,value))value=s.valueAliases[value];
  if(typeof s.value==='boolean')return typeof value==='boolean'?value:null;
  if(s.options)return s.options.includes(value)?value:null;
  if(s.color)return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:null;
  if(typeof value!=='number'||!Number.isFinite(value))return null;
  if(s.rangePolicy==='reject'&&(value<s.min||value>s.max))return null;
  const clamped=Math.max(s.min,Math.min(s.max,value));
  if(s.quantize===false)return clamped;
  return Math.max(s.min,Math.min(s.max,Number((s.min+Math.round((clamped-s.min)/s.step)*s.step).toFixed(4))));
 };
 const defaults={...values};
 for(const [id,value] of Object.entries(startupDefaults[domain]||{})){if(!Object.hasOwn(specs,id))continue;const normalized=valid(id,value);if(normalized===null)throw Error(`Invalid startup default: ${domain}.${id}`);defaults[id]=values[id]=normalized;}
 try{
  const saved=JSON.parse(storage?.getItem(schema.storageKey)||'null');
  // Unversioned objects are the existing format. Unknown envelopes stay intact.
  const object=saved&&typeof saved==='object'&&!Array.isArray(saved);
  const envelope=object&&Object.hasOwn(saved,'version');
  const legacy=object&&!envelope;
  writable=!envelope||saved.version===schema.version;
  const source=legacy?{...saved}:saved?.version===schema.version?saved.values:null;
  if(legacy)for(const alias of schema.legacyAliases||[]){
   if(Object.hasOwn(source,alias.from)&&(!alias.truthySource||source[alias.from])&&(source[alias.to]===undefined||(alias.replaceFalsy&&!source[alias.to])||(Object.hasOwn(alias,'replaceDefault')&&source[alias.to]===alias.replaceDefault)))source[alias.to]=source[alias.from];
  }
  for(const id of Object.keys(specs)){const v=valid(id,source?.[id]);if(v!==null)values[id]=v;}
 }catch{}
 const publish=key=>{
  if(writable)try{storage?.setItem(schema.storageKey,JSON.stringify({version:schema.version,values}));}catch{}
  for(const fn of listeners)fn(key);
 };
 const set=(id,value)=>{const v=valid(id,value);if(v===null)return false;values[id]=v;publish(id);return true;};
 const patch=changes=>{const entries=Object.entries(changes).map(([id,v])=>[id,valid(id,v)]);if(entries.some(([,v])=>v===null))return false;for(const [id,v]of entries)values[id]=v;publish();return true;};
 const reset=(prefix='')=>{for(const [id,s]of Object.entries(specs))if(id.startsWith(prefix))values[id]=defaults[id];publish();};
 return {values,set,patch,reset,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
}
export function matchesSettingCondition(condition,read){
 if(condition.any)return condition.any.some(c=>matchesSettingCondition(c,read));
 if(condition.all)return condition.all.every(c=>matchesSettingCondition(c,read));
 const element=read(condition.id);
 return condition.values?condition.values.includes(element?.value):element?.checked===condition.checked;
}
