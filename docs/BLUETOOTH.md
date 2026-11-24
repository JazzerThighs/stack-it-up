# Smartcube game controls

Build with `npm ci --ignore-scripts` and `node tools/build.mjs`, then serve with
`node tools/serve.mjs`. Use Chrome or Edge on localhost or HTTPS with Bluetooth
available. In Game Settings > Controls select Bluetooth, wake your cube,
and click Connect. Pairing always requires a user gesture; loading a saved game
never connects a device. The selector is a live session control and starts in
Manual on every page load.

If Connect fails immediately without a device picker, open the localhost URL
directly in standalone Chrome or Edge. Check the site's Bluetooth permissions
and Windows Bluetooth switch. The status preserves the browser's error name,
message and connection stage; `NotFoundError` does not prove that you cancelled
the picker. After failure, an optional adapter availability check adds a note
if the browser reports Bluetooth unavailable. A positive availability result
does not prove the radio is powered on or that the cube can connect.

If automatic address detection fails, enter the cube's Bluetooth MAC address
(AA:BB:CC:DD:EE:FF) and retry. The library may cache verified addresses locally.
The MAC address is used after device selection, not as a discovery filter.
If the picker does not list the cube, disconnect it from phone apps, wake it,
and enable Show all Bluetooth devices before clicking Connect. This bypasses
name/manufacturer filters; select the cube, not another nearby device. If it
still does not appear, compare the same localhost page in Chrome or Edge to
isolate browser-specific discovery issues.
Close settings holding the cube in a comfortable neutral pose. The first gyro
sample anchors the current game camera; Recenter gyro anchors it again. Both
the active-cube and stack views follow the same orientation, including roll.

Physical U/D/F/B/R/L clockwise and counterclockwise turns request the matching
regular game moves through the calibrated face mapping, adjusted by recognized slices as described below. Ordinary gyro rotation does not relabel faces; manual
wide-turn preferences do not change the mapping. The physical sticker state
is not imported or reset. Manual controls remain available for hold, choices,
undo and other commands. Turns rejected by game rules clear pending input.
Turns received during animation are serialized (at most 64 queued); input is
ignored while the game is hidden or a settings/new-game dialog is open.
Switching to Manual or disconnecting clears pending input. A committed game
turn finishes its animation even if the device disconnects.

`web/input/bluetooth-cube.js` owns mapping, calibration and connection lifetime;
`web/ui/bluetooth-controls.js` owns pairing UI. Commands use the existing game
controller and gyro uses the shared game camera callback. The build bundles
[poliva/smartcube-web-bluetooth](https://github.com/poliva/smartcube-web-bluetooth)
at commit `2077416d6c828ec926dee424cf1bbfe4c0f25a47` from its TypeScript source,
including dependencies, into a local lazy-loaded module. No runtime CDN is used.
The dependency's MIT license is copied alongside the bundle.

Run `node tests/bluetooth-cube.mjs`, `npm run test:input`, build, and run
`npm run test:browser`. Automated tests use simulated device events. Physical
pairing, firmware compatibility and gyro direction still require physical-cube testing:
check all six faces and their inverses, rapid turns, yaw/pitch/roll in both
views, recenter, disconnect/reconnect, and switching back to Manual.

## Animation timing

Turn animation speed (beside Animations in game settings) controls manual
turns from 0.25x to 4x. Reset turn speed restores the authored startup default.
Bluetooth commands use shorter visual stages and speed up further when moves
wait in the queue. Timing reacts each frame, including during an existing turn;
placement/clear effects remain ordered and also accelerate to clear the backlog.
No moves are discarded for catch-up. Rendering costs and display refresh still
limit actual latency, and the existing overload safeguard remains in place.

## Recenter during play

Use Recenter gyro beside the lower HUD view/undo buttons while holding your
natural pose. The next orientation sample anchors the current displayed view;
face mapping and puzzle state stay unchanged. The button is disabled until a
cube is connected and calibrated. Use Calibrate cube in settings to change
U/F/R identities instead.

## Slice recognition

In Game Settings > Controls > Input, select Bluetooth and tune Slice pairing
window (0-150 ms). The authored default is 40 ms; 0 disables recognition and
removes the pairing wait. Reset slice timing restores the startup default.
This preference is saved locally. Larger values tolerate slower paired turns
but delay unmatched turns and may combine intentional outer-layer sequences.

Only two consecutive quarter turns on opposite faces, with opposite notation
directions, can pair. They submit one M/E/S command (or inverse), subject to
the same rules and bandaging checks as a manual slice. Double turns, same-face
turns and unrelated axes do not pair. The code derives direction from the
game's coordinate tables, including its historical R/L naming.

Two such outer turns equal an inverse middle-layer turn plus a whole-cube
rotation. Accepted pairs accumulate that rotation in the virtual-to-device
frame: subsequent face turns are remapped and gyro output is compensated.
Recenter preserves the correction; recalibration resets it. This preserves
the labeled cubie transformation instead of merely relabeling two animations.
Rejected slices clear waiting input and do not change the correction.

Cube timestamps are used for intervals when both are finite and nondecreasing.
This distinguishes close turns from widely separated moves in one Bluetooth
batch. Otherwise positive local timestamp/receipt intervals are used; recovered
events with missing timing and unstamped same-tick batches cannot pair.
A local monotonic timer always bounds how long an unmatched move waits. At the
exact boundary a pair is possible only if its event arrives before the timeout
flush. No device time is subtracted from the local monotonic clock.

Disconnect, input suspension and recalibration discard any waiting partner.
Physical testing should check both directions of M/E/S, later ordinary face
turns, gyro alignment, fast independent outer turns, and the smallest usable
window for the cube. An eligible face pair commits a slice as soon as the second report arrives.
Gyro evidence helps recover the starting grip even if the wrist began moving
before the first report. Missing or off-axis gyro samples still allow a slice.

Wide-turn zones are relative to a recent measured grip. The expected endpoint
is one signed quarter turn from that grip about the reported face axis. The
**Gesture angle tolerance** slider sets the endpoint tolerance from 1 to 45 degrees (default 20). It is independent of the 24 calibrated autocompensation zones.

With smoothing enabled, **Slice and wide turn return tightness** controls how
quickly the view settles after recognition (1x to 8x, default 2x). This return
follows the shortest arc and discards momentum from the gesture. Ordinary
gyro tracking has its own **Regular gyro tightness** (1x to 8x, default 1x).
It scales the response to your grip within the configured speed and acceleration limits.

## Camera alignment across views

Game, Family Explorer and both Solver cubes use the same calibrated grip and
carry forward the face mapping from accepted game slices and wide turns.
Packing geometry uses the opposite local X and Z axes. Its camera applies a
half turn about Y so each named face appears in the same camera position as
in Game. The Solver turn selector chooses which cube receives moves while
both follow the grip. Packing autocompensation controls whether a resting grip
in those views can refine the shared drift correction.

## Wide turns and center movement

Recognized slices call the same engine M/E/S commands as the manual controls.
They move active centers relative to the fixed placed stack. Wide turns likewise
call the actual two-layer commands, including their middle-layer centers.

Wide turn completion window is a separate saved preference in Bluetooth
settings: 0-500 ms, authored default 150 ms, with a reset button. Zero disables
wide detection. Perform a two-layer quarter turn while holding the opposite
outer layer still. The sensor reports that opposite outer face relative to
the moving core; gyro supplies the matching core rotation. Recognition requires
the inverse spatial quarter rotation about the reported face's axis, within
the configured gesture angle tolerance of the expected orientation. Wrong direction, unrelated axes and
small wrist movements do not qualify. Whole-cube motion alone never submits
a game move.

The window bounds gyro gesture completion and its proximity to the face event,
using monotonic receipt time. Gyro may complete before or after the face report.
Recovered face events with null local timestamps cannot be matched to current
gyro samples. Recognized motion is consumed once. An eligible two-face slice
pair takes precedence, so the slice window is reserved before committing a
wide turn. An unmatched face waits up to the larger enabled window, or flushes
when an unrelated turn arrives. Larger windows increase ordinary input latency.
The timing controls govern recognition, not animation playback speed.

After admission, the same cumulative correction used by slices compensates
gyro and later face mapping. Rejected commands apply no correction and clear
waiting gestures. Suspension, disconnect, calibration and recenter discard
uncommitted gesture evidence. Ordinary regripping plus a coincidentally matching
face turn is observationally identical to a wide turn; reduce the window or
disable detection if that is unwanted.

`tests/wide-turns.mjs` checks directions, timing, slice precedence and all 24
frames, then drives the Bluetooth controller through the real game controller
and compiled Wasm engine. It verifies that slices and wide moves relocate an
active center exactly as manual commands do while leaving stack cells fixed;
all regular face commands leave the center in place. Physical cube and visual
validation remain required, particularly gyro accuracy and useful timing.
