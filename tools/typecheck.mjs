import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const compiler=fileURLToPath(new URL('../node_modules/typescript/bin/tsc',import.meta.url));
if(!existsSync(compiler))throw Error('TypeScript is not installed. Run npm ci in the project folder.');
for(const args of [['tools/generate-wasm-types.mjs','--check'],[compiler,'--project','tsconfig.engine.json']]) {
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
console.log('PASS: strict transport, presentation and controller boundaries plus compile-time misuse checks.');
