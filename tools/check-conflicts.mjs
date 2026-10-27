import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
let failed=false;
for(const file of files){
 const data=readFileSync(file);
 if(data.includes(0))continue;
 data.toString('utf8').split(/\r?\n/).forEach((line,i)=>{
  if(/^(<{7} |={7}$|>{7} )/.test(line)){
   console.error(`${file}:${i+1}: unresolved merge conflict`);failed=true;
  }
 });
}
if(failed)process.exit(1);
console.log('PASS: no unresolved merge conflict markers.');
