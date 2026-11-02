// Stream into one bounded buffer; report actual bytes/records, never a timer estimate.
export async function readBytes(stream, size, report) {
  const bytes = new Uint8Array(size), reader = stream.getReader();
  let loaded = 0, last = -Infinity;
  report(0);
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      if (loaded + value.byteLength > size) throw Error('Packing asset size mismatch');
      bytes.set(value, loaded); loaded += value.byteLength;
      const now = performance.now();
      if (now-last >= 60) { report(loaded); last = now; }
    }
    if (loaded !== size) throw Error('Packing asset size mismatch');
    report(loaded);
    return bytes;
  } finally { reader.releaseLock(); }
}
export async function loadPackingAsset(url, asset, report = () => {}) {
  const response = await fetch(url);
  if (!response.ok) throw Error(`Cannot load local packing asset ${url}`);
  const bytes = await readBytes(response.body, asset.compressedBytes,
    loaded => report({phase:'download',loaded,total:asset.compressedBytes}));
  report({phase:'verify'});
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
    .map(n=>n.toString(16).padStart(2,'0')).join('');
  if (hash !== asset.sha256) throw Error('Packing asset checksum mismatch; reload the app');
  return readBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),asset.bytes,
    loaded => report({phase:'decode',loaded,total:asset.bytes}));
}
