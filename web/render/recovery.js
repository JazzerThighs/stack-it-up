// All views share recovery, including explorer canvases inside its shadow root.
const renderers = new Set();
export function registerRenderer(renderer) { renderers.add(renderer); }
export function unregisterRenderer(renderer) { renderers.delete(renderer); }
let noticeTimer;
export function graphicsNotice(text, duration = 0, root = document) {
  clearTimeout(noticeTimer);
  const status = root.getElementById('graphicsStatus');
  if (!status) return;
  status.textContent = text;
  if (text && duration) noticeTimer = setTimeout(() => {
    if (status.textContent === text) status.textContent = '';
  }, duration);
}
export function recoverRenderers(force = false) {
  let waiting = 0, failed = 0;
  for (const renderer of renderers) {
    try {
      if (force || renderer.contextLost || renderer.gl.isContextLost?.()) {
        if (!renderer.restoreGraphics()) waiting++;
      } else renderer.requestDraw();
    } catch (error) { failed++; console.error('Graphics recovery failed', error); }
  }
  return {waiting, failed};
}
export function installRecovery(root = document) {
  const recover = force => {
    const {waiting, failed} = recoverRenderers(force);
    graphicsNotice(failed ? 'Graphics reset failed. Your game is saved; try reloading.'
      : waiting ? 'Waiting for the browser to restore graphics. Your puzzle is unchanged.'
      : force ? 'Graphics reset. Your puzzle is unchanged.' : '', failed || waiting ? 0 : 3500, root);
  };
  root.getElementById('resetGraphics').onclick = () => recover(true);
  root.addEventListener('visibilitychange', () => { if (!root.hidden) recover(false); });
  globalThis.addEventListener?.('pageshow', () => recover(false));
}
