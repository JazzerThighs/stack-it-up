/** Geometry parameters are explicit at the transport boundary, not global settings. */
export interface MeshOptions {
  bevel: number;
  opening: number;
  profile: number;
  elbows: number;
  scale?: number;
}
export interface SnapshotMetadata {
  stackShapes?: (ShapeCell|null)[];
  canUndo: boolean;
  groupRequirements: Uint32Array;
  gameplayRules: number;
  rebuildIds: Uint32Array;
}
export type EngineSnapshot = Uint32Array & SnapshotMetadata;
export interface EngineEvent {
  stackShapes?: (ShapeCell|null)[];
  kind: number;
  mask: number;
  face: number;
  board: Uint32Array;
  ids: Uint32Array;
  origins: Uint32Array;
  floatMask: number;
  fragmentTurns: number;
}
export interface PlacementPreview {
  mask: number;
  piece: number;
  sourceMask: number;
}
/** Inferred from the checked implementation so command signatures have one source. */
export type EngineTransport = ReturnType<typeof import('./transport.js').adaptTransport>;

export interface ShapeCell {source:{mask:number};origin:number;rotation:number[];}
export interface ShapeState {stack:(ShapeCell|null)[];floating:(ShapeCell|null)[];}

export type PresentationSnapshot = EngineSnapshot & {solidRotations?:number[][]};
