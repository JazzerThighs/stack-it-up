# Smartcube controls and appearance implementation plan

Status: all six milestones implemented; physical-cube and visual validation pending.

## 1. Calibrate face identities and the player's natural holding angle

- [x] After a cube connects, begin calibration when the player closes settings
  and the game becomes visible. Do not silently calibrate behind the settings menu.
- [x] Establish which physical faces the player treats as U, F and R. Derive
  the remaining faces consistently and apply that mapping to incoming turns.
- [x] Require the player to manually drag the displayed cube into the same
  orientation as their natural cubing angle while holding the physical cube
  in that pose, then explicitly confirm the alignment.
- [x] Keep this neutral pose independent of the default XYZ orbit-snapping
  pitch, yaw and roll sliders. Those defaults must not dictate the player's grip.
- [x] Store face mapping and gyro alignment as distinct calibration results.
  Suspend gameplay input during calibration; discard calibration gestures and
  turns rather than replaying them when calibration finishes.
- [x] Define reconnect, cancellation and recalibration behavior. Reopening
  ordinary settings during an already calibrated session must not silently
  overwrite the confirmed alignment.

Acceptance: U/F/R turns match the player's chosen faces; gyro motion follows
the manually aligned view without jumping to orbit defaults. Verify both game
views, different grips, disconnect during calibration and reconnect.

Validation so far: simulated connection/calibration tests cover all 24 face
frames, invalid frames, required dragging/gyro data, ignored calibration turns,
remapped moves, reconnect and cancellation. Input tests, type checks and schema
checks pass. The local build is blocked by esbuild ancestor-directory access;
the real-browser runner fails because its GPU process cannot start. Physical
U/F/R direction and neutral-pose checks remain required before acceptance.

## 2. Control animation speed and keep Bluetooth play responsive

- [x] Add a regular-game turn-animation speed slider, using the shared settings
  conventions for authored defaults, persistence and reset.
- [x] During Bluetooth play, accelerate queued turn animations as needed to
  catch up with the physical cube. Consider both pending move count and the
  age of the oldest pending move; return to the selected speed when caught up.
- [x] Preserve smooth visible motion while minimizing input-to-display delay.
  Do not drop or reorder logical turns to shorten the visual queue.
- [x] Preserve rule checks, placement/clear sequencing, undo and final state
  when fast input overlaps animations. Define safe bounds for animation duration.

Acceptance: compare slow turns, rapid bursts and sustained fast sequences.
Measure queue age and input-to-display latency on the physical cube, verify
the final state against the complete ordered move sequence, and check that
manual play still respects its slider.

Implementation notes: the turn-speed slider supports 0.25x–4x and persists
through the controls settings store; its default lives in startup-defaults.js.
Bluetooth animation timing updates every frame from pending count and oldest
pending event age. An idle Bluetooth turn targets at most 90 ms; backlog
catch-up targets 24–90 ms per visual stage, subject to frame/render costs.
Placement, clear and spawn effects in the same Bluetooth command also catch
up, in order. Animation progress is monotonic and the existing Animations
switch still applies. The pre-existing 64-pending-turn overload safeguard
remains; catch-up itself never removes moves.

Validation: input/settings suites, controller tests, synthetic frame-timing
tests, schema checks and type checks pass. Hardware latency measurement and
visual acceptance remain pending. Local bundling and browser testing encounter
the same filesystem/GPU restrictions recorded above.

## 3. Put gyro reset on the main HUD

- [x] Move the gyro reset/recenter control into the main HUD beside the other
  lower buttons so it is accessible during play without opening settings.
- [x] Recenter the gyro against the player's current pose without changing the
  established U/F/R face mapping or puzzle state.
- [x] Provide clear availability when disconnected or awaiting calibration;
  verify the lower-button layout on desktop and mobile.

Implementation: Recenter gyro now sits beside the lower HUD view/undo buttons.
It remains visible but disabled until connected and calibrated, with a tooltip
explaining availability. Recenter feedback appears in the game message area.
The next gyro sample anchors the current view; U/F/R mapping and puzzle state
are unchanged. Tests cover those invariants and unavailable states. The button
uses the existing wrapping/mobile HUD styles; visual desktop/mobile acceptance
remains pending because of the browser GPU restriction.

## 4. Recognize slice and gyro-assisted wide moves

Status: implemented; resumed at the user's request. Physical-cube acceptance pending.

- [x] Detect eligible pairs of physical face turns within a configurable time
  window and interpret/display them as a single slice move where appropriate.
- [x] Expose the pairing window so players can tune it for different cube
  models and their turning style. Define which timestamp source is reliable
  and how to handle missing or batched device timestamps.
- [x] Specify and validate eligible face/direction pairs in the calibrated
  frame, including any whole-cube rotation compensation needed to preserve
  the intended puzzle transformation. Timing proximity alone is insufficient.
- [x] Flush unmatched turns promptly and in order. Keep pairing latency small;
  clear pending pairs on disconnect, calibration or input suspension.
- [x] Apply normal legality and bandaging checks to the resulting move.
- [x] Verify that recognized slices move active centers relative to the placed
  stack through the same engine command as manual slices.
- [x] Combine a single face event with the matching gyro quarter rotation to
  recognize a wide move, including actual center movement. Add a separate
  persisted completion-time control, reset, and zero-to-disable behavior.

Acceptance: verify M/E/S directions, timing boundaries, unrelated fast turns,
batched events, different calibration orientations and disconnect mid-pair.
Compare resulting states, not only the displayed animation.

Implementation: the persisted Slice pairing window in Bluetooth settings is
0-150 ms (0 disables recognition), with an authored 40 ms startup default and
a reset button. Only adjacent opposite-face quarter turns with opposite
notation directions pair. Half turns and unrelated moves preserve ordering.
Device timestamp intervals are preferred; local intervals are a fallback.
Recovered events without usable timestamps and unstamped same-tick batches
are not paired. Monotonic receipt time bounds the wait independently of the
device clock. A timeout flushes an unmatched turn; lifecycle changes clear it.

Each pair submits one ordinary slice command through the existing legality
and bandaging path. After acceptance, a cumulative whole-cube correction
updates subsequent face mapping and gyro output. Rejected commands clear
pending input without applying that correction. Recalibration resets it;
gyro recenter preserves it. Exact labeled-cell tests cover all pair directions,
follow-up turns, repeated pairs and all 24 rigid frames. Integration tests cover
rejection, recenter, suspension, recalibration and disconnect. Hardware timing,
physical M/E/S feel and visual acceptance still require testing with the cube.

Wide extension: a 0-500 ms completion window (authored default 150 ms) matches
the inverse gyro quarter rotation to one face report and submits the opposite
two-layer command. Direction/axis checks allow 20 degrees of orientation error.
Gyro evidence may precede or follow the report, cannot be reused, and is cleared
at lifecycle boundaries. Slice pairs take precedence within their own window.
Ordinary faces wait up to the larger enabled window; recovered face events
cannot correlate with current gyro motion. Real-controller/Wasm tests verify
center relocation relative to a stationary stack for every slice/wide direction,
matching manual moves, and verify that ordinary faces cannot do this. Hardware
wide-turn and gyro-frame acceptance remains pending.

Validation: input and settings suites, generated-schema checks and type checks
pass. The build still fails at esbuild's denied ancestor-directory access;
the agent browser runner cannot start its GPU process. Build and visual checks
must be rerun in the user's normal local environment.

## 5. Make connection instructions product-neutral

- [x] Remove GAN-specific names and instructions from user-facing help, status
  messages and connection/calibration prompts. Use “smartcube” or “cube.”
- [x] Keep device/protocol-specific handling inside the integration layer;
  generic wording must not imply that unsupported devices are supported.

Acceptance: review disconnected, connecting, connected, error and calibration
states for product-neutral wording while retaining useful diagnostics.

Completed: connection help and calibration prompts use cube/smartcube wording.
Actual connected-device names and underlying error diagnostics remain visible.
Protocol-specific code and supported-device behavior are unchanged.

## 6. Group palette controls and color extras by cubie type

- [x] Keep each Color Palette dropdown at the top of its appearance controls.
- [x] Place its individual piece color swatches directly underneath it.
- [x] Add separate swatches for Extra Corners, Extra Edges, Extra Centers and
  Extra Core in the corresponding appearance controls.
- [x] Replace the previous extra-piece color hierarchy with selection based
  solely on the individual extra cubie's type:

  | Extra cubie type | Default color |
  | --- | --- |
  | Corner | White |
  | Edge | White |
  | Center | Black |
  | Core | Grey |

- [x] Apply the type-based colors consistently across relevant cube views and
  render styles. Keep extra-cubie classification separate from gameplay state
  and the identity of retained tetrominoes or fragments.
- [x] Define migration of saved extra-color preferences so the obsolete
  hierarchy cannot override the new type-based policy. Keep defaults editable
  in startup-defaults.js and preserve normal preference/reset behavior.

Acceptance: verify all four extra types, per-view overrides, palette selection,
save/reload/reset and both combined/split game views. Tests should use authored
defaults rather than pinning changeable colors to literal values.

Implementation: each view page now places its nine piece swatches and four
extra-type swatches immediately under the palette dropdown, outside nested
settings pages. Extra colors are schema-owned, inherited from startup-defaults.js
and saved independently in each view profile. Older profiles without these
fields inherit the new defaults. Legacy w/k/l/d extra markers remain readable
in puzzle data but no longer choose rendered extra colors. Presets change
piece colors only; Reset this view resets extra colors too.

Validation: settings tests, type checks, all-27-cell classification tests,
per-view persistence/reset, UI structure checks, and synchronous worker-owner
color checks pass. Full worker integration requires the missing built Wasm;
local bundling is blocked by esbuild directory access. Browser visual checks
remain pending.

## Implementation and verification

Implement calibration first, then animation timing and HUD recentering, then
palette controls and extra-cubie colors. Slice recognition is now implemented. Product-neutral copy and palette work can be completed
independently. Update the current architecture and Bluetooth documentation as
behavior ships; check off tasks only after implementation and validation.

Use the existing input, game-controller, settings and rendering owners described
in [ARCHITECTURE.md](ARCHITECTURE.md). Run focused tests for each changed boundary,
type checks and generated-settings checks as applicable, then build and run the
real-browser gate for UI changes. Physical-cube testing is required for face
calibration, gyro alignment, slice timing and perceived latency; mocks cannot
certify those results.
