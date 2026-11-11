import fs from 'node:fs';
import assert from 'node:assert/strict';

/** Minimal contract fixture, not a DOM/WebGL implementation or visual oracle. */
export function createBrowserFixture(html,{
  defaultValue='0',
  uniformLocation=(_,name)=>name,
  fetch=async url=>({ok:true,arrayBuffer:async()=>fs.readFileSync(url)}),
  globals={},
}={}) {
  const enums=new Map(),frames=[],elements=new Map();
  let buffer;
  const gl=new Proxy({
    createVertexArray:()=>({}),createBuffer:()=>({}),createProgram:()=>({}),createShader:()=>({}),
    getShaderParameter:()=>true,checkFramebufferStatus:()=>gl.FRAMEBUFFER_COMPLETE,
    getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:uniformLocation,
    bindBuffer:(_,value)=>{buffer=value;},bufferData:(_,data)=>{buffer.data=data;},
  },{
    get:(object,key)=>key in object?object[key]:typeof key==='string'&&key===key.toUpperCase()
      ?(enums.has(key)?enums.get(key):(enums.set(key,enums.size+1),enums.get(key)))
      :()=>{},
  });
  function element() {
    return {
      checked:false,value:defaultValue,style:{},dataset:{},children:[],hidden:false,disabled:false,textContent:'',
      classList:{toggle(){},add(){},remove(){}},
      append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},
      after(){},remove(){},removeAttribute(){},attachShadow(){return this.shadowRoot??=element();},
      setAttribute(){},addEventListener(type,listener){(this.listeners??={})[type]=listener;},
      querySelector(){return this.child??=element();},querySelectorAll(){return [];},select(){},
      closest(){return this.parent??=element();},
      getContext(type){return type==='webgl2'?gl:new Proxy({},{get:()=>()=>{}});},
      getBoundingClientRect(){return {left:0,top:0,width:1200,height:800};},
      setPointerCapture(){},focus(){},showModal(){this.open=true;},close(){this.open=false;},
    };
  }
  for(const tag of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const node=element();
    node.checked=/\bchecked\b/.test(tag[0]);node.hidden=/\bhidden\b/.test(tag[0]);
    node.value=tag[0].match(/\bvalue="([^"]*)"/)?.[1]||defaultValue;
    elements.set(tag[1],node);
  }
  const $=id=>{assert(elements.has(id),`missing ${id}`);return elements.get(id);};
  const document={hidden:false,getElementById:$,createElement:element,querySelector:element,querySelectorAll:()=>[],addEventListener(){}};
  const replacements={
    document,devicePixelRatio:1,matchMedia:()=>({matches:true}),
    ResizeObserver:class {observe(){} disconnect(){}},
    requestAnimationFrame:fn=>(frames.push(fn),frames.length),fetch,...globals,
  };
  let previous=null;
  function install() {
    if(previous)throw Error('Browser fixture is already installed');
    previous=new Map(Object.keys(replacements).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
    Object.assign(globalThis,replacements);
  }
  function restore() {
    if(!previous)return;
    for(const [key,descriptor] of previous) {
      if(descriptor)Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
    previous=null;frames.length=0;
  }
  function flush({time=800,limit=100}={}) {
    let count=0;
    while(frames.length&&count++<limit)frames.shift()(time);
  }
  return {$,elements,element,gl,frames,document,install,restore,flush};
}
