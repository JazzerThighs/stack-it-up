# Implementation plan: navigation, cube controls, and facemaps

Milestones 1 through 4 are complete. Physical Bluetooth hardware verification remains open.

## 1. Shared top bar

- [x] Keep the QR icon, title, screen selector, Settings, Bluetooth, and Reset Graphics inline on one row on mobile and larger screens.

### Website title and QR code logo

- [x] Keep **Stack It Up** as the website title.
- [x] Always show an icon to the left of the title, including on mobile.
- [x] Replace the current 2D cube logo with a **QR Code icon**.
- [x] Tapping or clicking the icon opens a panel with both QR codes, their destination labels, and clickable website links:
  - App: https://jazzerthighs.github.io/stack-it-up/
  - GitHub repository: https://github.com/JazzerThighs/stack-it-up
- [x] Remove the cube icon from the Explorer's **Choose Packing** button entirely.

### Screen selector

- [x] Add a button that expands downward into a list of screens:

| Screen in the dropdown | Button label when selected |
| --- | --- |
| Stack It Up Game | Game |
| Tetracube Packing Family Explorer | Explorer |
| A to B Solver | Solver |

- [x] **Explorer is the default screen.**
- [x] **A to B Solver** is the existing two-packing practice view.

### Settings button

- [x] Use the gear emoji (⚙️) for the Settings button in the shared top bar.
- [x] This is the only location where a Settings button appears.
- [x] Remove duplicate Settings buttons and their reserved space from every individual view.
- [x] Adjust the game applet layout so it no longer encompasses a separate settings bar.

### Bluetooth button and connection page

- [x] Add a **Bluetooth logo button** to the shared top bar.
- [x] Open a dedicated Bluetooth connection page from this button.
- [x] Keep connection and calibration concerns separate from the Settings menu.
- [x] A connected physical cube must be able to control all applicable views, as specified in section 2.

### Graphics Reset button

- [x] Keep **Graphics Reset** in the shared top bar.
- [x] Preserve its current behavior.

### Milestone 1 implementation and validation

The QR panel uses the two PNGs supplied in `docs/`. Each shipped copy in `web/images/` matches its source byte for byte. Both PNGs decoded to the exact URLs above.

A headless Chrome layout check measured all six header elements in both Game and Explorer layouts at nine viewport widths from 320 to 1440 CSS pixels. All elements stayed on one row, in order, within the viewport. This check exercised the header HTML and styles independently of WebGL.

The settings suite, navigation and Bluetooth controller tests, and Game and Explorer smoke tests passed. The smoke tests cover preserving the puzzle during Graphics Reset. Physical-cube routing to Explorer and Solver belongs to milestone 2.

- [x] Run the full WebGL browser suite successfully. Headless Chrome passed the suite in an isolated local test profile with its browser sandbox disabled. The standard launch still encounters a GPU process failure on this machine.

## 2. Bluetooth control across views

- [x] Route calibrated physical face turns to Family Explorer and Solver Start through their normal turn and history handling. Opposite-face turns remain separate, and double turns apply two quarter turns.
- [x] Keep Game slice and wide-turn recognition available in Game. Discard pending Explorer turns when their destination changes.
- [x] Route gyro orientation to the Explorer and Solver cubes. Both Solver cubes follow the calibrated grip. The Bluetooth panel has an optional gyro autocompensation setting for Explorer and Solver, off by default.

| View | Physical face turns | Gyroscope behavior |
| --- | --- | --- |
| Game | Preserve the current game control behavior | Preserve the current game behavior |
| Family Explorer | Support face turns; do not interpret input as slice or wide turns | Gyroscopic autocompensation is off by default |
| Solver: Start Cube | Same turn behavior as Family Explorer; no slice or wide turns | Same behavior as Family Explorer |
| Solver: Target Cube | Gyroscope-only by default; face turns become available when selected using the Solver toggle | Support gyro control |

### Solver turn destination

- [x] When Start and Target are both visible, provide a button to toggle which cube receives physical face turns.
- [x] This applies on desktop and in split views.
- [x] Clearly indicate whether turns currently control **Start Cube** or **Target Cube**.
- [x] Route a physical face turn to the selected cube only.

### Calibration reset controls

- [x] Every view must have **UFR Reset** and **Gyro Reset** buttons.
- [x] Keep these as separate actions: face-identity recalibration and gyro-alignment recalibration, respectively.
- [x] Keep the connection workflow on the dedicated Bluetooth page while making these reset actions available in each view.

Desktop and 390-pixel mobile Chrome runs with a simulated Bluetooth device verified calibration by dragging the cube, exclusive Start/Target turns, gyro motion on both Solver cubes, separate resets, and switching the same connection to Family Explorer. Verification on physical hardware remains open in section 7.

## 3. Game controls and facemap layout

- [x] Add a **Facemaps** button to the game's bottom pool of buttons.
- [x] Make the facemaps wrap to fit within their reserved portion of the screen, including on small screens.
- [x] Rename **Split Cubes** to **Split Stack**.
- [x] Preserve the existing split behavior behind the renamed button.

The Game toolbar and Settings checkbox control the same facemap layout. Closing it restores the previous combined or split view. Chrome verified all nine map grids stay inside the panel and above the toolbar at 320, 390, 621, and 1280 CSS pixels.

## 4. Family Explorer controls and facemaps

- [x] Move **Lock Shapes** and **Lock Colors** into the Family Explorer's bottom pool of buttons.
- [x] They must be the **first** and **second** buttons, respectively.
- [x] Add facemaps for the Family Explorer cube.
- [x] Use the shared facemap appearance and motion rules below.

The **Facemaps** button follows the two locks. It opens six face maps and the M, E, and S slices beside the cube on desktop and below it on phones. Game and Explorer share the sticker renderer. Chrome verified all nine Explorer maps fit above the toolbar at 320, 390, and 1280 CSS pixels. The Game tests exercised partial, reversed, cancelled, and completed turns for all 30 moves.

## 5. Shared facemap appearance

Apply these rules wherever facemaps are available. Determine the appearance from the piece occupying the cell and the representation selected for that cube view.

| Cell representation | Facemap sticker appearance |
| --- | --- |
| Whole tetracube / retained piece | Fill with the occupying piece's color |
| Individual cubie | Fill with the occupying piece's color |
| Extra cubie | No fill; dotted outline, creating a ghostlike piece |
| Platonic solid | Show the number of faces of the displayed solid inside the sticker; color the number to match the solid |
| Ball | Replace the square sticker with a circle, slightly smaller in diameter than a normal sticker's width; color the circle to match the ball |
| Empty cell | Do not render a sticker |

- [x] Extra cubies shown as cubies use the ghostlike outline treatment. When represented as balls or solids, use the corresponding ball or solid treatment.
- [x] Solid numbers must describe the shape actually being displayed.
- [x] Empty stickers disappear visually without collapsing the facemap's spatial cell positions.
- [x] Use the owning view's colors and composition settings so that its facemaps match its 3D cube.

### Dragged-move animation

- [x] Preserve the existing meter-filling transition used while the player drags a move.
- [x] Apply the transition to the **entire sticker representation**, including its contents and outline.
- [x] The meter level must control replacement of the old sticker with the new sticker as one coordinated transition.
- [x] Filled squares, ghost outlines, numbers, circles, and empty cells must all follow the same motion-transition behavior.
- [x] Do not update just the background color while leaving a number, outline, or circle unchanged.

The Game and Family Explorer clip the outgoing and incoming sticker at the same meter boundary, including the overlap outline. Family Explorer detects pieces in the proposed end position so a turn that breaks or completes a piece previews its new appearance before release.

## 6. Implementation sequence

- [x] 1. Refactor the shared top bar: QR panel, screen selector, sole Settings entry, Bluetooth entry, and Graphics Reset.
- [x] 2. Separate the Bluetooth page and route physical-cube input across Game, Explorer, and Solver, including the Start/Target toggle and per-view resets.
- [x] 3. Update bottom control pools: Game Facemaps, Split Stack, and Explorer's ordered Lock Shapes / Lock Colors buttons.
- [x] 4. Share facemap rendering between Game and Explorer, including wrapping and view-specific composition/color interpretation.
- [x] 5. Apply the complete-sticker meter transition to every facemap representation.
- [ ] 6. Validate desktop and mobile layouts, application navigation, rendering, and physical-cube behavior.

## 7. Acceptance checks

- [x] The QR icon remains left of the title on mobile and desktop; both QR codes decode to the specified URLs, and both anchors use those destinations.
- [x] Choose Packing has no cube icon.
- [x] The selector opens downward, lists all three screens, shows the correct short label, and defaults to Explorer.
- [x] Settings appears only in the top bar, with no redundant settings bar or reserved space inside a view.
- [x] Bluetooth opens its own connection page; Graphics Reset retains its current behavior.
- [x] Physical face turns control the game as before and the Explorer/Start cube without slice or wide-turn interpretation.
- [x] Explorer and Start default to gyroscopic autocompensation off.
- [x] Target defaults to gyro-only control; the Solver toggle sends face turns exclusively to the selected Start or Target cube.
- [x] Every view exposes working UFR Reset and Gyro Reset actions.
- [x] The game's bottom controls include Facemaps and use the label Split Stack.
- [x] Facemaps wrap within their reserved area on small screens.
- [x] Explorer's first two bottom controls are Lock Shapes and Lock Colors.
- [x] Explorer facemaps reflect its current cube.
- [x] Whole pieces, individual cubies, extras, solids, balls, and empty cells follow the shared appearance rules.
- [x] Dragging forward, reversing, cancelling, and completing a move transitions the entire sticker representation consistently with the meter level.
- [ ] Test physical-cube routing and calibration resets with a real connected cube, in addition to automated checks.
