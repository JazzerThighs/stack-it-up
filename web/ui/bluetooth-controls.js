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
    for(const id of ['bluetoothUfrReset','bluetoothGyroReset'])$(id).disabled=!connected||current.calibration!=='ready';
    $('bluetoothCalibrate').disabled = !connected;
    $('bluetoothStatus').textContent = message;
    $('cubeCalibration').hidden = current.calibration !== 'calibrating';
    $('cubeCalibrationStatus').textContent = message;
    $('calibrationSteps').textContent = current.calibrationKind==='gyro' ? 'Gyro Reset: adjust neutral angle'
      : current.calibrationKind==='ufr' ? 'UFR Reset: U / U′, F / F′, R / R′'
      : '1. U / U′   2. F / F′   3. R / R′   4. Neutral angle';
    $('calibrationRoll').disabled=current.calibrationStep!==3;
    $('calibrationConfirm').hidden=current.calibrationStep!==3;
    $('calibrationConfirm').disabled = !current.dragged || current.calibrationStep!==3;

  };
  const controller = createBluetoothCube({...options,
    sliceWindow: () => controlSettings.bluetoothSliceWindow,
    smoothing: () => controlSettings.bluetoothGyroSmoothing,
    smoothingResponse: () => controlSettings.bluetoothGyroResponse,
    smoothingSpeed: () => controlSettings.bluetoothGyroSpeed,
    smoothingAcceleration: () => controlSettings.bluetoothGyroAcceleration,
    neutralCutoff: () => controlSettings.bluetoothNeutralCutoff,
    neutralDelay: () => controlSettings.bluetoothNeutralDelay,
    neutralSpeed: () => controlSettings.bluetoothNeutralSpeed,
    neutralTolerance: () => controlSettings.bluetoothNeutralTolerance,
    wideWindow: () => controlSettings.bluetoothWideWindow,
    availability: () => globalThis.navigator.bluetooth.getAvailability?.(),
    connect: onStatus => library.connectSmartCube({onStatus,
      deviceSelection: $('bluetoothShowAll').checked ? 'any' : 'filtered',
      macAddressProvider:async () => {
      const value = $('bluetoothMac').value.trim();
      return value || null;
    }}),
    status: state => {
      current = state; refresh();
      if (state.calibration === 'pending') queueMicrotask(() => controller.beginCalibration());
    },
  });
  $('calibrationConfirm').addEventListener('click', () => controller.confirmCalibration());
  $('calibrationCancel').addEventListener('click', () => {
    $('gameInputSource').value = 'manual'; controller.setMode('manual');
  });
  // Capture calibration drags before normal turn/orbit handlers. No snapping or
  // inertia is applied, and both game views receive exactly the same pose.
  let drag;
  const consume = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  root.addEventListener('pointerdown', e => {
    if (!controller.calibrating || !options.active() || !e.target.closest?.('#gamePage canvas')) return;
    consume(e);
    if(!controller.adjustingNeutral)return; drag = {id:e.pointerId,x:e.clientX,y:e.clientY,target:e.target};
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
  $('bluetoothUfrReset').addEventListener('click', () => controller.resetUfr());
  $('bluetoothGyroReset').addEventListener('click', () => controller.resetGyro());
  globalThis.addEventListener?.('pagehide', () => void controller.disconnect());
  for (const id of ['settingsDialog','newDialog']) $(id).addEventListener('toggle', resume);
  for (const id of ['gameTab','explorerTab']) $(id).addEventListener('click', () => controller.suspend());
  root.addEventListener('visibilitychange', resume);
  controller.setMode('manual');
  return controller;
}
