import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('data/source.json', root), 'utf8'));
if (manifest.version !== 1 || manifest.archive !== 'results.7z' ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256)) {
  throw Error('Invalid local dataset source manifest');
}
const hash = createHash('sha256');
for await (const chunk of createReadStream(new URL(manifest.archive, root))) hash.update(chunk);
if (hash.digest('hex') !== manifest.sha256) {
  throw Error('Dataset archive checksum mismatch. Validate the replacement dataset before updating data/source.json.');
}
console.log(`Verified local dataset source: ${manifest.dataset} (${manifest.archive})`);
