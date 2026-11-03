//! Unified gameplay rules. The packed word is shared with the UI and state transport v4.
use super::*;
impl State {
    pub fn valid_rules(r: u32) -> bool {
        r >> 25 == 0
            && (r & (7<<21) == 0 || r & (1<<23) != 0)
            && r & 30 != 0
            && (r & (1 << 9) == 0 || r & (15 << 10) != 0)
            && (r >> 16) & 3 < 3
    }
    pub fn release_configured(&mut self, count: u32, t: &Tables) {
        let Some(r) = self.rules else {
            return;
        };
        if r & (1 << 9) == 0 {
            return;
        }
        let all = (r >> 16) & 3 == 2;
        let mut candidates: Vec<_> = self
            .groups()
            .into_iter()
            .filter(|g| {
                let n = g.mask.count_ones();
                (1..=4).contains(&n)
                    && r & (1 << (9 + n)) != 0
                    && (n != 4
                        || t.tetracubes.contains(&g.mask)
                        || (0..6).any(|p| {
                            t.placements[p].iter().any(|p| p.mask == g.mask)
                                || t.fallback[p].iter().any(|&(m, _)| m == g.mask)
                        }))
            })
            .collect();
        let attempts = if all { candidates.len() as u32 } else { count };
        for _ in 0..attempts {
            if candidates.is_empty() {
                break;
            }
            let index = if all {
                0
            } else {
                let masks: Vec<_> = candidates.iter().map(|g| g.mask).collect();
                let old = self.release_selection;
                self.release_selection = match (r >> 18) & 3 {
                    0 => 0,
                    1 => 2,
                    2 => 3,
                    _ => 4,
                };
                let selected = self.select_release(&masks);
                self.release_selection = old;
                let Some(i) = selected else {
                    continue;
                };
                i
            };
            let g = candidates.remove(index);
            if g.mask.count_ones() == 4 {
                if self.shape_rules() {
                    let old=self.board[g.mask.trailing_zeros() as usize];
                    let color=std::iter::once(old).chain(1..=9).find(|&c|
                        crate::pieces::PIECES[c as usize-1].placements.contains(&g.mask)).unwrap_or(old);
                    for i in bits(g.mask) {self.board[i]=color;}
                }
                self.rebuild_ids.push(g.id);
            } else {
                self.add_free_group(g.mask);
            }
            self.free_mask(g.mask);
        }
        self.bands.clear();
    }
    pub fn configured_planes(&self, t: &Tables) -> Vec<usize> {
        let r = self.rules.unwrap();
        let occupied = self.occupied();
        CLEAR_ORDER
            .into_iter()
            .chain(6..9)
            .filter(|&plane| {
                let full = Self::clear_plane_mask(t, plane);
                let center = if plane < 6 {
                    let (axis, side) = FACES[plane];
                    let mut p = [1, 1, 1];
                    p[axis] = side;
                    idx(p)
                } else {
                    13
                };
                let ring = full & !(1 << center);
                let bit = if plane < 6 { 1 } else { 3 };
                (r & (1 << bit) != 0 && occupied & full == full)
                    || (r & (1 << (bit + 1)) != 0 && occupied & ring == ring)
            })
            .collect()
    }
    fn configured_gravity(&mut self) {
        let r = self.rules.unwrap();
        if r & (1 << 5) == 0 {
            return;
        }
        let direction = (r >> 6) & 3;
        let plane = match direction {
            2 => Some(1),
            3 => self.gravity,
            _ => self.gravity_plane,
        };
        let Some(plane) = plane else {
            return;
        };
        let (axis, side) = if plane < 6 {
            FACES[plane]
        } else {
            (plane - 6, 1)
        };
        self.settle_axis(axis, side, plane as u32 + 1, direction == 1);
    }
    pub fn clear_configured(&mut self, t: &Tables) -> u32 {
        let r = self.rules.unwrap();
        self.last_clears.clear();
        let mut total = 0;
        let mut settled = false;
        loop {
            let mut full = self.configured_planes(t);
            if full.is_empty() && !settled && r & (1 << 8) != 0 {
                self.configured_gravity();
                full = self.configured_planes(t);
            }
            if full.is_empty() {
                break;
            }
            let removed = full
                .iter()
                .fold(0, |m, &p| m | Self::clear_plane_mask(t, p));
            for i in bits(removed) {
                self.board[i] = 0;
                self.ids[i] = 0;
            }
            self.record(2, removed, 0, std::array::from_fn(|i| i));
            let gravity_plane=full.iter().rev().copied().find(|&plane|plane<6 || self.slice_gravity);
            self.last_clears.extend(&full);
            if let Some(plane)=gravity_plane {
                self.gravity_plane=Some(plane);
                self.configured_gravity();
            }
            settled = true;
            total += full.len() as u32;
        }
        self.clears += total;
        self.score += total * 500;
        if total > 0 && (r >> 16) & 3 != 1 {
            self.release_configured(total, t);
        }
        self.refresh_bands();
        total
    }
}
impl Game {
    pub fn configure_rules(&mut self, rules: u32) -> bool {
        if !State::valid_rules(rules) {
            return false;
        }
        let s = &mut self.state;
        if (rules >> 16) & 3 == 1
            && s.rules
                .is_none_or(|old| old & (1 << 9) == 0 || (old >> 16) & 3 != 1)
        {
            s.release_started = Some(s.pieces);
        }
        s.rules = Some(rules);
        s.bandaged = false;
        s.release_bandaged = false;
        s.early_lock = false;
        s.fragment_enabled = false;
        s.fragment_turns = 0;
        s.random_cubies = false;
        s.rebuild_mode = 0;
        s.release_trigger = 0;
        s.release_scattered = false;
        s.gravity_mode = if rules & (1 << 5) == 0 {
            1
        } else if rules & (1 << 8) != 0 {
            2
        } else {
            0
        };
        s.gravity_one_step = rules & (1 << 20) != 0;
        if (rules >> 6) & 3 == 3 && s.gravity.is_none() {
            s.gravity = Some(s.range(6) as usize);
        }
        s.bands.clear();
        // Adopt already-freed legacy fragments without losing them or locking them early.
        let grouped = s.free_groups.iter().fold(s.rebuilding_mask(), |m, g| m | g);
        let mut ids = std::collections::BTreeMap::<u32, u32>::new();
        for f in &s.floating {
            if grouped & (1 << f.cell) == 0 {
                *ids.entry(f.id).or_default() |= 1 << f.cell;
            }
        }
        for mask in ids.into_values() {s.add_free_group(mask);}
        if !self.pending.is_empty() {
            self.pending = s.matches(&self.tables);
        }
        self.revision += 1;
        true
    }
    pub fn debug_piece(&mut self, held: bool, piece: u32) -> bool {
        if !self.state.rules.is_some_and(|r| r & 1 != 0)
            || piece > 11
            || (!held && piece == 0)
            || self.state.over
            || !self.pending.is_empty()
        {
            return false;
        }
        self.save_history();
        self.state.events.clear();
        self.state.last_lock = None;
        self.lock = None;
        self.lock_mask = 0;
        if held {
            self.state.held = piece as u8;
        } else {
            self.state.queue[0] = piece as u8;
            self.state.spawn(&self.tables);
        }
        self.revision += 1;
        true
    }
}
