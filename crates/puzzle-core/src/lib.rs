//! Pure computation shared by the browser adapter and native tools.
//! No browser exports, UI state, filesystem access or rendering context.
pub mod engine;
pub mod pieces;
pub mod mesh;

pub mod game_contract;
