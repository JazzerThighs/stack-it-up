import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const suites=JSON.parse(readFileSync(new URL('./test-suites.json',import.meta.url),'utf8'));
const name=process.argv[2]||'all';
if(!Object.hasOwn(suites,name))throw Error(`Unknown suite ${name}. Choose: ${Object.keys(suites).join(', ')}`);
for(const command of suites[name]) {
  const [program,...args]=command.split(' ');
  console.log(`> ${command}`);
  const result=spawnSync(program==='node'?process.execPath:program,args,{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
