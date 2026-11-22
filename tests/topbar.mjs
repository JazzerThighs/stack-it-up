import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBrowserFixture} from './fixtures/browser.mjs';
import {initializeTopbar} from '../web/ui/topbar.js';
const html=fs.readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const bar=html.match(/<header class="topbar">([\s\S]*?)<\/header>/)[1];
for(const id of ['qrOpen','screenSelect','gameTab','explorerTab','solverTab','settingsOpen','bluetoothOpen','resetGraphics'])assert(bar.includes(`id="${id}"`),id+' belongs in the header');
assert.equal((html.match(/id="settingsOpen"/g)||[]).length,1);
const connection=html.match(/<dialog id="bluetoothDialog"[\s\S]*?<\/dialog>/)[0];
for(const id of ['gameInputSource','bluetoothConnect','bluetoothDisconnect','bluetoothStatus'])assert(connection.includes(`id="${id}"`));
const settings=html.match(/<dialog id="settingsDialog"[\s\S]*?<\/dialog>/)[0];assert(!settings.includes('id="bluetoothConnect"'));
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
try{initializeTopbar();for(const name of ['qr','bluetooth']){f.$(name+'Open').onclick();assert(f.$(name+'Dialog').open);f.$(name+'Close').onclick();assert(!f.$(name+'Dialog').open);}}finally{f.restore();}
console.log('PASS: shared header controls, single Settings entry, separate connection controls, local QR assets and dialog lifecycle.');
