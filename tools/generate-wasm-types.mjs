import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('src/abi.rs',root),'utf8');
const signatures=[...source.matchAll(/pub extern "C" fn (\w+)\(([^)]*)\)\s*(?:->\s*([^\{]+))?\s*\{/g)];
if(signatures.length!==[...source.matchAll(/pub extern "C" fn /g)].length)throw Error('Unrecognized Wasm signature; extend the binding generator.');
function type(value) {
  const t=value?.trim();
  if(!t)return 'void';
  if(['u32','f32'].includes(t)||/^\*(const|mut) (u32|f32)$/.test(t))return 'number';
  throw Error(`Unsupported Wasm type: ${t}`);
}
const members=signatures.filter(([,name])=>!name.startsWith('test_')).map(([,name,args,result])=>{
 const params=args.trim()?args.split(',').map(arg=>{const [name,t]=arg.split(':');return `${name.trim()}: ${type(t)}`;}).join(', '):'';
 return `  ${name}(${params}): ${type(result)};`;
});
const output='// Generated from src/abi.rs by tools/generate-wasm-types.mjs. Do not edit.\nexport interface WasmExports {\n  memory: WebAssembly.Memory;\n'+members.join('\n')+'\n}\n';
const file=new URL('web/engine/wasm-exports.d.ts',root);
if(process.argv.includes('--check')) {if(await readFile(file,'utf8')!==output)throw Error('Stale Wasm types. Run node tools/generate-wasm-types.mjs');}
else await writeFile(file,output);
console.log(`Verified ${members.length} Wasm export signatures`);
