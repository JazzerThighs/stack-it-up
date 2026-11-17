import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
// Contract tests must follow changed preferences; scenario tests must set up
// their own inputs. Each subprocess gets a fresh module graph and storage.
for(const variant of ['low','high'])for(const file of [
  'startup-defaults','piece-catalog','settings-schema','display-settings',
  'input-preferences','appearance','control-settings','orbit-settings','lighting-classes',
]) {
  const result=spawnSync(process.execPath,['--import','./tests/fixtures/alternate-defaults.mjs',`tests/${file}.mjs`],{
    cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,TEST_DEFAULTS_VARIANT:variant},
  });
  assert.equal(result.status,0,`${variant} defaults: ${file}\n${result.error||''}\n${result.stdout}\n${result.stderr}`);
}
console.log('PASS: alternate colors, shapes, effects, booleans, sizes and numeric bounds do not pin tests to product preferences.');
