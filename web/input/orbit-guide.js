import {captureSectors,axisLabel,dragAxis} from './orbit-math.js';
const ns='http://www.w3.org/2000/svg';
// A static, non-interactive overlay: rebuilt only when a camera drag begins.
export function showOrbitGuide(canvas,x,y,settings){
 const host=canvas.parentElement;
 if(!settings.orbitDragGuide||!host||!document.createElementNS)return null;
 const rect=canvas.getBoundingClientRect(),parent=host.getBoundingClientRect();
 const svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
 svg.setAttribute('aria-hidden','true');svg.classList.add('orbit-drag-guide');
 svg.style.cssText=`position:absolute;left:${rect.left-parent.left+host.scrollLeft}px;top:${rect.top-parent.top+host.scrollTop}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:8;overflow:hidden`;
 const cx=x-rect.left,cy=y-rect.top,r=Math.max(settings.orbitDeadZone+36,Math.min(140,Math.max(60,Math.min(rect.width,rect.height)*.22)));
 const point=(a,length=r)=>[cx+Math.cos(a*Math.PI/180)*length,cy+Math.sin(a*Math.PI/180)*length];
 const add=(name,attrs)=>{const el=document.createElementNS(ns,name);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));svg.append(el);return el;};
 const colors={X:'#b6d6ff',Y:'#b9f0d8',Z:'#f4d4a2',XY:'#cad7dd'};
 const rays=new Set();
 for(const {start,end,axis}of captureSectors(settings)){
  const a=point(start),b=point(end);
  add('path',{d:`M ${cx} ${cy} L ${a.join(' ')} A ${r} ${r} 0 ${end-start>180?1:0} 1 ${b.join(' ')} Z`,fill:colors[axis],'fill-opacity':axis==='XY'?.015:.055,stroke:'none'});
  rays.add(start);rays.add(end%360);
 }
 for(const a of rays){const p=point(a);add('line',{x1:cx,y1:cy,x2:p[0],y2:p[1],stroke:'#d9e8ec','stroke-opacity':.3,'stroke-width':1});}
 for(const a of [0,45,90,135,180,225,270,315]){
  const radians=a*Math.PI/180,axis=dragAxis(Math.cos(radians),Math.sin(radians),settings);
  if(axis==='XY')continue;
  const p=point(a,r+13);
  const label=add('text',{x:p[0],y:p[1],'text-anchor':'middle','dominant-baseline':'middle',fill:colors[axis],'fill-opacity':.85,'font-size':11,'font-family':'system-ui,sans-serif',stroke:'#102028','stroke-width':3,'paint-order':'stroke'});
  label.textContent=axisLabel(axis,settings);
 }
 if(settings.orbitDeadZone>0)add('circle',{cx,cy,r:settings.orbitDeadZone,fill:'#102028','fill-opacity':.85,stroke:'#d9e8ec','stroke-opacity':.65,'stroke-width':1,'stroke-dasharray':'3 3','data-orbit-dead-zone':'true'});
 add('circle',{cx,cy,r:3,fill:'#d9e8ec','fill-opacity':.7});
 host.append(svg);return svg;
}
