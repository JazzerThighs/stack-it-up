use super::*;
use std::collections::VecDeque;
#[derive(Clone, Debug, PartialEq)]
pub struct AnimationEvent {
    pub kind: u32, // 1 inflate, 2 deflate, 3 gravity step
    pub mask: u32,
    pub face: u32,
    pub board: [u8; 27],
    pub ids: [u32; 27],
    pub origins: [usize; 27],
    pub float_mask: u32,
    pub fragment_turns: u32,
}
#[derive(Clone, Debug, PartialEq)]
pub struct Fragment {
    pub cell: usize,
    pub color: u8,
    pub id: u32,
}
#[derive(Clone, Debug, PartialEq)]
pub struct State {
    pub floating: Vec<Fragment>,
    pub bandaged: bool,
    pub early_lock: bool,
    pub random_cubies: bool,
    pub rebuild_mode: u32,
    pub rebuild_ids: Vec<u32>,
    pub bands: Vec<u32>,
    pub fragment_enabled: bool,
    pub fragment_turns: u32,
    pub gravity_mode: u32,
    pub slice_gravity: bool,
    pub gravity_one_step: bool,
    /// 0 legacy faces only, 1 full slices, 2 surface-only slices.
    pub slice_clear_mode: u32,
    pub held: u8,
    pub last_lock: Option<(Option<usize>, u8, u32)>,
    pub hold_used: bool,
    pub board: [u8; 27],
    pub ids: [u32; 27],
    pub active: u32,
    pub queue: VecDeque<u8>,
    pub pieces: u32,
    pub clears: u32,
    pub score: u32,
    pub gravity: Option<usize>,
    pub last_clears: Vec<usize>,
    pub over: bool,
    pub rng: u32,
    pub auto_placements: u32,
    pub auto_tiers: u32,
    pub events: Vec<AnimationEvent>,
    pub recording: bool,
}
impl State {
    pub fn empty(seed: u32) -> Self {
        Self {
            floating: vec![],
            bandaged: false,
            early_lock: true,
            random_cubies: false,
            rebuild_mode: 0,
            rebuild_ids: vec![],
            bands: vec![],
            fragment_enabled: true,
            fragment_turns: 0,
            gravity_mode: 0,
            slice_gravity: true,
            gravity_one_step: false,
            slice_clear_mode: 1,
            held: 0,
            last_lock: None,
            hold_used: false,
            board: [0; 27],
            ids: [0; 27],
            active: 0,
            queue: VecDeque::new(),
            pieces: 0,
            clears: 0,
            score: 0,
            gravity: None,
            last_clears: vec![],
            over: false,
            rng: seed.max(1),
            auto_placements: 0,
            auto_tiers: 0,
            events: vec![],
            recording: false,
        }
    }
    pub(super) fn record(&mut self, kind: u32, mask: u32, face: u32, origins: [usize; 27]) {
        if self.recording {
            self.events.push(AnimationEvent {
                kind,
                mask,
                face,
                board: self.board,
                ids: self.ids,
                origins,
                float_mask: self.floating_mask(),
                fragment_turns: self.fragment_turns,
            });
        }
    }
    pub fn occupied(&self) -> u32 {
        (0..27)
            .filter(|&i| self.board[i] != 0)
            .fold(0, |m, i| m | 1 << i)
    }
    fn random(&mut self) -> u32 {
        let mut x = self.rng;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.rng = x;
        x
    }
    pub(super) fn range(&mut self, n: u32) -> u32 {
        // Rejection avoids modulo bias; xorshift's output range is 1..=u32::MAX.
        let limit = u32::MAX - u32::MAX % n;
        loop {
            let x = self.random();
            if x <= limit {
                return (x - 1) % n;
            }
        }
    }
    fn refill(&mut self) {
        while self.queue.len() < 7 {
            let mut bag = [1, 2, 3, 4, 5, 6];
            for i in (1..6).rev() {
                let j = self.range((i + 1) as u32) as usize;
                bag.swap(i, j);
            }
            self.queue.extend(bag);
        }
    }
    pub fn floating_mask(&self) -> u32 {
        self.floating.iter().fold(0, |m, f| m | 1 << f.cell)
    }
    pub fn floating_blocked(&self) -> bool {
        self.floating_mask() & self.occupied() != 0
    }
    pub fn matches(&self, t: &Tables) -> Vec<Placement> {
        if self.floating_blocked() || !self.rebuild_ready(t) {
            return vec![];
        }
        let occupied = self.occupied() | self.floating_mask();
        t.placements[self.queue[0] as usize - 1]
            .iter()
            .filter(|p| p.mask & occupied == 0 && p.mask & self.active == p.mask)
            .copied()
            .collect()
    }
    pub fn release_fragments(&mut self) {
        if !self.fragment_enabled || self.fragment_turns == 0 {
            return;
        }
        let mut counts = std::collections::HashMap::new();
        for i in 0..27 {
            if self.board[i] != 0 {
                *counts.entry(self.ids[i]).or_insert(0) += 1;
            }
        }
        for f in &self.floating {
            *counts.entry(f.id).or_insert(0) += 1;
        }
        let mut mask = 0;
        for i in 0..27 {
            if self.board[i] != 0 && counts[&self.ids[i]] < 4 {
                self.floating.push(Fragment {
                    cell: i,
                    color: self.board[i],
                    id: self.ids[i],
                });
                mask |= 1 << i;
                self.board[i] = 0;
                self.ids[i] = 0;
            }
        }
        if mask != 0 {
            self.record(5, mask, 0, std::array::from_fn(|i| i));
        }
    }
    pub fn spawn_decision(&mut self, t: &Tables) -> SpawnDecision {
        self.refill();
        self.active = 0;
        self.over = false;
        let piece = self.queue[0] as usize - 1;
        let occupied = self.occupied();
        let blocked = occupied | self.floating_mask();
        let can_finish = !self.floating_blocked() && self.rebuild_ready(t);
        if t.placements[piece].iter().any(|p| p.mask & occupied == 0) {
            let (mut chosen, mut best, mut count) = (0, 0, 0);
            for &(active, score) in &t.spawns[piece] {
                if count > 0 && score < best {
                    break;
                }
                if active & blocked != 0 {
                    continue;
                }
                self.active = active;
                if can_finish
                    && t.placements[piece]
                        .iter()
                        .any(|p| p.mask & blocked == 0 && p.mask & active == p.mask)
                {
                    continue;
                }
                best = score;
                count += 1;
                if self.range(count) == 0 {
                    chosen = active;
                }
            }
            self.active = chosen;
            if count > 0 {
                return SpawnDecision::Active;
            }
        }
        // A complete current piece can wait in a face gap while another
        // released piece is reconstructed. Do not top out just because the
        // larger unfinished inventory cannot fit alongside released groups.
        if !can_finish
            && !self.floating_blocked()
            && let Some(p) = t.placements[piece].iter().find(|p| p.mask & blocked == 0)
        {
            self.active = p.mask;
            return SpawnDecision::Active;
        }
        if !self.floating_blocked() && self.rebuild_ready(t) {
            if let Some(p) = t.placements[piece].iter().find(|p| p.mask & blocked == 0) {
                return SpawnDecision::Automatic {
                    mask: p.mask,
                    tier: 0,
                };
            }
            for &(mask, tier) in &t.fallback[piece] {
                if mask & blocked == 0 {
                    return SpawnDecision::Automatic { mask, tier };
                }
            }
        }
        SpawnDecision::TopOut
    }
    pub fn lock_mask(&mut self, mask: u32) -> u8 {
        let piece = self.queue.pop_front().unwrap();
        self.hold_used = false;
        self.bands.clear();
        let fragments = std::mem::take(&mut self.floating);
        let mut mask_f = 0;
        for f in &fragments {
            self.board[f.cell] = f.color;
            self.ids[f.cell] = f.id;
            mask_f |= 1 << f.cell;
        }
        self.fragment_turns = self.fragment_turns.saturating_sub(1);
        if mask_f != 0 {
            self.record(4, mask_f, 0, std::array::from_fn(|i| i));
        }
        for i in bits(mask) {
            self.board[i] = piece;
            self.ids[i] = self.pieces + 1;
        }
        self.pieces += 1;
        self.score += 100;
        self.active = 0;
        self.record(1, mask, 0, std::array::from_fn(|i| i));
        piece
    }
    /// Resolve forced locks and clears until the player gets an unfinished spawn.
    /// No artificial chain limit: every automatic piece consumes the real queue.
    pub fn spawn(&mut self, t: &Tables) -> bool {
        self.auto_placements = 0;
        self.auto_tiers = 0;
        let mut all_clears = std::mem::take(&mut self.last_clears);
        loop {
            match self.spawn_decision(t) {
                SpawnDecision::Active => {
                    self.last_clears = all_clears;
                    if self.gravity_mode != 2 {
                        self.gravity = None;
                    }
                    return true;
                }
                SpawnDecision::TopOut => {
                    self.over = true;
                    self.last_clears = all_clears;
                    if self.gravity_mode != 2 {
                        self.gravity = None;
                    }
                    return false;
                }
                SpawnDecision::Automatic { mask, tier } => {
                    self.finish_rebuilds(t);
                    let piece = self.lock_mask(mask);
                    let face = if tier == 0 {
                        t.placements[piece as usize - 1]
                            .iter()
                            .find(|p| p.mask == mask)
                            .map(|p| p.face)
                    } else {
                        None
                    };
                    self.last_lock = Some((face, piece, mask));
                    self.auto_placements += 1;
                    self.auto_tiers |= 1 << tier;
                    self.clear(t);
                    all_clears.append(&mut self.last_clears);
                }
            }
        }
    }
}
