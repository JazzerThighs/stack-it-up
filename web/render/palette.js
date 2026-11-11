import {startupDefaults} from '../ui/startup-defaults.js';
// Piece identity remains separate from display color, including white choices.
import {pieces} from '../engine/pieces.js';
// Stable IDs are shared with the native engine.
export const pieceNames = ['', ...pieces.map(p=>p.letter)];
export const defaultColors = ['#000000', ...pieces.map(p=>startupDefaults.palette[p.letter]??p.color)];
if(defaultColors.some(color=>!/^#[0-9a-f]{6}$/i.test(color)))throw Error('Startup palette colors must be six-digit hex colors.');
export const colors = defaultColors.slice();
const listeners = new Set();
try {
  const saved = JSON.parse(globalThis.localStorage?.getItem('stack-it-up.palette') || 'null');
  if (Array.isArray(saved)) for (let i=1;i<=pieces.length;i++)
    if (/^#[0-9a-f]{6}$/i.test(saved[i])) colors[i] = saved[i];
} catch { /* Storage may be disabled or contain an older value. */ }
export const packingPalette = {w:'#f0f3f7',k:'#202833',l:'#68717d',d:'#68717d'};
for (const [id,key] of [...'ymobgr'].entries())
  Object.defineProperty(packingPalette,key,{enumerable:true,get:()=>colors[id+1]});
for (const [id,key] of [[7,'B'],[8,'D'],[9,'F']]) Object.defineProperty(packingPalette,key,{enumerable:true,get:()=>colors[id]});
export function subscribePalette(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function publish() {
  try { globalThis.localStorage?.setItem('stack-it-up.palette',JSON.stringify(colors)); } catch {}
  for (const fn of listeners) fn();
}
export function setPieceColor(id, value) {
  if (!Number.isInteger(id) || id<1 || id>pieces.length || !/^#[0-9a-f]{6}$/i.test(value)) return false;
  colors[id]=value.toLowerCase(); publish(); return true;
}
export function resetPalette() { colors.splice(0, colors.length, ...defaultColors); publish(); }
