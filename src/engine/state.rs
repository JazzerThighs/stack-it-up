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
    pub piece_pool: u32,
    pub free_origins: std::collections::BTreeMap<u32,u8>,
    /// Versioned gameplay configuration; None preserves imported legacy rules.
    pub rules: Option<u32>,
    pub gravity_plane: Option<usize>,
    pub floating: Vec<Fragment>,
    pub bandaged: bool,
    pub early_lock: bool,
    pub random_cubies: bool,
    pub rebuild_mode: u32,
    pub rebuild_ids: Vec<u32>,
    /// Random stack-group perk: 0 off, 1 per cleared plane, 2 per new placement turn.
    pub release_trigger: u32,
    pub release_bandaged: bool,
    pub release_scattered: bool,
    /// 0 equal groups, 1 cubie-weighted, 2 one random board cell, 3 largest, 4 smallest.
    pub release_selection: u32,
    pub release_started: Option<u32>,
    pub free_groups: Vec<u32>,
    pub free_shapes: Vec<u32>,
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
            piece_pool: 63,
            free_origins: std::collections::BTreeMap::new(),
            rules: None,
            gravity_plane: None,
            floating: vec![],
            bandaged: false,
            early_lock: true,
            random_cubies: false,
            rebuild_mode: 0,
            rebuild_ids: vec![],
            release_trigger: 0,
            release_bandaged: true,
            release_scattered: false,
            release_selection: 0,
            release_started: None,
            free_groups: vec![],
            free_shapes: vec![],
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
    pub(super) fn refill(&mut self) {
        while self.queue.len() < 7 {
            let mut bag:Vec<u8> = (1..=11).filter(|id|self.piece_pool & (1<<(id-1)) != 0).collect();
            for i in (1..bag.len()).rev() {
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
        if self.active&(1<<13)!=0 {
            return t.fallback[self.queue[0] as usize-1].iter()
                .filter(|(mask,tier)|*tier==2 && mask&occupied==0 && mask&self.active==*mask)
                .enumerate().map(|(i,&(mask,_))|Placement{face:6+i,mask,required:mask}).collect();
        }
        t.placements[self.queue[0] as usize - 1]
            .iter()
            .filter(|p| p.mask & occupied == 0 && p.mask & self.active == p.mask)
            .copied()
            .enumerate().map(|(i,mut p)|{if (7..=9).contains(&self.queue[0]) {p.face=6+i;}p})
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
        let fits=t.available(piece,occupied);
        if fits.is_empty(){return SpawnDecision::TopOut;}
        // A unique geometric fit is forced, including a fit through the core.
        if fits.len()==1 && can_finish && fits[0].0&blocked==0 {
            return SpawnDecision::Automatic{mask:fits[0].0,tier:fits[0].1};
        }
        if fits.len()==1 && !can_finish && !self.floating_blocked() && fits[0].0&blocked==0 && fits[0].1<2 {
            self.active=fits[0].0;return SpawnDecision::Active;
        }
        if t.placements[piece].iter().any(|p|p.mask&occupied==0) {
            // Prefer empty slots. If that cannot preserve a useful inventory,
            // overlap the stack rather than spawn an unreachable center pairing.
            for allow_overlap in [false,true] {
                let (mut chosen, mut best, mut count) = (0, 0, 0);
                for &(active,score) in &t.spawns[piece] {
                    if count>0 && score<best {break;}
                    if active&self.floating_mask()!=0 {continue;}
                    if !allow_overlap && active&blocked!=0 {continue;}
                    if t.placements[piece].iter().any(|p|p.mask&blocked==0 && p.mask&active==p.mask){continue;}
                    best=score;count+=1;
                    if self.range(count)==0 {chosen=active;}
                }
                if count>0 {self.active=chosen;return SpawnDecision::Active;}
            }
        }
        // Multiple core fits are a decision, not an arbitrary automatic lock.
        // A core marker enables explicit orientation selection. Start at an
        // overlapping orientation when one exists; choosing previews never locks.
        let core=fits.iter().filter(|(_,tier)|*tier==2).collect::<Vec<_>>();
        if !core.is_empty() && !fits.iter().any(|(_,tier)|*tier<2) {
            self.active=t.fallback[piece].iter().filter(|(_,tier)|*tier==2)
                .max_by_key(|(mask,_)|(mask&blocked).count_ones()).unwrap().0;
            if !adjacent_centers(self.active) {
                let centers=(0..27).filter(|&i|kind(i)==1).fold(0,|m,i|m|1<<i);
                let count=(self.active&centers).count_ones() as usize;
                let adjacent=combinations(centers,count).into_iter().filter(|&m|adjacent_centers(m))
                    .max_by_key(|m|(m&blocked).count_ones()).unwrap();
                self.active=(self.active&!centers)|adjacent;
            }
            return SpawnDecision::Active;
        }
        if !can_finish && !self.floating_blocked() {
            if let Some(&(mask,_))=fits.iter().find(|(mask,_)|mask&blocked==0){self.active=mask;return SpawnDecision::Active;}
        }
        if can_finish {
            if let Some(&(mask,tier))=fits.iter().find(|(mask,_)|mask&blocked==0){return SpawnDecision::Automatic{mask,tier};}
        }
        SpawnDecision::TopOut
    }
    pub fn lock_mask(&mut self, mask: u32) -> u8 {self.lock_mask_on(mask,None)}
    pub fn lock_mask_on(&mut self, mask:u32,face:Option<usize>)->u8 {
        let piece = self.queue.pop_front().unwrap();
        self.hold_used = false;
        self.bands.clear();
        self.free_groups.clear();self.free_shapes.clear();
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
        if piece>=10 {self.free_origins.insert(self.pieces+1,piece);}
        let color=queue_color_on(piece,mask,face);
        for i in bits(mask) {
            self.board[i] = color;
            self.ids[i] = self.pieces + 1;
        }
        self.pieces += 1;
        self.free_origins.retain(|id,_|self.ids.contains(id));
        if self.rules.is_some_and(|r| (r >> 6) & 3 == 3) { self.gravity = Some(self.range(6) as usize); }
        self.score += 100;
        self.active = 0;
        self.record(1, mask, 0, std::array::from_fn(|i| i));
        color
    }
    /// Resolve forced locks and clears until the player gets an unfinished spawn.
    /// No artificial chain limit: every automatic piece consumes the real queue.
    pub fn spawn(&mut self, t: &Tables) -> bool {
        self.auto_placements = 0;
        self.auto_tiers = 0;
        let mut all_clears = std::mem::take(&mut self.last_clears);
        loop {
            if self.rules.is_some_and(|r| r & (1<<9) != 0 && (r>>16)&3 == 1) && self.release_started != Some(self.pieces) {
                self.release_started = Some(self.pieces);
                self.release_configured(1, t);
            }
            if self.rules.is_none() && self.release_trigger == 2 && self.release_started != Some(self.pieces) {
                self.release_started = Some(self.pieces);
                self.release_random_groups(1);
                self.refresh_bands();
            }
            match self.spawn_decision(t) {
                SpawnDecision::Active => {
                    self.last_clears = all_clears;
                    if self.rules.is_none() && self.gravity_mode != 2 {
                        self.gravity = None;
                    }
                    return true;
                }
                SpawnDecision::TopOut => {
                    self.over = true;
                    self.last_clears = all_clears;
                    if self.rules.is_none() && self.gravity_mode != 2 {
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
