import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBrowserFixture} from './fixtures/browser.mjs';
import {initializeTopbar} from '../web/ui/topbar.js';
const html=fs.readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const bar=html.match(/<header class="topbar">([\s\S]*?)<\/header>/)[1];
for(const id of ['qrOpen','screenSelect','gameTab','explorerTab','solverTab','settingsOpen','bluetoothOpen','resetGraphics'])assert(bar.includes(`id="${id}"`),id+' belongs in the header');
assert.equal((html.match(/id="settingsOpen"/g)||[]).length,1);
assert(!html.includes('id="bluetoothDialog"'));
const settings=html.match(/<dialog id="settingsDialog"[\s\S]*?<\/dialog>/)[0];
const input=settings.match(/<fieldset id="cubeInputSettings">([\s\S]*?)<\/fieldset>/)[1];
let previous=-1;
for(const id of ['gameInputSource','bluetoothConnect','bluetoothDisconnect','bluetoothCalibrate','bluetoothStatus','bluetoothShowAll','bluetoothMac','bluetoothWideWindow','bluetoothWideReset','bluetoothSliceWindow','bluetoothSliceReset','bluetoothGyroSmoothing']) {
  const index=input.indexOf('id="'+id+'"');
  assert(index>previous,id+' should appear in order on the Input page');
  previous=index;
}
for (const [filename, url] of [
  ['stackitupappqrcode.png', 'https://jazzerthighs.github.io/stack-it-up/'],
  ['stackituprepoqrcode.png', 'https://github.com/JazzerThighs/stack-it-up'],
]) {
  assert(html.includes(`src="./images/${filename}"`));
  assert(html.includes(`href="${url}"`));
  assert.deepEqual(
    fs.readFileSync(new URL(`../web/images/${filename}`, import.meta.url)),
    fs.readFileSync(new URL(`../docs/${filename}`, import.meta.url)),
  );
}
const f=createBrowserFixture(html);f.install();
try {
  initializeTopbar();f.$('qrOpen').onclick();assert(f.$('qrDialog').open);
  f.$('qrClose').onclick();assert(!f.$('qrDialog').open);
} finally {f.restore();}
console.log('PASS: shared header, Bluetooth Input control order and QR dialog lifecycle.');
