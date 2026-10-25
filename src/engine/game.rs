use super::*;
use std::collections::VecDeque;
pub struct Game {
    pub tables: Tables,
    pub state: State,
    pub history: VecDeque<State>,
    pub lock: Option<(usize, u8)>,
    pub revision: u32,
    pub pending: Vec<Placement>,
    pub lock_mask: u32,
}
impl Game {
    pub fn new(seed: u32) -> Self {
        let tables = Tables::new();
        let mut state = State::empty(seed);
        state.spawn(&tables);
        state.recording = true;
        Self {
            tables,
            state,
            history: VecDeque::new(),
            lock: None,
            revision: 0,
            pending: vec![],
            lock_mask: 0,
        }
    }
    pub fn reset(&mut self, seed: u32) {
        self.state = State::empty(seed);
        self.state.spawn(&self.tables);
        self.state.recording = true;
        self.pending.clear();
        self.lock_mask = 0;
        self.history.clear();
        self.lock = None;
        self.revision += 1;
    }
    pub fn set_fragments(&mut self, enabled: bool) {
        self.state.fragment_enabled = enabled;
        if !enabled {
            self.state.fragment_turns = if self.state.floating.is_empty() { 0 } else { 1 };
        }
        self.revision += 1;
    }
    pub fn set_modes(&mut self, bandaged: bool, random: bool, rebuild: u32) {
        self.state.bandaged = bandaged;
        self.state.random_cubies = random;
        self.state.rebuild_mode = rebuild.min(2);
        self.state.refresh_bands();
        self.revision += 1;
    }
    pub fn set_gravity(&mut self, mode: u32) {
        self.state.gravity_mode = mode.min(2);
        self.state.gravity = if mode == 2 {
            self.state.gravity.or(Some(1))
        } else {
            None
        };
        self.revision += 1;
    }
    fn moved_state(&self, m: usize, recording: bool) -> State {
        let mut s = self.state.clone();
        s.recording = recording;
        s.events.clear();
        s.last_lock = None;
        s.last_clears.clear();
        s.auto_placements = 0;
        s.auto_tiers = 0;
        s.active = self.tables.rotated(s.active, m);
        for band in &mut s.bands {
            *band = self.tables.rotated(*band, m);
        }
        for f in &mut s.floating {
            f.cell = self.tables.permutations[m][f.cell];
        }
        if s.gravity_mode == 2 {
            let old = s.gravity.unwrap_or(1);
            s.gravity = Some(if s.range(2) == 1 {
                (old + 1 + s.range(5) as usize) % 6
            } else {
                old
            });
            s.clear(&self.tables);
        }
        s
    }
    pub fn preview(&self, m: usize) -> Vec<(u32, u8, u32)> {
        if m >= 30 || self.state.over || !self.pending.is_empty() || !self.state.move_allowed(m) {
            return vec![];
        }
        let mut s = self.moved_state(m, false);
        let source = self.state.active;
        if s.gravity_mode == 2 && s.active & s.floating_mask() != 0 {
            s.recording = true;
            s.spawn(&self.tables);
            return s
                .events
                .iter()
                .find(|e| e.kind == 1)
                .map(|e| {
                    vec![(
                        e.mask,
                        self.state.queue[0],
                        bits(source)
                            .filter(|&i| e.mask & (1 << self.tables.permutations[m][i]) != 0)
                            .fold(0, |mask, i| mask | 1 << i),
                    )]
                })
                .unwrap_or_default();
        }
        s.matches(&self.tables)
            .iter()
            .map(|p| {
                (
                    p.mask,
                    self.state.queue[0],
                    bits(source)
                        .filter(|&i| p.mask & (1 << self.tables.permutations[m][i]) != 0)
                        .fold(0, |mask, i| mask | 1 << i),
                )
            })
            .collect()
    }
    pub fn hints(&self) -> u32 {
        (0..30)
            .filter(|&m| !self.preview(m).is_empty())
            .fold(0, |mask, m| mask | 1 << m)
    }
    fn save_history(&mut self) {
        let mut previous = self.state.clone();
        previous.events.clear();
        self.history.push_back(previous);
        if self.history.len() > 100 {
            self.history.pop_front();
        }
    }
    /// Settle one rigid white group without completing the current piece.
    /// Clearing and perk accounting remain part of the normal placement cycle.
    pub fn lock_band(&mut self, cell: usize) -> bool {
        if cell >= 27
            || !self.state.early_lock
            || !self.state.bandaged
            || self.state.over
            || !self.pending.is_empty()
        {
            return false;
        }
        let Some(mask) = self
            .state
            .bands
            .iter()
            .copied()
            .find(|m| m & (1 << cell) != 0)
        else {
            return false;
        };
        if mask & self.state.occupied() != 0 {
            return false;
        }
        self.save_history();
        let s = &mut self.state;
        s.events.clear();
        s.last_lock = None;
        s.last_clears.clear();
        s.auto_placements = 0;
        s.auto_tiers = 0;
        for f in &s.floating {
            if mask & (1 << f.cell) != 0 {
                s.board[f.cell] = f.color;
                s.ids[f.cell] = f.id;
            }
        }
        s.floating.retain(|f| mask & (1 << f.cell) == 0);
        s.bands.retain(|band| band & mask == 0);
        s.record(4, mask, 0, std::array::from_fn(|i| i));
        self.lock = None;
        self.lock_mask = 0;
        self.revision += 1;
        true
    }
    pub fn hold(&mut self) -> bool {
        if self.state.over || !self.pending.is_empty() || self.state.hold_used {
            return false;
        }
        self.save_history();
        let s = &mut self.state;
        let current = s.queue.pop_front().unwrap();
        if s.held != 0 {
            s.queue.push_front(s.held);
        }
        s.held = current;
        s.hold_used = true;
        s.last_lock = None;
        s.events.clear();
        s.last_clears.clear();
        self.lock = None;
        self.lock_mask = 0;
        s.spawn(&self.tables);
        self.revision += 1;
        true
    }
    pub fn turn(&mut self, m: usize) -> bool {
        if m >= 30 || self.state.over || !self.pending.is_empty() || !self.state.move_allowed(m) {
            return false;
        }
        self.save_history();
        self.lock = None;
        self.lock_mask = 0;
        self.state = self.moved_state(m, true);
        if self.state.gravity_mode == 2 && self.state.active & self.state.floating_mask() != 0 {
            self.state.spawn(&self.tables);
            self.revision += 1;
            return true;
        }
        self.pending = self.state.matches(&self.tables);
        let faces = self.pending.iter().fold(0u32, |mask, p| mask | 1 << p.face);
        if faces.count_ones() == 1 {
            self.finish_choice(faces.trailing_zeros() as usize);
        }
        self.revision += 1;
        true
    }
    fn finish_choice(&mut self, face: usize) -> bool {
        let Some(hit) = self.pending.iter().find(|p| p.face == face).copied() else {
            return false;
        };
        self.pending.clear();
        self.state.finish_rebuilds(&self.tables);
        let piece = self.state.lock_mask(hit.mask);
        self.state.last_lock = Some((Some(hit.face), piece, hit.mask));
        self.state.clear(&self.tables);
        self.state.spawn(&self.tables);
        self.lock = Some((hit.face, piece));
        self.lock_mask = hit.mask;
        true
    }
    pub fn choose(&mut self, face: usize) -> bool {
        if !self.pending.iter().any(|p| p.face == face) {
            return false;
        }
        self.state.events.clear();
        self.finish_choice(face);
        self.revision += 1;
        true
    }
    pub fn undo(&mut self) -> bool {
        if let Some(s) = self.history.pop_back() {
            self.state = s;
            self.pending.clear();
            self.lock_mask = 0;
            self.lock = None;
            self.revision += 1;
            true
        } else {
            false
        }
    }
}
