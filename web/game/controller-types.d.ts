import type {EngineTransport,EngineSnapshot,EngineEvent} from '../engine/types.js';
export type Command = 'turn'|'hold'|'choose'|'lock'|'core'|'debug'|'replay';
export interface Details {move?:number;fromT?:number;}
export interface Transaction extends Details {before:EngineSnapshot;after:EngineSnapshot;trace:EngineEvent[];}
export interface Effect {rejected?:(details?:Details)=>void;present?:(transaction:Transaction)=>void|Promise<void>;settled?:(transaction:Transaction)=>void;complete?:(transaction:Transaction)=>void;locked?:()=>void;preview?:()=>void;}
export interface ControllerOptions {engine:()=>EngineTransport|null|undefined;state:()=>EngineSnapshot;isBusy:()=>boolean;isStarting:()=>boolean;isLockMode:()=>boolean;isTurnLocked?:()=>boolean;setBusy:(value:boolean)=>void;copyState:(state:EngineSnapshot)=>EngineSnapshot;effects:Record<Command,Effect>&{undo?:()=>void};}
export interface ReplayStep {method:'game_turn'|'game_choose'|'game_lock_band'|'game_place_core';arg:number;}
