import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';

// One immutable URL namespace for an entire release: lazy imports, styles,
// explorer HTML, data and Wasm all resolve beside the same versioned modules.
export async function versionBuild(output) {
  const files=[];
  async function walk(relative='') {
    for(const item of (await readdir(path.join(output,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      if(!relative && (item.name==='assets'||item.name==='build-info.json'))continue;
      const name=path.posix.join(relative,item.name);
      if(item.isDirectory())await walk(name);
      else if(item.isFile())files.push(name);
    }
  }
  await walk();
  const hash=createHash('sha256');
  for(const name of files)hash.update(name+'\0').update(await readFile(path.join(output,name))).update('\0');
  const version=hash.digest('hex').slice(0,16),prefix=`assets/${version}`;
  for(const name of files) {
    const target=path.join(output,prefix,name);
    await mkdir(path.dirname(target),{recursive:true});
    await copyFile(path.join(output,name),target);
  }
  for(const entry of ['index.html','explorer/index.html']) {
    const file=path.join(output,entry),base=path.posix.dirname(entry);
    let html=await readFile(file,'utf8');
    html=html.replace(/\b(src|href)="(\.\/[^"?#]+\.(?:js|css))"/g,(_,attribute,url)=>{
      const target=path.posix.join(prefix,base,url);
      const relative=path.posix.relative(base,target);
      return `${attribute}="${relative.startsWith('.')?'':'./'}${relative}"`;
    });
    html=html.replace('</head>',`<meta name="stack-it-up-build" content="${version}" />\n</head>`);
    await writeFile(file,html,'utf8');
  }
  await writeFile(path.join(output,'build-info.json'),JSON.stringify({version,assets:prefix})+'\n');
  return version;
}
