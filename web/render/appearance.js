// Shared, inexpensive single-pass materials. No postprocessing or extra canvases.
export const appearances = [
  ['jelly', 'Jelly'], ['plastic', 'Solid plastic'], ['matte', 'Matte'],
  ['voxel', 'Voxel'], ['cel', 'Cel shaded'],
];
export const appearanceIndex = value => Math.max(0, appearances.findIndex(([id]) => id === value));
