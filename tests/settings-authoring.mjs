import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,readFile,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url));
const fixture=await mkdtemp(path.join(tmpdir(),'stack-settings-'));
const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
try{
 const files=['data/appearance-settings.json','data/display-settings.json','data/controls-settings.json','data/orbit-settings.json','web/index.html','web/explorer/index.html','web/style.css','web/explorer/workspace.css','web/ui/game-settings.css','web/ui/explorer-settings.css','web/ui/visual-controls.js','web/ui/style-tuning.js','web/ui/settings-store.js','web/ui/startup-defaults.js','web/render/visual-settings.js'];
 for(const file of files){await mkdir(path.dirname(path.join(fixture,file)),{recursive:true});await copyFile(path.join(project,file),path.join(fixture,file));}
 await writeFile(path.join(fixture,'package.json'),'{"type":"module"}');
 const run=(...args)=>spawnSync(process.execPath,[path.join(project,'tools/generate-settings.mjs'),'--root',fixture,...args],{encoding:'utf8'});
 const schema=JSON.parse(await readFile(path.join(fixture,'data/appearance-settings.json'),'utf8'));
 // This is the sole authoring change. No HTML, binder, store or renderer edit.
 schema.fields.fixtureGain={value:.5,min:0,max:1,step:.1,label:'Fixture gain',help:'A schema-only setting.',commit:'input',group:'dither',wrapper:'fixtureGainOptions'};
 schema.availability.fixtureGainOptions={id:'pieceAppearance',values:['dither']};
 await writeFile(path.join(fixture,'data/appearance-settings.json'),JSON.stringify(schema));
 assert.notEqual(run('--check').status,0,'Stale outputs must fail');
 const generated=run();assert.equal(generated.status,0,generated.stderr);assert.equal(run('--check').status,0);
 for(const file of ['web/index.html','web/explorer/index.html']){
  const html=await readFile(path.join(fixture,file),'utf8');
  assert.equal([...html.matchAll(/id="fixtureGain"/g)].length,1);
  assert(html.includes('for="fixtureGain"'));assert(html.includes('aria-describedby="fixtureGainHelp"'));
 }
 const html=await readFile(path.join(fixture,'web/index.html'),'utf8');
 const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,{value:'',checked:false,hidden:false,events:{},addEventListener(type,fn){this.events[type]=fn;}}]));
 const root={getElementById:id=>nodes.get(id)||null},el=id=>root.getElementById(id);
 const saved=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)}});
 const {initializeVisualControls}=await import(pathToFileURL(path.join(fixture,'web/ui/visual-controls.js')));
 const visualURL=pathToFileURL(path.join(fixture,'web/render/visual-settings.js'));
 const {visualSettings}=await import(visualURL);
 el('pieceAppearance').value='ascii';el('modelShape').value='jelly';
 const stop=initializeVisualControls(root,()=>{});assert(el('fixtureGainOptions').hidden);
 el('pieceAppearance').value='dither';el('pieceAppearance').events.change();assert(!el('fixtureGainOptions').hidden);
 assert.equal(visualSettings.fixtureGain,.5);el('fixtureGain').value='.84';el('fixtureGain').events.input();assert.equal(visualSettings.fixtureGain,.8);
 assert.equal(JSON.parse(saved.get(schema.storageKey)).values.fixtureGain,.8);
 assert.equal((await import(visualURL+'?reload')).visualSettings.fixtureGain,.8);stop();
 // Component edits regenerate at their original cascade position.
 const cssFile=path.join(fixture,'web/ui/game-settings.css');await writeFile(cssFile,(await readFile(cssFile,'utf8'))+'\n.fixture-settings {color:inherit}\n');
 assert.notEqual(run('--check').status,0);assert.equal(run().status,0);assert.equal(run('--check').status,0);
 assert((await readFile(path.join(fixture,'web/style.css'),'utf8')).includes('.fixture-settings {color:inherit}'));
 console.log('PASS: one schema edit generates accessible controls in both apps with binding, visibility, validation, persistence/reload; stale controls and component CSS fail the build.');
}finally{
 if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;
 if(path.dirname(fixture)!==path.resolve(tmpdir())||!path.basename(fixture).startsWith('stack-settings-'))throw Error('Unexpected fixture path');
 await rm(fixture,{recursive:true,force:true});
}
