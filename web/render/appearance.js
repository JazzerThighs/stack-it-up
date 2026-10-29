export const appearances = [
  ['jelly', 'Jelly'], ['dither', 'Dithered'], ['matte', 'Matte'],
  ['voxel', 'Voxel'], ['cel', 'Cel shaded'], ['ascii', 'ASCII'],
];
export const appearanceIndex = value => Math.max(0, appearances.findIndex(([id]) => id === value));
