import assert from 'node:assert/strict';
import {describeRange,refreshRangeCards} from '../web/explorer/filter-range-ui.js';
import {countSpecs} from '../web/explorer/filter-counts.js';
for(const [min,max,kind,text] of [[0,6,'any','Any'],[0,0,'excluded','Excluded'],[2,2,'limited','Exactly 2'],[1,4,'limited','1–4 allowed'],[4,1,'invalid','Invalid range'],['',4,'invalid','Enter both limits'],[0,7,'invalid','Invalid range']])assert.deepEqual(describeRange(min,max,6),{kind,text});
const nodes=new Map(),root={getElementById(id){if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},setAttribute(k,v){this[k]=v;}});return nodes.get(id);}};
for(const [id,,limit] of countSpecs){root.getElementById('countMin'+id).value='0';root.getElementById('countMax'+id).value=String(limit);}
assert.equal(refreshRangeCards(root),0);assert.equal(root.getElementById('rangeFilterSummary').textContent,'All counts unrestricted');
root.getElementById('countMinT').value='2';root.getElementById('countMaxT').value='3';root.getElementById('countMaxO').value='0';refreshRangeCards(root);
assert.equal(root.getElementById('rangeTickT1').dataset.allowed,'false');assert.equal(root.getElementById('rangeTickT2').dataset.allowed,'true');assert.equal(root.getElementById('rangeCardO').dataset.rangeState,'excluded');
root.getElementById('countMinT').value='5';assert.equal(refreshRangeCards(root),1);assert.equal(root.getElementById('countMinT')['aria-invalid'],'true');
console.log('PASS: range labels, allowed-count strips, exclusions, invalid values and summary match the actual limits.');
