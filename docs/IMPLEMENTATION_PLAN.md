# Smartcube issues and implementation plan

Status: reported issues awaiting implementation and physical-cube validation.

## 1. Guided calibration and independent HUD resets

### Found issues

- The HUD's Recenter gyro button appears to do nothing.
- Dragging the displayed cube into alignment with the smartcube is not reliably available.
- Connection calibration is useful, but requires too much manual interaction.

### Required behavior

- [x] Replace the current calibration interaction with four mandatory steps, in order:
  1. Perform U, then U'.
  2. Perform F, then F'.
  3. Perform R, then R'.
  4. Edit the neutral orientation by dragging, then confirm and save it.
- [x] Automatically advance through the face-recording steps as each turn and its inverse are completed. Keep calibration turns out of gameplay.
- [x] Before the dragging step, automatically orient the displayed cube with F facing the camera directly and U facing the ceiling directly.
- [x] Let the player drag from that initial orientation to their desired natural holding angle, then confirm it as the saved neutral position. Ensure gyro updates do not prevent this editing.
- [x] Replace Recenter gyro in the main HUD with two separate buttons:
  - **UFR Reset:** redo face-identity calibration independently of the saved neutral gyro alignment.
  - **Gyro Reset:** redo the neutral gyro alignment independently of the established U/F/R face identities.
- [x] Keep the two calibration aspects separate so the player can repair either without unnecessarily repeating the other.

Implemented: clockwise/inverse validation advances U, F and R automatically; inconsistent face assignments are rejected. Full calibration then rotates F toward the camera and U up, suspends gyro following, and requires a manual drag plus fresh gyro data before confirmation. UFR Reset omits the angle editor and keeps the saved neutral angle. Gyro Reset opens only the angle editor, retaining the face mapping and slice/wide correction. Calibration consumes physical turns without sending game commands. Reset requests during an active turn wait for the player to retry after it finishes.

Validation: automated controller coverage includes all 24 face frames, inverse validation, canonical orientation and both independent resets. Physical-cube verification remains pending.

Acceptance: complete the four-step connection flow on desktop and mobile; verify that dragging is usable, confirmation saves the chosen neutral angle, and each HUD reset changes only its intended calibration aspect.

## 2. Make turn-animation speed controls visible on mobile

### Found issue

The expected turning-animation speed sliders cannot be found in the mobile app. They may be hidden, inaccessible, or absent from the visible settings routes.

### Required behavior

- [x] Locate the existing animation-speed controls and determine why they are not discoverable on mobile.
- [x] Make the turning-animation speed sliders visible and reachable in mobile settings, with clear labels and readable current values.
- [x] Distinguish animation playback speed from slice-pairing and wide-turn recognition timing.
- [x] Verify that adjustments actually affect turning animations and retain the intended saved-preference and reset behavior.

Acceptance: find and operate the animation-speed controls on a mobile viewport without relying on desktop-only navigation or hidden controls.

Implementation: the turn-speed slider was nested inside Rendering style. It and the animation toggle now live on the dedicated Controls and camera > Turn animations page, independent of visual style and Bluetooth mode. Playback speed remains distinct from gyro smoothing and gesture timing. Mobile browser coverage checks visibility, live values, persistence and reset; physical-device validation remains pending.

## 3. Correct gyro drift near the player's saved neutral pose

### Found issue

Slice and wide-turn recognition can commit the game's move before the player has aligned the physical layers exactly. When the player subsequently straightens those layers, the gyro linkage may interpret that correction as whole-cube rotation. This can misalign the displayed active cubies and stack with the intended physical orientation. Small discrepancies can accumulate across multiple moves.

### Proposed behavior

Use the player's saved neutral pose and their tendency to return to a natural grip to gradually correct the gyro linkage.

- [x] Define a configurable leniency zone around the player's saved neutral pose, with a default angular tolerance of **10 degrees** and a slider to adjust it.
- [x] Detect moments of low gyro angular velocity while the player is within that neutral zone.
- [x] During those moments, smoothly correct the linkage between physical gyro orientation and the displayed game cube, guiding the view back toward the saved neutral angle.
- [x] Make this correction cooperate with the player's natural tendency to hold their cube so that it matches the on-screen view.
- [x] After a slice or wide turn, let the player align the physical layers and hold the cube near neutral briefly to settle the gyro discrepancy.
- [x] Do not require a neutral pause after every move. Allow the player to continue turning, then correct accumulated drift when they return to a steady neutral grip.
- [x] Allow the same compensation during ordinary face-turn play, rather than limiting it to slices and wide turns.
- [x] Keep intentional whole-cube motion responsive; compensation should not pull the view toward neutral while the player is deliberately rotating outside the zone or moving too quickly.
- [x] Preserve actual game state and move semantics: correction adjusts orientation linkage, not the logical slice, wide turn, center positions, or placed stack.

### Implemented design

- The confirmed calibration view defines the session's natural holding angle. Correction accepts all 24 rigid cube orientations at that angle, choosing the nearest target without changing U/F/R mapping. Only explicit gyro calibration requires the reference face arrangement. The Bluetooth settings slider accepts 0-30 degrees (0 disables further correction while preserving the current alignment).
- Neutral proximity is measured after discrete slice/wide compensation and accumulated drift alignment. An error outside the configured zone of every one of the 24 targets is not automatically pulled back; bring the view into the zone or explicitly recenter.
- Raw sensor angular velocity must remain at or below the configurable motion cutoff (default 6 degrees/second, range 1-90, authored in `startup-defaults.js`) for a configurable delay (default 125 ms). Correction speed is configurable (default 2.5x): both the base 450 ms convergence time and 8 degrees/second cap scale together, giving a default 180 ms time constant and 20 degrees/second cap. The tolerance, delay and speed sliders all have authored values in `web/ui/startup-defaults.js`. Gaps above 250 ms restart settling.
- A separate presentation offset preserves the discrete frame used for move mapping. Raw gyro samples still drive wide recognition. Ordinary turns do not inhibit compensation.
- Suspension and recognized slice/wide frame changes restart settling without discarding the alignment. Calibration, disconnect, and explicit recenter clear compensation. Recenter establishes a fresh neutral using the current view and next sensor sample. UFR Reset remaps faces while retaining the saved neutral angle; Gyro Reset edits only the gyro alignment and preserves the current logical face correction.
- Automated checks cover settling, convergence, motion and zone gates, sample-rate variation, saved settings, reset/suspension, and post-slice game-command isolation. Physical-cube feel and both-view hardware validation remain pending.

Acceptance: test incomplete physical alignment followed by correction for slices and wide turns, repeated drift accumulation, ordinary turns near neutral, deliberate whole-cube rotations, and return to neutral. Verify both game views and check the feel on the actual smartcube.

## 4. Smooth incoming gyro orientation updates

### Found issue

The displayed cube currently jumps directly to each newly reported gyro orientation. The lack of interpolation makes rotation visibly jerky.

### Required behavior

- [x] Interpolate displayed orientation between gyro updates instead of rendering each message as an immediate jump.
- [x] Enable gyro interpolation by default.
- [x] Expose the interpolation control in the same Bluetooth settings page as Connect.
- [x] Coordinate interpolation with neutral-pose compensation so both remain smooth and do not fight each other or introduce excessive lag.
- [x] Handle connection, calibration, resets, and input suspension without blending from a stale orientation.

Acceptance: compare interpolation on and off using slow rotation, fast rotation, and uneven gyro update intervals. Verify smoothness, acceptable responsiveness, and clean behavior across both HUD resets.


Implemented: `web/input/gyro-smoothing.js` runs a critically damped angular spring with continuous velocity and bounded acceleration on animation frames. It follows the latest compensated target without replaying a backlog of sensor packets. This provides eased starts/stops/reversals beyond simple frame interpolation; it does not use literal Bezier segments that restart on every sample.

Bluetooth settings include Smooth gyro motion (default on), Gyro easing time (180 ms), Maximum gyro rotation speed (180 degrees/s), and Maximum gyro acceleration (1200 degrees/s squared). All values are authored in `startup-defaults.js` and saved as preferences. Higher limits reduce lag; lower limits favor readability. Raw samples still feed gesture recognition and neutral compensation. Suspension, disconnect, calibration and recenter discard stale animation state. Independent HUD resets now use the guided calibration flow in issue #1.

Automated checks cover frame continuation without packets, speed/acceleration bounds, frame rates, direction reversals, exact rest, quaternion sign equivalence, lifecycle cancellation and direct-follow mode. Physical-cube feel/latency validation remains pending.
