import {S} from '../engine/snapshot.js';
import {faceLabels, rgb} from '../render/geometry.js';
import {solidColor} from '../render/identity-solids.js';

export const mapLabels = [...faceLabels, 'M', 'E', 'S'];
export function faceMapCell(state, map, cell, labels = mapLabels) {
  const explorerFront = labels[2] === 'B';
  if (explorerFront && (map < 2 || map === 7)) cell = 8 - cell;
  if (map < 6) return state[S.FACE_CELLS + map * 9 + cell];
  const [face, offset] = [labels[4] === 'L' ? [4,9] : [5,-9], [1,3], explorerFront ? [3,-1] : [2,1]][map - 6];
  return state[S.FACE_CELLS + face * 9 + cell] + offset;
}

export function solidSticker(slot, hex, extra, settings) {
  const channels = extra ? rgb(hex) : solidColor(slot, rgb(hex), settings.solidGray, settings);
  const color = 'rgb(' + channels.map(v => Math.round(v * 255)).join(',') + ')';
  const faces = [4,6,8,12,20,0][slot] ?? (slot === 6 ? 6 : 2 * (slot - 2));
  return {kind: faces ? 'number' : 'ball', color, text: faces ? String(faces) : ''};
}

function paint(layer, sticker) {
  const kind = sticker?.kind || 'empty', color = sticker?.color || '', text = sticker?.text || '';
  const overlap = sticker?.overlap ? ' map-overlap' : '';
  const key = kind + color + text + overlap;
  if (layer.dataset.sticker === key) return;
  layer.dataset.sticker = key;
  layer.className = 'map-layer map-' + kind + overlap;
  layer.style.color = color;
  layer.textContent = text;
}

export function createStickerGrid(host, labels = mapLabels) {
  const rows = labels.map(label => {
    const group = document.createElement('div'), heading = document.createElement('span'), grid = document.createElement('div');
    heading.className = 'face-label';
    heading.textContent = label;
    const sliceTitle = {M:'Middle slice viewed from L', E:'Equatorial slice viewed from D', S:'Standing slice viewed from F'}[label];
    if (sliceTitle) heading.title = sliceTitle;
    grid.className = 'face-grid';
    const cells = Array.from({length:9}, () => {
      const cell = document.createElement('i');
      cell.append(document.createElement('span'), document.createElement('span'));
      grid.append(cell);
      return cell;
    });
    group.append(heading, grid);
    host.append(group);
    return cells;
  });
  let previousBefore, previousAfter, previousIncoming;
  return (coordinates, before, after = before, t = 0) => {
    const boundary = (1 - Math.max(0, Math.min(1,t))) * 100 + '%';
    host.style.setProperty('--map-boundary', boundary);
    const incoming = t >= 0.5;
    if (previousBefore === before && previousAfter === after && previousIncoming === incoming) return;
    previousBefore = before;
    previousAfter = after;
    previousIncoming = incoming;
    for (let f=0; f<rows.length; f++) rows[f].forEach((cell,c) => {
      const i=faceMapCell(coordinates,f,c,labels);
      paint(cell.children[0],before[i]);
      paint(cell.children[1],after[i]);
      cell.title = labels[f]+' '+(c+1)+' · '+((incoming ? after[i] : before[i])?.kind || 'empty');
    });
  };
}
