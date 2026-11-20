import {createBluetoothCube} from '../input/bluetooth-cube.js';
import {controlSettings} from '../input/control-settings.js';
import {axisAngle, multiply, quaternion, matrix} from '../input/orbit-math.js';

export function formatMacInput(input) {
  const raw = input.value;
  const hex = value => value.replace(/[^0-9a-f]/gi, '').toUpperCase().slice(0, 12);
  const digits = hex(raw);
  const caretDigits = hex(raw.slice(0, input.selectionStart ?? raw.length)).length;
  input.value = digits.match(/.{1,2}/g)?.join(':') || '';
  const caret = caretDigits + Math.floor(Math.max(0, caretDigits - 1) / 2);
  input.setSelectionRange(caret, caret);
}

export function bindBluetoothControls({root = document, ...options}) {
  const $ = id => root.getElementById(id);
  $('bluetoothMac').addEventListener('input', () => formatMacInput($('bluetoothMac')));
  const supported = !!globalThis.navigator?.bluetooth && globalThis.isSecureContext;
  // Load before the Connect click so requestDevice retains user activation.
  let library, current;
  const refresh = () => {
    const {mode, connecting, connected, message} = current;
    $('bluetoothOptions').hidden = mode !== 'bluetooth';
    $('bluetoothConnect').disabled = mode !== 'bluetooth' || !supported || !library || connecting || connected;
    $('bluetoothDisconnect').disabled = !connecting && !connected;
    $('bluetoothRecenter').disabled = !connected || current.calibration !== 'ready';
    $('bluetoothRecenter').title = !connected ? 'Connect a smartcube to recenter its gyroscope'
      : current.calibration !== 'ready' ? 'Complete cube calibration before recentering'
      : 'Hold your natural pose and recenter the gyroscope; face mapping stays unchanged';
    $('bluetoothCalibrate').disabled = !connected;
    $('bluetoothStatus').textContent = message;
    $('cubeCalibration').hidden = current.calibration !== 'calibrating';
    $('cubeCalibrationStatus').textContent = message;
    for (const face of ['U','F','R']) {
      $('calibrate'+face).textContent = `Record ${face}${current.faces[face] ? ' ✓' : ''}`;
      $('calibrate'+face).setAttribute('aria-pressed', String(current.capture === face));
    }
    $('calibrationConfirm').disabled = !current.dragged || !['U','F','R'].every(face => current.faces[face]);
  };
  const controller = createBluetoothCube({...options,
    sliceWindow: () => controlSettings.bluetoothSliceWindow,
    wideWindow: () => controlSettings.bluetoothWideWindow,
    availability: () => globalThis.navigator.bluetooth.getAvailability?.(),
    connect: onStatus => library.connectSmartCube({onStatus,
      deviceSelection: $('bluetoothShowAll').checked ? 'any' : 'filtered',
      macAddressProvider:async () => {
      const value = $('bluetoothMac').value.trim();
      return value || null;
    }}),
    status: state => {
      const previous = current?.calibration;
      current = state; refresh();
      if (state.calibration === 'calibrating' && previous !== 'calibrating') options.rotate(options.orientation());
      if (state.calibration === 'pending') queueMicrotask(() => controller.beginCalibration());
    },
  });
  for (const face of ['U','F','R']) $('calibrate'+face).addEventListener('click', () => controller.captureFace(face));
  $('calibrationConfirm').addEventListener('click', () => controller.confirmCalibration());
  $('calibrationCancel').addEventListener('click', () => {
    $('gameInputSource').value = 'manual'; controller.setMode('manual');
  });
  // Capture calibration drags before normal turn/orbit handlers. No snapping or
  // inertia is applied, and both game views receive exactly the same pose.
  let drag;
  const consume = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  root.addEventListener('pointerdown', e => {
    if (!controller.calibrating || !options.active() || !e.target.closest?.('#gamePage .viewport')) return;
    consume(e); drag = {id:e.pointerId,x:e.clientX,y:e.clientY,target:e.target};
    e.target.setPointerCapture?.(e.pointerId);
  }, true);
  root.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    consume(e);
    if (!controller.calibrating || !options.active()) { drag = null; return; }
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    drag.x=e.clientX; drag.y=e.clientY;
    if (!dx && !dy) return;
    const rotation = e.shiftKey || $('calibrationRoll').checked ? axisAngle([0,0,1],-dx*.01) : axisAngle([dy,dx,0],Math.hypot(dx,dy)*.01);
    options.rotate(matrix(multiply(rotation,quaternion(options.orientation()))));
    controller.markDragged();
  }, true);
  for (const name of ['pointerup','pointercancel']) root.addEventListener(name, e => {
    if (!drag || drag.id !== e.pointerId) return;
    consume(e); drag.target.releasePointerCapture?.(e.pointerId); drag = null;
  }, true);
  const resume = () => { controller.suspend(); controller.beginCalibration(); };
  // Dialog close events and page switches reveal the board after connection.
  for (const id of ['settingsDialog','newDialog']) $(id).addEventListener('close', resume);
  if (globalThis.MutationObserver) {
    const observer = new MutationObserver(resume);
    observer.observe($('gamePage'), {attributes:true,attributeFilter:['hidden']});
  }
  $('gameInputSource').addEventListener('change', async () => {
    controller.setMode($('gameInputSource').value);
    if (controller.mode !== 'bluetooth') return;
    if (!supported) { $('bluetoothStatus').textContent = 'Bluetooth requires Chrome or Edge on HTTPS or localhost.'; return; }
    try {
      library ||= await import('../vendor/smartcube.js');
      refresh();
    } catch { if (controller.mode === 'bluetooth') $('bluetoothStatus').textContent = 'Could not load Bluetooth support. Rebuild the app and reload.'; }
  });
  $('bluetoothConnect').addEventListener('click', () => {
    const mac = $('bluetoothMac').value.trim();
    if (mac && !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) {
      $('bluetoothStatus').textContent = 'Enter a MAC address as AA:BB:CC:DD:EE:FF, or leave it blank for automatic detection.'; return;
    }
    void controller.connect();
  });
  $('bluetoothDisconnect').addEventListener('click', () => void controller.disconnect());
  $('bluetoothCalibrate').addEventListener('click', () => controller.recalibrate());
  $('bluetoothRecenter').addEventListener('click', () => {
    if (controller.recenter()) $('message').textContent = 'Gyro recentering: hold your natural pose. Face mapping is unchanged.';
  });
  globalThis.addEventListener?.('pagehide', () => void controller.disconnect());
  for (const id of ['settingsDialog','newDialog']) $(id).addEventListener('toggle', resume);
  for (const id of ['gameTab','explorerTab']) $(id).addEventListener('click', () => controller.suspend());
  root.addEventListener('visibilitychange', resume);
  controller.setMode('manual');
  return controller;
}
