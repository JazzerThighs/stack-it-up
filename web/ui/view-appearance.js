import {startupDefaults} from './startup-defaults.js';
import {visualSettings,visualSpecs} from '../render/visual-settings.js';
import {colors,defaultColors} from '../render/palette.js';
import {displaySettings} from './display-settings.js';
import {palettePresets} from '../render/palette-presets.js';

export const appearanceViews=[
  ['active','Active (Game)','activePieces','gameActiveSize'],
  ['stack','Stack (Game)','stackPieces','gameStackSize'],
  ['family','Family Explorer','familyPieces','familySize'],
  ['start','Start Cube (2 Packing)','practiceStartPieces','practiceStartSize'],
  ['target','Target Cube (2 Packing)','practiceTargetPieces','practiceTargetSize'],
];
export const appearanceViewFor=id=>({familyExploreCube:'family',scrambledCube:'start',practiceLeft:'start',solvedCube:'target',practiceRight:'target'}[id]);
const key='stack-it-up.view-appearance',listeners=new Set(),profiles={},live={};
let writable=true;
let saved={};try{const data=JSON.parse(globalThis.localStorage?.getItem(key)||'null');if(data?.version===1)saved=data.views||{};else if(data?.version)writable=false;}catch{}
export const compositionOptions=[['whole','Whole Tetrominos / Retained Shapes'],['cubies','Individual Cubies'],['solids','Balls & Solids']];
export function splitComposition(mode){
  if(mode&&typeof mode==='object')return mode;
  return {whole:['whole','wholeSolids','retained'].includes(mode)?'whole':mode==='solids'?'solids':'cubies',
    fragments:mode==='retained'?'whole':['solids','wholeSolids','cubiesSolids'].includes(mode)?'solids':'cubies',extras:'cubies'};
}
function valid(name,value){
  if(['whole','fragments','extras'].includes(name))return compositionOptions.some(([v])=>v===value);
  if(name==='modelShape')return ['angular','jelly','gameboy','text'].includes(value);
  if(name==='effect')return ['jelly','dither','matte','cel','ascii'].includes(value);
  if(name==='size')return Number.isFinite(value)&&value>=50&&value<=160;
  if(name==='opacity')return Number.isFinite(value)&&value>=0&&value<=100;
  if(name==='palette')return Array.isArray(value)&&value.length===10&&value.every(c=>/^#[\da-f]{6}$/i.test(c));
  const spec=visualSpecs[name];
  return !!spec&&(spec.color?/^#[\da-f]{6}$/i.test(value):Number.isFinite(value)&&value>=spec.min&&value<=spec.max);
}
export function getViewAppearance(id,renderer){
  if(renderer&&!renderer._appearanceScope&&!renderer._packetAppearanceScope)live[id]={modelShape:renderer.modelShape,appearance:renderer.appearance,opacity:renderer.opacity,activeOpacity:renderer.activeOpacity,stackOpacity:renderer.stackOpacity};
  renderer=renderer||live[id]||{};
  const entry=appearanceViews.find(v=>v[0]===id);if(!entry)return null;
  const domain=id==='active'||id==='stack'?'game':'explorer';
  const inherited={...visualSettings,...splitComposition(displaySettings[entry[2]]),
    modelShape:renderer.modelShape||startupDefaults[domain].modelShape,effect:renderer.appearance||startupDefaults[domain].pieceAppearance,
    size:displaySettings[entry[3]],opacity:100*(renderer.opacity??(id==='stack'?renderer.stackOpacity:renderer.activeOpacity)??(1-Number(startupDefaults[domain][domain==='game'?(id==='stack'?'stackTransparency':'activeTransparency'):'targetTransparency'])/100)),palette:colors.slice()};
  const overrides=profiles[id]??={};
  if(!Object.hasOwn(overrides,'loaded')){
    for(const [name,value]of Object.entries(startupDefaults.viewAppearance?.[id]||{})){if(!valid(name,value))throw Error('Invalid startup default: viewAppearance.'+id+'.'+name);overrides[name]=structuredClone(value);}
    for(const [name,value]of Object.entries(saved[id]||{}))if(valid(name,value))overrides[name]=structuredClone(value);
    Object.defineProperty(overrides,'loaded',{value:true});
  }
  return {...inherited,...overrides};
}
export function hasViewAppearance(id){getViewAppearance(id);return Object.keys(profiles[id]||{}).length>0;}
export function setViewAppearance(id,name,value){
  if(!appearanceViews.some(v=>v[0]===id)||!valid(name,value))return false;
  const activated=!hasViewAppearance(id);
  // Capture the full profile on first edit: subsequent edits to another view or
  // legacy shared controls cannot alter this view's appearance.
  profiles[id]={...getViewAppearance(id),[name]:structuredClone(value)};
  Object.defineProperty(profiles[id],'loaded',{value:true});
  if(writable)try{globalThis.localStorage?.setItem(key,JSON.stringify({version:1,views:{...saved,...profiles}}));}catch{}
  for(const listener of listeners)listener(id,name,activated);return true;
}
export function resetViewAppearance(id){
  const entry=appearanceViews.find(v=>v[0]===id);if(!entry)return;
  const domain=['active','stack'].includes(id)?'game':'explorer';
  profiles[id]={...Object.fromEntries(Object.entries(visualSpecs).map(([name,spec])=>[name,startupDefaults.appearance[name]??spec.value])),
    ...splitComposition(startupDefaults.display[entry[2]]),size:startupDefaults.display[entry[3]],
    opacity:100-Number(startupDefaults[domain][domain==='game'?id+'Transparency':'targetTransparency']),
    modelShape:startupDefaults[domain].modelShape,effect:startupDefaults[domain].pieceAppearance,palette:defaultColors.slice(),...startupDefaults.viewAppearance?.[id]};
  Object.defineProperty(profiles[id],'loaded',{value:true});
  if(writable)try{globalThis.localStorage?.setItem(key,JSON.stringify({version:1,views:{...saved,...profiles}}));}catch{}
  for(const listener of listeners)listener(id);
}
export function subscribeViewAppearance(listener){listeners.add(listener);return()=>listeners.delete(listener);}

const paletteLetters=['O','T','L','J','S','Z','B','D','F'];
export function setViewPalettePreset(id,presetId){
  const preset=palettePresets.find(p=>p.id===presetId);
  if(!preset||!appearanceViews.some(v=>v[0]===id))return false;
  return setViewAppearance(id,'palette',['#000000',...paletteLetters.map(letter=>preset.colors[letter])]);
}
export function viewPalettePreset(id){
  const values=getViewAppearance(id).palette;
  return palettePresets.find(p=>paletteLetters.every((letter,i)=>p.colors[letter].toLowerCase()===values[i+1].toLowerCase()))?.id||'custom';
}

// Geometry APIs currently consume shared settings. Scope those synchronous calls
// and restore in finally; worker requests capture their own immutable settings.
export function withViewAppearance(id,renderer,callback){
  if(!hasViewAppearance(id))return callback();
  const config=getViewAppearance(id,renderer),oldVisual={...visualSettings},oldColors=colors.slice();
  const entry=appearanceViews.find(v=>v[0]===id),oldMode=displaySettings[entry[2]];
  const oldShape=renderer.modelShape,oldEffect=renderer.appearance;
  try{
    for(const name of Object.keys(visualSpecs))visualSettings[name]=config[name];
    colors.splice(0,colors.length,...config.palette);
    displaySettings[entry[2]]={whole:config.whole,fragments:config.fragments,extras:config.extras};
    renderer.modelShape=config.modelShape;renderer.appearance=config.effect;
    return callback(config);
  }finally{Object.assign(visualSettings,oldVisual);colors.splice(0,colors.length,...oldColors);displaySettings[entry[2]]=oldMode;renderer.modelShape=oldShape;renderer.appearance=oldEffect;}
}

export function createViewAppearancePage(id){
  const title=appearanceViews.find(v=>v[0]===id)[1],section=document.createElement('fieldset');
  section.id='viewAppearance'+id;section.className='settings-section';
  const legend=document.createElement('legend');legend.textContent=title;section.append(legend);
  const config=getViewAppearance(id),controls=[],paletteControls=[];
  // Keep the preset selector directly on each view page, above nested tuning pages.
  const presetRow=document.createElement('div');presetRow.className='setting-row';
  const presetLabel=document.createElement('label'),presetSelect=document.createElement('select');
  presetSelect.id=section.id+'-palettePreset';presetLabel.setAttribute('for',presetSelect.id);presetLabel.textContent='Color palette';
  for(const preset of [...palettePresets,{id:'custom',label:'Custom'}]){
    const option=document.createElement('option');option.value=preset.id;option.textContent=preset.label;option.disabled=preset.id==='custom';presetSelect.append(option);
  }
  presetSelect.value=viewPalettePreset(id);
  presetSelect.addEventListener('change',()=>setViewPalettePreset(id,presetSelect.value));
  presetRow.append(presetLabel,presetSelect);section.append(presetRow);
  subscribeViewAppearance(changed=>{if(changed===id)presetSelect.value=viewPalettePreset(id);});
  const palette=document.createElement('div'),paletteLegend=document.createElement('h3');palette.className='piece-color-swatches';paletteLegend.textContent='Piece colors';palette.append(paletteLegend);
  section.append(palette);
  let parent=section;
  const group=title=>{const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;field.append(legend);section.append(field);return field;};
  function add(name,label,options,spec={}){
    if(spec.select)options=[[0,'Model default'],[1,'Surface angle'],[2,'Light proximity']];
    const row=document.createElement('div');row.className='setting-row';
    const caption=document.createElement('label'),input=document.createElement(options?'select':'input');
    input.id=section.id+'-'+name;caption.setAttribute('for',input.id);caption.textContent=label;
    if(options)for(const [value,text]of options){const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option);}
    else {input.type=spec.color?'color':spec.checkbox?'checkbox':'range';input.min=spec.min;input.max=spec.max;input.step=spec.step||1;}
    const output=document.createElement('output');output.setAttribute('for',input.id);
    input.value=config[name];input.checked=!!config[name];output.textContent=spec.checkbox?'':String(config[name])+(spec.unit||'');
    const change=()=>{const value=spec.checkbox?Number(input.checked):spec.select?Number(input.value):options||spec.color?input.value:Number(input.value);setViewAppearance(id,name,value);};
    input.addEventListener(spec.commit|| (options||spec.color||spec.checkbox?'change':'input'),change);
    row.append(caption,input,output);if(spec.help){const help=document.createElement('p');help.textContent=spec.help;row.append(help);}parent.append(row);controls.push([name,input,output,spec]);
  }
  add('whole','Detected whole tetracubes',compositionOptions);
  add('fragments','Cubie fragments',compositionOptions);
  add('extras','Extra cubies',compositionOptions);
  const note=document.createElement('p');note.textContent='Retained fragments keep their original cut surfaces. Unassigned extras remain individual cubies in retained mode.';section.append(note);
  add('modelShape','Model shape',[['angular','Angular (Tengen)'],['jelly','Jelly'],['gameboy','Gameboy'],['text','Extruded text []']]);
  add('effect','Rendering effect',[['jelly','None'],['dither','Dithered'],['matte','Matte'],['cel','Cel shaded'],['ascii','ASCII']]);
  add('size','Cube size (%)',null,{min:50,max:160});add('opacity','Opacity (%)',null,{min:0,max:100});
  const groups=new Map();
  for(const [name,spec]of Object.entries(visualSpecs)){
    if(name.startsWith('extra')&&spec.color)continue;
    const category=spec.group|| (name.startsWith('light')?'Lighting':name.startsWith('solid')?'Balls & Solids':'transparency');
    const title=({jelly:'Model shaping',cubie:'Cubie size',ascii:'ASCII',dither:'Dither',transparency:'Transparency'})[category]||category;
    if(!groups.has(title))groups.set(title,group(title));parent=groups.get(title);add(name,spec.label,null,spec);
  }
  parent=section;

  for(const [i,letter]of ['O','T','L','J','S','Z','B','D','F'].entries()){
    const label=document.createElement('label'),input=document.createElement('input');input.type='color';input.value=config.palette[i+1];label.textContent=letter;
    input.setAttribute('aria-label',title+' '+letter+' color');input.addEventListener('change',()=>{const values=getViewAppearance(id).palette.slice();values[i+1]=input.value;setViewAppearance(id,'palette',values);});label.append(input);palette.append(label);paletteControls.push([i+1,input]);
  }
  const extraRow=document.createElement('div');extraRow.className='extra-color-swatches';parent=extraRow;
  for(const name of ['extraCornerColor','extraEdgeColor','extraCenterColor','extraCoreColor'])add(name,visualSpecs[name].label,null,visualSpecs[name]);
  palette.append(extraRow);

  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset this view';reset.addEventListener('click',()=>resetViewAppearance(id));section.append(reset);
  subscribeViewAppearance(changed=>{if(changed===id){const latest=getViewAppearance(id);for(const [name,input,output,spec]of controls){input.value=latest[name];input.checked=!!latest[name];output.textContent=spec.checkbox?'':String(latest[name])+(spec.unit||'');}for(const [index,input]of paletteControls)input.value=latest.palette[index];}});
  return section;
}
