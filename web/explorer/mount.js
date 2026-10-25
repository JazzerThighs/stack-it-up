// A scoped DOM subtree, not an iframe: both apps keep their live state.
export async function mountExplorer(host) {
  if (host.explorerReady) return host.explorerReady;
  host.explorerReady = (async () => {
    host.textContent = 'Loading packing explorer…';
    const response = await fetch(new URL('./index.html', import.meta.url));
    if (!response.ok) throw Error('Unable to load packing explorer');
    const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
    const app = parsed.querySelector('.app');
    if (!app) throw Error('Explorer layout is missing');
    const root = host.shadowRoot || host.attachShadow({mode:'open'});
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = new URL('./style.css', import.meta.url).href;
    const layout = document.createElement("link");
    layout.rel = "stylesheet"; layout.href = new URL("./workspace.css", import.meta.url).href;
    root.replaceChildren(css, layout, app);
    host.textContent = '';
    const { initializeExplorer } = await import('./script.js');
    await initializeExplorer(root);
  })().catch(error => {
    host.explorerReady = null;
    if (host.shadowRoot) host.shadowRoot.textContent = error.message + ". Switch back to the game and retry.";
    host.textContent = error.message + '. Switch back to the game and retry.';
    throw error;
  });
  return host.explorerReady;
}
