// Node --import preload: exercise customization without editing the user's file.
import {startupDefaults as defaults} from '../../web/ui/startup-defaults.js';
import fs from 'node:fs';
const high=process.env.TEST_DEFAULTS_VARIANT==='high';
for(const domain of ['appearance','display','controls','orbit']) {
  const {fields,optionSets}=JSON.parse(fs.readFileSync(new URL(`../../data/${domain}-settings.json`,import.meta.url),'utf8'));
  for(const [id,spec] of Object.entries(fields)) {
    const options=spec.options||(spec.optionSet?[...optionSets[spec.optionSet],...(spec.extraOptions||[])].map(([v])=>v):null);
    defaults[domain][id]=options?options[high?options.length-1:0]:spec.color?(high?'#abcdef':'#102030'):
      typeof spec.value==='boolean'?high:high?spec.max:spec.min;
  }
}
for(const key of Object.keys(defaults.palette))defaults.palette[key]=high?'#aabbcc':'#123456';
defaults.layerOrder.reverse();
for(const domain of ['game','explorer']) {
  for(const [id,value] of Object.entries(defaults[domain]))if(typeof value==='boolean')defaults[domain][id]=high;
  defaults[domain].modelShape=high?'text':'gameboy';
  defaults[domain].pieceAppearance=high?'ascii':'matte';
}
