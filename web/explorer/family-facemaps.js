import {createStickerGrid, solidSticker} from '../ui/sticker-grid.js';
import {assemblyKind} from '../render/assembly.js';
import {extraCubieColor} from '../render/extra-colors.js';
import {visualSettings} from '../render/visual-settings.js';
import {detectedColor} from './family-colors.js';
import {detectPieces} from './family-exploration.js';
import {PALETTE, NOTATION, turn} from './model.js';

function stickers(view, cells) {
  const groups = new Map(detectPieces(cells,view.detectionFilters).map(p => [p.id,p.letter]));
  return cells.map((cell,i) => {
    if (!cell) return null;
    const extra = cell.piece < 0, letter = groups.get(cell.piece);
    const kind = assemblyKind(view.assembly,!!letter,extra);
    const retained = view.assembly === 'retained' || (!letter && !extra && kind === 'whole');
    const source = retained && view.initial[cell.assemblyOrigin];
    const key = source ? source.color : view.fixedPieceColors ? cell.color : detectedColor(letter,cell.color);
    const color = extra ? extraCubieColor(source ? cell.assemblyOrigin : i) : PALETTE[key] || PALETTE.d;
    if (kind === 'solids') return solidSticker(extra ? 5 : cell.piece,color,extra,visualSettings);
    return {kind:extra ? 'extra' : 'filled',color};
  });
}

export function createFamilyFacemaps($, coordinates, getCube) {
  const panel = $('familyMapPanel'), button = $('familyFacemaps');
  let render, previousCells, previousMove, previousAppearance, before, after, observer;
  button.onclick = () => {
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-pressed',String(!panel.hidden));
    $('familyExplorePanel').classList.toggle('show-family-maps',!panel.hidden);
    const cube = getCube();
    if (!cube) return;
    if (!panel.hidden) {
      render ||= createStickerGrid($('familyNet'), NOTATION.slice(0,9));
      if (!observer) {
        const toolbar = button.parentElement;
        observer = new ResizeObserver(() => {
          if (toolbar?.offsetHeight) $('familyExplorePanel').style.setProperty('--family-tools-height', toolbar.offsetHeight+'px');
        });
        if (toolbar) observer.observe(toolbar);
      }
      previousCells = null;
      cube.setState(cube.cells,cube.currentAnimation);
    }
    cube.invalidate();
  };
  return (view,cells,animation,appearance) => {
    if (!render || panel.hidden) return;
    const moving = animation?.kind === 'turn';
    if (!moving || cells !== previousCells || previousMove !== animation.move || previousAppearance !== appearance) {
      before = stickers(view,cells);
      after = moving ? stickers(view,turn(cells,animation.move)) : before;
      previousAppearance=appearance; previousCells=cells; previousMove=moving ? animation.move : null;
    }
    render(coordinates,before,after,moving ? animation.t : 0);
  };
}
