export const CubeStack:{xyz:(i:number)=>number[],moves:Array<[string,number,number|string,number]>};
export const moveLabels:string[];
export function notationMove(move:number,labels?:string[]):number;
export function formatMove(move:number,prime?:string,labels?:string[]):string;
export const explorerMoveLabels:string[];
export function flipCameraFrame(matrix:number[]):number[];
