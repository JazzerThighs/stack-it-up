import {countSpecs} from './filter-counts.js';
export function describeRange(min,max,limit) {
  if(min==='' || max==='')return {kind:'invalid',text:'Enter both limits'};
  min=Number(min);max=Number(max);
  if(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max>limit||min>max)return {kind:'invalid',text:'Invalid range'};
  if(max===0)return {kind:'excluded',text:'Excluded'};
  if(min===0&&max===limit)return {kind:'any',text:'Any'};
  return {kind:'limited',text:min===max?`Exactly ${min}`:`${min}–${max} allowed`};
}
export function refreshRangeCards(root) {
  const $=id=>root.getElementById(id);let limited=0,excluded=0,invalid=0;
  for(const [id,,limit] of countSpecs) {
    const min=$('countMin'+id).value,max=$('countMax'+id).value;
    const state=describeRange(min,max,limit);
    $('rangeCard'+id).dataset.rangeState=state.kind;
    $('rangeState'+id).textContent=state.text;
    for(const name of ['countMin','countMax'])$(name+id).setAttribute('aria-invalid',String(state.kind==='invalid'));
    for(let i=0;i<=limit;i++)$('rangeTick'+id+i).dataset.allowed=String(state.kind!=='invalid'&&i>=Number(min)&&i<=Number(max));
    if(state.kind==='limited')limited++;if(state.kind==='excluded')excluded++;if(state.kind==='invalid')invalid++;
  }
  $('rangeFilterSummary').textContent=invalid?`${invalid} invalid range${invalid===1?'':'s'} — check the marked cards.`:
    limited||excluded?`${limited} limited · ${excluded} excluded · other counts unrestricted`:'All counts unrestricted';
  return invalid;
}
