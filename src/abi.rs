//! Browser command and buffer adapter for the puzzle core.
use crate::abi_layout::{s, e, ABI_VERSION, SNAPSHOT_WORDS, EVENT_WORDS};
use crate::engine::{Game, SHAPES, cell};
use crate::mesh;
use std::cell::RefCell;

struct App {
    game: Game,
    snapshot: [u32; SNAPSHOT_WORDS],
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
            snapshot: [0; SNAPSHOT_WORDS],
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
            v[s::BOARD + i] = s.board[i] as u32;
            v[s::IDS + i] = s.ids[i];
        }
        v[s::BANDAGED] = s.bandaged as u32;
        v[s::RANDOM_CUBIES] = s.random_cubies as u32;
        v[s::REBUILD_MODE] = s.rebuild_mode;
        v[s::REBUILD_MASK] = s.rebuilding_mask();
        v[s::REBUILD_PENDING] = if s.rebuild_ready(&self.game.tables) {
            0
        } else {
            (s.rebuild_ids.len()+s.free_groups.len()) as u32
        };
        v[s::ALLOWED_MOVES] = (0..30)
            .filter(|&m| s.move_allowed(m))
            .fold(0, |mask, m| mask | 1 << m);
        for f in &s.floating {
            if s.rebuild_ids.contains(&f.id) {
                v[s::REBUILD_COLORS + f.cell] = f.color as u32;
            }
        }
        for (b, &mask) in s.bands.iter().enumerate() {
            for i in crate::engine::bits(mask) {
                v[s::BAND_IDS + i] = b as u32 + 1;
            }
        }
        v[s::GRAVITY_MODE] = s.gravity_mode;
        v[s::FLOATING] = s.floating_mask();
        v[s::FRAGMENT_TURNS] = s.fragment_turns;
        v[s::FRAGMENTS_ENABLED] = s.fragment_enabled as u32;
        v[s::FLOATING_COUNT] = s.floating.len() as u32;
        v[s::FLOATING_OVERLAPS] = s.floating.iter().filter(|f| s.board[f.cell] != 0).count() as u32;
        v[s::HELD] = s.held as u32;
        v[s::HOLD_USED] = s.hold_used as u32;
        v[s::ACTIVE] = s.active;
        v[s::PIECE] = s.queue[0] as u32;
        for (i, &p) in s.queue.iter().skip(1).take(6).enumerate() {
            v[s::QUEUE + i] = p as u32;
        }
        v[s::PIECES] = s.pieces;
        v[s::CLEARS] = s.clears;
        v[s::SCORE] = s.score;
        v[s::GRAVITY] = s.gravity.map_or(0, |f| f as u32 + 1);
        v[s::OVER] = s.over as u32;
        v[s::WINNING_MOVES] = self.game.hints();
        v[s::UNDO_COUNT] = self.game.history.len() as u32;
        if let Some((f, p, mask)) = s.last_lock {
            v[s::LAST_FACE] = f.map_or(0, |f| f as u32 + 1);
            v[s::LAST_PIECE] = p as u32;
            v[s::LAST_MASK] = mask;
        }
        v[s::CLEARED_FACES] = s.last_clears.iter().fold(0, |m, &f| m | 1 << f);
        v[s::REVISION] = self.game.revision;
        v[s::OCCUPIED_COUNT] = s.occupied().count_ones() + s.floating.len() as u32;
        v[s::ABI_VERSION] = ABI_VERSION; // ABI version
        v[s::AUTO_PLACEMENTS] = s.auto_placements;
        v[s::AUTO_TIERS] = s.auto_tiers;
        v[s::CLEAR_COUNT] = s.last_clears.len() as u32;
        v[s::PENDING_FACES] = self.game.pending.iter().fold(0, |m, p| m | 1 << p.face);
        for p in &self.game.pending {
            if p.face < 6 && v[s::PENDING_MASKS + p.face] == 0 {
                v[s::PENDING_MASKS + p.face] = p.mask;
            }
        }
        for f in 0..6 {
            for i in 0..9 {
                v[s::FACE_CELLS + f * 9 + i] = cell(f, (i % 3) as i32, (i / 3) as i32) as u32;
            }
        }
        for p in 0..6 {
            v[s::SHAPES + p] = SHAPES[p]
                .iter()
                .fold(0, |m, xy| m | 1 << (xy[1] * 3 + xy[0]));
            v[s::INVENTORY + p * 2] = self.game.tables.inventory[p].0 as u32;
            v[s::INVENTORY + p * 2 + 1] = self.game.tables.inventory[p].1 as u32;
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
pub extern "C" fn band_mesh_ptr(mask: u32) -> *const f32 { band_mesh_styled_ptr(mask, 0) }
#[unsafe(no_mangle)]
pub extern "C" fn band_mesh_styled_ptr(mask: u32, corner_o: u32) -> *const f32 {
    band_mesh_tuned_ptr(mask, corner_o, 0.30, 0.24)
}
#[unsafe(no_mangle)]
pub extern "C" fn band_mesh_tuned_ptr(mask: u32, corner_o: u32, softness: f32, opening: f32) -> *const f32 {
    band_mesh_profiled_ptr(mask,corner_o,softness,opening,2.)
}
#[unsafe(no_mangle)]
pub extern "C" fn band_mesh_profiled_ptr(mask: u32, corner_o: u32, softness: f32, opening: f32, profile: f32) -> *const f32 {
    band_mesh_elbows_ptr(mask,corner_o,softness,opening,profile,1.)
}
#[unsafe(no_mangle)]
pub extern "C" fn band_mesh_elbows_ptr(mask: u32, corner_o: u32, softness: f32, opening: f32, profile: f32, elbow: f32) -> *const f32 {
    band_mesh_sized_ptr(mask,corner_o,softness,opening,profile,elbow,1.)
}
#[unsafe(no_mangle)]
pub extern "C" fn band_mesh_sized_ptr(mask: u32, corner_o: u32, softness: f32, opening: f32, profile: f32, elbow: f32, scale: f32) -> *const f32 {
    let mut s = crate::engine::State::empty(1);
    for i in 0..27 {
        if mask & (1 << i) != 0 {
            s.board[i] = 1;
            s.ids[i] = 1;
        }
    }
    BAND_MESH.with_borrow_mut(|out| {
        *out = mesh::build_sized(&s, corner_o != 0, softness, opening, profile, elbow, scale);
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
            let mut record = [0; EVENT_WORDS];
            record[e::KIND] = e.kind;
            record[e::MASK] = e.mask;
            record[e::FACE] = e.face;
            record[e::BOARD..e::BOARD + e::BOARD_LEN].copy_from_slice(&e.board.map(u32::from));
            record[e::IDS..e::IDS + e::IDS_LEN].copy_from_slice(&e.ids);
            record[e::ORIGINS..e::ORIGINS + e::ORIGINS_LEN].copy_from_slice(&e.origins.map(|i| i as u32));
            record[e::FLOAT_MASK] = e.float_mask;
            record[e::FRAGMENT_TURNS] = e.fragment_turns;
            a.events.extend(record);
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
    SNAPSHOT_WORDS as u32
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

/// Presentation-only physical identity for freed whole-piece cubies. Kept
/// separate from the stable ABI-v4 snapshot and from interchangeable color pools.
// Visual ownership includes independently released partial groups, not only tetracubes.
#[unsafe(no_mangle)]
pub extern "C" fn active_group_at(cell: u32) -> u32 {
    APP.with_borrow(|a| {
        let s=&a.game.state;
        if cell>=27 {return 0;}
        if let Some(index)=s.free_groups.iter().position(|m|m&(1<<cell)!=0) {
            return 0x8000_0000 | (index as u32+1);
        }
        s.floating.iter().find(|f|f.cell==cell as usize).map_or(0,|f|f.id)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn rebuild_id_at(cell: u32) -> u32 {
    APP.with_borrow(|a| {
        let s = &a.game.state;
        s.floating.iter().find(|f| f.cell == cell as usize && s.rebuild_ids.contains(&f.id))
            .map_or(0, |f| f.id)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn game_set_release_rules(trigger:u32,bandaged:u32,scattered:u32,selection:u32) {
    APP.with_borrow_mut(|a|{a.game.set_release_rules(trigger,bandaged!=0,scattered!=0,selection);a.sync();});
}
#[unsafe(no_mangle)]
pub extern "C" fn game_release_rules()->u32 {
    APP.with_borrow(|a| {let s=&a.game.state;s.release_trigger | ((s.release_bandaged as u32)<<2) | ((s.release_scattered as u32)<<3) | (s.release_selection<<4)})
}
#[unsafe(no_mangle)]
pub extern "C" fn game_configure_rules(rules:u32)->u32 {
    APP.with_borrow_mut(|a| {let ok=a.game.configure_rules(rules);a.sync();ok as u32})
}
#[unsafe(no_mangle)]
pub extern "C" fn game_rules()->u32 {APP.with_borrow(|a|a.game.state.rules.unwrap_or(u32::MAX))}
#[unsafe(no_mangle)]
pub extern "C" fn game_debug_piece(held:u32,piece:u32)->u32 {
    APP.with_borrow_mut(|a| {let ok=a.game.debug_piece(held!=0,piece);a.sync();ok as u32})
}

#[unsafe(no_mangle)]
pub extern "C" fn game_piece_pool()->u32 {APP.with_borrow(|a|a.game.state.piece_pool)}
#[unsafe(no_mangle)]
pub extern "C" fn game_set_piece_pool(pool:u32,redeal:u32)->u32 {APP.with_borrow_mut(|a|a.game.set_piece_pool(pool,redeal!=0) as u32)}
#[unsafe(no_mangle)]
pub extern "C" fn game_choice_mask(choice:u32)->u32 {APP.with_borrow(|a|a.game.pending.iter().find(|p|p.face==choice as usize).map_or(0,|p|p.mask))}

#[unsafe(no_mangle)]
pub extern "C" fn game_can_undo()->u32 {APP.with_borrow(|a|a.game.can_undo() as u32)}
#[unsafe(no_mangle)]
pub extern "C" fn group_requirement_at(cell:u32)->u32 {
    APP.with_borrow(|a| {
        let s=&a.game.state;if cell>=27{return 0;}
        let Some(f)=s.floating.iter().find(|f|f.cell==cell as usize) else{return 0;};
        let r=s.rules.unwrap_or(1<<14);
        if r&(1<<14)==0{return 1<<17;}
        if let Some(i)=s.free_groups.iter().position(|m|m&(1<<cell)!=0) {
            if r&(1<<22)==0{return 1<<16;}
            let mask=*s.free_shapes.get(i).unwrap_or(&s.free_groups[i]);
            return match mask.count_ones(){1=>1<<18,2=>1<<19,3=>if crate::engine::State::fragment_shape(mask)==vec![1,1,4]{1<<20}else{1<<21},_=>1<<16};
        }
        if !s.rebuild_ids.contains(&f.id) {return 1<<16;}
        let origin=s.free_origins.get(&f.id).copied().unwrap_or(f.color);
        (1..=9).filter(|&color| (r&(1<<22)==0 || crate::engine::choices(origin).contains(&color)) &&
            (r&(1<<21)==0 || (1..=11).any(|p|s.piece_pool&(1<<(p-1))!=0 && crate::engine::choices(p).contains(&color))))
            .fold(0,|mask,color|mask|1<<(color-1))
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn game_core_option(index:u32)->u32 {APP.with_borrow(|a|a.game.core_options().get(index as usize).copied().unwrap_or(0))}
#[unsafe(no_mangle)]
pub extern "C" fn game_select_core(mask:u32,place:u32)->u32 {APP.with_borrow_mut(|a|a.game.select_core(mask,place!=0) as u32)}
