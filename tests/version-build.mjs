import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {versionBuild} from '../tools/version-build.mjs';
const temp=await mkdtemp(path.join(os.tmpdir(),'stack-build-test-'));
try {
  const versions=[];
  for(let attempt=0;attempt<4;attempt++) {
    const root=path.join(temp,String(attempt));await mkdir(path.join(root,'explorer','data'),{recursive:true});
    const files={
      'index.html':'<head><link href="./style.css" /></head><script type="module" src="./app.js"></script><a href="#game">Game</a>',
      'app.js':'import("./explorer/script.js");',
      'style.css':'body{color:white}',
      'explorer/index.html':'<head><link href="../style.css" /><link href="./style.css" /></head><script type="module" src="./script.js"></script>',
      'explorer/script.js':`export const revision=${attempt>=2?2:1};`,
      'explorer/style.css':'canvas{width:100%}',
      'cube_stack.wasm':'wasm fixture',
      'explorer/data/index.bin.gz':attempt===3?'changed dataset':'dataset fixture',
    };
    for(const [name,data] of Object.entries(files))await writeFile(path.join(root,name),data);
    const version=await versionBuild(root);versions.push(version);
    await assert.rejects(readFile(path.join(root,'explorer/data/index.bin.gz')),{code:'ENOENT'});
    for(const [name,data] of Object.entries(files))assert.equal(await readFile(path.join(root,'assets',version,name),'utf8'),data);
    for(const entry of ['index.html','explorer/index.html']) {
      const html=await readFile(path.join(root,entry),'utf8');
      assert(html.includes(`content="${version}"`));
      // Resolve just as a browser hosted under GitHub Pages' /stack-it-up/ does.
      for(const [,url] of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
        const resolved=new URL(url,`https://example.test/stack-it-up/${entry}`);
        assert(resolved.pathname.startsWith(`/stack-it-up/assets/${version}/`));
        await readFile(path.join(root,resolved.pathname.replace('/stack-it-up/','')));
      }
    }
    const appURL=new URL(`https://example.test/stack-it-up/assets/${version}/app.js`);
    const explorerURL=new URL('./explorer/script.js',appURL);
    assert.equal(new URL('../cube_stack.wasm',explorerURL).pathname,`/stack-it-up/assets/${version}/cube_stack.wasm`);
  }
  assert.equal(versions[0],versions[1],'identical releases have stable URLs');
  assert.notEqual(versions[1],versions[2],'a nested module update changes all release URLs');
  assert.notEqual(versions[2],versions[3],'a dataset-only update changes release URLs');
} finally {await rm(temp,{recursive:true,force:true});}
const output=new URL('../dist/',import.meta.url);
const info=JSON.parse(await readFile(new URL('build-info.json',output),'utf8'));
for(const entry of ['index.html','explorer/index.html']) {
  const html=await readFile(new URL(entry,output),'utf8');
  for(const [,url] of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
    assert(url.includes(info.version),`${entry}: unversioned entry asset ${url}`);
    await readFile(new URL(url,new URL(entry,output)));
  }
}
for(const name of ['explorer/family-controller.js','explorer/family-colors.js','explorer/workspace.css','explorer/index.html','render/identity-solids.js','cube_stack.wasm']) {
  assert.deepEqual(await readFile(new URL(`${info.assets}/${name}`,output)),await readFile(name.endsWith('.html') ? new URL(`../web/${name}`,import.meta.url) : new URL(name,output)));
}
console.log('PASS: versioned releases keep HTML, lazy modules, CSS and Wasm together under GitHub Pages subpaths.');

// Both collection views ship only the new indexed database.
const releaseInfo=JSON.parse(await readFile(new URL('../dist/build-info.json',import.meta.url),'utf8'));
for(const prefix of ['',releaseInfo.assets+'/'])for(const name of ['packings_with_metadata.txt','refined_families.txt','packing-families.js','official-colors.js']) {
  await assert.rejects(readFile(new URL('../dist/'+prefix+'explorer/'+name,import.meta.url)),{code:'ENOENT'});
}
console.log('PASS: obsolete classic packing assets are absent from the published build.');

const manifestPath=new URL(`${info.assets}/explorer/data/manifest.json`,output);
const packingManifest=JSON.parse(await readFile(manifestPath,'utf8'));
await assert.rejects(readFile(new URL('explorer/data/manifest.json',output)),{code:'ENOENT'});
for(const name of Object.keys(packingManifest.assets)) {
  await assert.rejects(readFile(new URL('explorer/data/'+name,output)),{code:'ENOENT'});
}
const workerURL=new URL(`https://example.test/stack-it-up/${info.assets}/explorer/data-worker.js`);
assert.equal(new URL('./data/manifest.json',workerURL).pathname,`/stack-it-up/${info.assets}/explorer/data/manifest.json`);
console.log('PASS: dataset shipped once, with relative worker paths under GitHub Pages.');
