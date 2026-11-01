import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
let failed=false;
for(const file of files){
 let data;
 try {data=readFileSync(file);}catch(error){if(error.code==='ENOENT')continue;throw error;}
 if(data.includes(0))continue;
 const lines=data.toString('utf8').split(/\r?\n/);
 lines.forEach((line,i)=>{
  if(/^(<{7} |={7}$|>{7} )/.test(line)){
   console.error(`${file}:${i+1}: unresolved merge conflict`);failed=true;
  }
 });
}
if(failed)process.exit(1);
console.log('PASS: no unresolved merge conflict markers.');
