//! Dependency-free Rust game engine with a small, versioned Wasm ABI.
use crate::engine::{Game, SHAPES, cell};
use crate::mesh;
use std::cell::RefCell;

struct App {
    game: Game,
    snapshot: [u32; 226],
    mesh: Vec<f32>,
    mesh_revision: u32,
    events: Vec<u32>,
    previews: Vec<u32>,
    transfer: [u32; 512],
}
impl App {
    fn new() -> Self {
        Self {
            game: Game::new(1),
            snapshot: [0; 226],
            mesh: vec![],
            mesh_revision: u32::MAX,
            events: vec![],
            previews: vec![],
            transfer: [0; 512],
        }
    }
    fn sync(&mut self) {
        let s = &self.game.state;
        let v = &mut self.snapshot;
        v.fill(0);
        for i in 0..27 {
            v[i] = s.board[i] as u32;
            v[27 + i] = s.ids[i];
        }
        v[166] = s.bandaged as u32;
        v[167] = s.random_cubies as u32;
        v[168] = s.rebuild_mode;
        v[169] = s.rebuilding_mask();
        v[170] = if s.rebuild_ready(&self.game.tables) {
            0
        } else {
            s.rebuild_ids.len() as u32
        };
        v[171] = (0..30)
            .filter(|&m| s.move_allowed(m))
            .fold(0, |mask, m| mask | 1 << m);
        for f in &s.floating {
            if s.rebuild_ids.contains(&f.id) {
                v[172 + f.cell] = f.color as u32;
            }
        }
        for (b, &mask) in s.bands.iter().enumerate() {
            for i in crate::engine::bits(mask) {
                v[199 + i] = b as u32 + 1;
            }
        }
        v[158] = s.gravity_mode;
        v[159] = s.floating_mask();
        v[160] = s.fragment_turns;
        v[161] = s.fragment_enabled as u32;
        v[162] = s.floating.len() as u32;
        v[163] = s.floating.iter().filter(|f| s.board[f.cell] != 0).count() as u32;
        v[164] = s.held as u32;
        v[165] = s.hold_used as u32;
        v[54] = s.active;
        v[55] = s.queue[0] as u32;
        for (i, &p) in s.queue.iter().skip(1).take(6).enumerate() {
            v[56 + i] = p as u32;
        }
        v[62] = s.pieces;
        v[63] = s.clears;
        v[64] = s.score;
        v[65] = s.gravity.map_or(0, |f| f as u32 + 1);
        v[66] = s.over as u32;
        v[67] = self.game.hints();
        v[68] = self.game.history.len() as u32;
        if let Some((f, p, mask)) = s.last_lock {
            v[69] = f.map_or(0, |f| f as u32 + 1);
            v[70] = p as u32;
            v[79] = mask;
        }
        v[71] = s.last_clears.iter().fold(0, |m, &f| m | 1 << f);
        v[72] = self.game.revision;
        v[73] = s.occupied().count_ones() + s.floating.len() as u32;
        v[74] = 4; // ABI version
        v[75] = s.auto_placements;
        v[76] = s.auto_tiers;
        v[77] = s.last_clears.len() as u32;
        v[78] = self.game.pending.iter().fold(0, |m, p| m | 1 << p.face);
        for p in &self.game.pending {
            if v[152 + p.face] == 0 {
                v[152 + p.face] = p.mask;
            }
        }
        for f in 0..6 {
            for i in 0..9 {
                v[80 + f * 9 + i] = cell(f, (i % 3) as i32, (i / 3) as i32) as u32;
            }
        }
        for p in 0..6 {
            v[134 + p] = SHAPES[p]
                .iter()
                .fold(0, |m, xy| m | 1 << (xy[1] * 3 + xy[0]));
            v[140 + p * 2] = self.game.tables.inventory[p].0 as u32;
            v[141 + p * 2] = self.game.tables.inventory[p].1 as u32;
        }
    }
    fn sync_mesh(&mut self) {
        if self.mesh_revision != self.game.revision {
            self.mesh = mesh::build(&self.game.state);
            self.mesh_revision = self.game.revision;
        }
    }
}
thread_local! {static APP:RefCell<App>=RefCell::new(App::new());}
#[unsafe(no_mangle)]
pub extern "C" fn game_init(seed: u32) {
    APP.with_borrow_mut(|a| a.game.reset(seed));
}
#[unsafe(no_mangle)]
pub extern "C" fn game_turn(m: u32) -> u32 {
    APP.with_borrow_mut(|a| a.game.turn(m as usize) as u32)
}
#[unsafe(no_mangle)]
pub extern "C" fn game_undo() -> u32 {
    APP.with_borrow_mut(|a| a.game.undo() as u32)
}
#[unsafe(no_mangle)]
pub extern "C" fn game_choose(face: u32) -> u32 {
    APP.with_borrow_mut(|a| a.game.choose(face as usize) as u32)
}
#[unsafe(no_mangle)]
pub extern "C" fn game_hold() -> u32 {
    APP.with_borrow_mut(|a| a.game.hold() as u32)
}
#[unsafe(no_mangle)]
pub extern "C" fn game_set_fragments(enabled: u32) {
    APP.with_borrow_mut(|a| a.game.set_fragments(enabled != 0));
}
#[unsafe(no_mangle)]
pub extern "C" fn game_set_modes(bandaged: u32, random: u32, rebuild: u32) {
    APP.with_borrow_mut(|a| a.game.set_modes(bandaged != 0, random != 0, rebuild));
}
#[unsafe(no_mangle)]
pub extern "C" fn game_set_early_lock(enabled: u32) {
    APP.with_borrow_mut(|a| a.game.state.early_lock = enabled != 0);
}
#[unsafe(no_mangle)]
pub extern "C" fn game_lock_band(cell: u32) -> u32 {
    APP.with_borrow_mut(|a| a.game.lock_band(cell as usize) as u32)
}
thread_local! { static BAND_MESH: RefCell<Vec<f32>> = const { RefCell::new(Vec::new()) }; }
#[unsafe(no_mangle)]
pub extern "C" fn band_mesh_ptr(mask: u32) -> *const f32 {
    let mut s = crate::engine::State::empty(1);
    for i in 0..27 {
        if mask & (1 << i) != 0 {
            s.board[i] = 1;
            s.ids[i] = 1;
        }
    }
    BAND_MESH.with_borrow_mut(|out| {
        *out = mesh::build(&s);
        for v in out.chunks_exact_mut(9) {
            v[6..9].fill(1.0);
        }
        out.as_ptr()
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn band_mesh_len() -> u32 {
    BAND_MESH.with_borrow(|out| out.len() as u32)
}
#[unsafe(no_mangle)]
pub extern "C" fn game_set_slice_clears(mode: u32) {
    APP.with_borrow_mut(|a| {
        a.game.state.slice_clear_mode = mode.min(2);
        a.game.revision += 1;
    });
}
#[unsafe(no_mangle)]
pub extern "C" fn game_set_gravity(mode: u32) {
    APP.with_borrow_mut(|a| a.game.set_gravity(mode));
}
#[unsafe(no_mangle)]
pub extern "C" fn previews_ptr(m: u32) -> *const u32 {
    APP.with_borrow_mut(|a| {
        a.previews.clear();
        for (mask, piece, source) in a.game.preview(m as usize) {
            a.previews.extend([mask, piece as u32, source]);
        }
        a.previews.as_ptr()
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn previews_len() -> u32 {
    APP.with_borrow(|a| a.previews.len() as u32)
}
/// Event stride: kind, mask, face+1, board[27], ids[27], origins[27].
#[unsafe(no_mangle)]
pub extern "C" fn events_ptr() -> *const u32 {
    APP.with_borrow_mut(|a| {
        a.events.clear();
        for e in &a.game.state.events {
            a.events.extend([e.kind, e.mask, e.face]);
            a.events.extend(e.board.map(u32::from));
            a.events.extend(e.ids);
            a.events.extend(e.origins.map(|i| i as u32));
            a.events.extend([e.float_mask, e.fragment_turns]);
        }
        a.events.as_ptr()
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn events_len() -> u32 {
    APP.with_borrow(|a| a.events.len() as u32)
}
/// Pointer remains valid until the next state_ptr call; consumers should copy it.
#[unsafe(no_mangle)]
pub extern "C" fn state_ptr() -> *const u32 {
    APP.with_borrow_mut(|a| {
        a.sync();
        a.snapshot.as_ptr()
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn state_len() -> u32 {
    226
}
/// Interleaved f32 position / normal / RGB, nine floats per vertex.
#[unsafe(no_mangle)]
pub extern "C" fn mesh_ptr() -> *const f32 {
    APP.with_borrow_mut(|a| {
        a.sync_mesh();
        a.mesh.as_ptr()
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn mesh_len() -> u32 {
    APP.with_borrow(|a| a.mesh.len() as u32)
}

// Fixture hooks are excluded from the distributed build.
#[cfg(feature = "test-api")]
#[unsafe(no_mangle)]
pub extern "C" fn test_cell(i: u32, p: u32, id: u32) {
    APP.with_borrow_mut(|a| {
        a.game.state.board[i as usize] = p as u8;
        a.game.state.ids[i as usize] = id;
        a.game.revision += 1;
    });
}
#[cfg(feature = "test-api")]
#[unsafe(no_mangle)]
pub extern "C" fn test_state(active: u32, piece: u32, gravity: u32) {
    APP.with_borrow_mut(|a| {
        a.game.state.active = active;
        a.game.state.queue[0] = piece as u8;
        a.game.state.gravity = if gravity == 0 {
            None
        } else {
            Some(gravity as usize - 1)
        };
        a.game.state.over = false;
    });
}
#[cfg(feature = "test-api")]
#[unsafe(no_mangle)]
pub extern "C" fn test_spawn() -> u32 {
    APP.with_borrow_mut(|a| {
        a.game.revision += 1;
        a.game.state.spawn(&a.game.tables) as u32
    })
}
#[cfg(feature = "test-api")]
#[unsafe(no_mangle)]
pub extern "C" fn test_clear() -> u32 {
    APP.with_borrow_mut(|a| {
        a.game.revision += 1;
        a.game.state.clear(&a.game.tables)
    })
}
#[cfg(feature = "test-api")]
#[unsafe(no_mangle)]
pub extern "C" fn test_match() -> u32 {
    APP.with_borrow(|a| {
        a.game
            .tables
            .find(
                a.game.state.queue[0] as usize - 1,
                a.game.state.occupied(),
                a.game.state.active,
            )
            .map_or(0, |p| p.mask)
    })
}
#[cfg(feature = "test-api")]
#[unsafe(no_mangle)]
pub extern "C" fn test_rotated(m: u32) -> u32 {
    APP.with_borrow(|a| a.game.tables.rotated(a.game.state.active, m as usize))
}

#[unsafe(no_mangle)]
pub extern "C" fn game_slice_clear_mode() -> u32 {
    APP.with_borrow(|a| a.game.state.slice_clear_mode)
}

#[unsafe(no_mangle)]
pub extern "C" fn game_transfer_ptr() -> *mut u32 {
    APP.with_borrow_mut(|a| a.transfer.as_mut_ptr())
}
#[unsafe(no_mangle)]
pub extern "C" fn game_export() -> u32 {
    APP.with_borrow_mut(|a| {
        let v = a.game.export_state();
        a.transfer[..v.len()].copy_from_slice(&v);
        v.len() as u32
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn game_import(len: u32) -> u32 {
    if len > 512 {
        return 0;
    }
    APP.with_borrow_mut(|a| a.game.import_state(&a.transfer[..len as usize]) as u32)
}
#[unsafe(no_mangle)]
pub extern "C" fn game_set_next(piece: u32) -> u32 {
    APP.with_borrow_mut(|a| a.game.set_next_piece(piece) as u32)
}
#[unsafe(no_mangle)]
pub extern "C" fn game_early_lock() -> u32 {
    APP.with_borrow(|a| a.game.state.early_lock as u32)
}

#[unsafe(no_mangle)]
pub extern "C" fn game_set_gravity_rules(slice_gravity:u32, one_step:u32) {
    APP.with_borrow_mut(|a| {a.game.state.slice_gravity=slice_gravity!=0; a.game.state.gravity_one_step=one_step!=0; a.game.revision+=1;});
}
#[unsafe(no_mangle)]
pub extern "C" fn game_gravity_rules() -> u32 {
    APP.with_borrow(|a| u32::from(a.game.state.slice_gravity) | (u32::from(a.game.state.gravity_one_step)<<1))
}
