export const IDENTITY:number[];
export function turnTransform(move:number,t:number):number[];
export function transformPoint(p:number[],options?:{rotation?:number[],modelScale?:number,offset?:number[]}):number[];
export function composeRotation(a:number[],b?:number[]):number[];
export function movedCell(cell:number,move:number):boolean;
