import {readdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const ignored=new Set(['.git','target','dist','node_modules','.packing-cache']);
let failed=false;
function scan(directory) {
  for(const entry of readdirSync(directory,{withFileTypes:true})) {
    if(ignored.has(entry.name)||entry.isSymbolicLink())continue;
    const file=path.join(directory,entry.name);
    if(entry.isDirectory()){scan(file);continue;}
    if(!entry.isFile())continue;
    const data=readFileSync(file);
    if(data.includes(0))continue;
    data.toString('utf8').split(/\r?\n/).forEach((line,i)=>{
      if(/^(<{7} |={7}$|>{7} )/.test(line)){
        console.error(`${path.relative(root,file)}:${i+1}: unresolved merge conflict`);failed=true;
      }
    });
  }
}
scan(root);
if(failed)process.exit(1);
console.log('PASS: no unresolved merge conflict markers (Git not required).');
