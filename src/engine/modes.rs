//! Independent post-clear perks, bandages, and pooled same-color reconstruction.
use super::*;
use std::collections::{BTreeMap, BTreeSet};
impl State {
    pub fn rebuilding_mask(&self) -> u32 {
        self.floating
            .iter()
            .filter(|f| self.rebuild_ids.contains(&f.id))
            .fold(0, |m, f| m | 1 << f.cell)
    }
    pub fn rebuild_shape(&self, id: u32, t: &Tables) -> Option<u8> {
        let group: Vec<_> = self.floating.iter().filter(|f| f.id == id).collect();
        if group.len() != 4 {
            return None;
        }
        let mask = group.iter().fold(0, |m, f| m | 1 << f.cell);
        let old = group[0].color;
        std::iter::once(old)
            .chain(1..=6)
            .find(|&color| {
                t.placements[color as usize - 1]
                    .iter()
                    .any(|p| p.mask == mask)
            })
            .or_else(|| {
                std::iter::once(old).chain(1..=6).find(|&color| {
                    t.fallback[color as usize - 1]
                        .iter()
                        .any(|&(m, _)| m == mask)
                })
            })
    }
    /// Same-colored released pieces form an interchangeable pool. Exact cover
    /// prevents greedy matches from stranding cubies or counting one cell twice.
    pub fn rebuild_partition(&self, t: &Tables) -> Option<Vec<(u32, u32, u8)>> {
        fn cover(
            mask: u32,
            candidates: &[(u32, u8)],
            out: &mut Vec<(u32, u8)>,
            failed: &mut BTreeSet<u32>,
        ) -> bool {
            if mask == 0 {
                return true;
            }
            if failed.contains(&mask) {
                return false;
            }
            let first = 1 << mask.trailing_zeros();
            for &(piece, color) in candidates {
                if piece & first != 0 && piece & mask == piece {
                    out.push((piece, color));
                    if cover(mask ^ piece, candidates, out, failed) {
                        return true;
                    }
                    out.pop();
                }
            }
            failed.insert(mask);
            false
        }
        let mut pools = BTreeMap::<u8, (u32, Vec<u32>)>::new();
        for &id in &self.rebuild_ids {
            let group: Vec<_> = self.floating.iter().filter(|f| f.id == id).collect();
            if group.len() != 4 {
                return None;
            }
            let color = group[0].color;
            if group.iter().any(|f| f.color != color) {
                return None;
            }
            let (mask, ids) = pools.entry(color).or_default();
            for f in group {
                if *mask & (1 << f.cell) != 0 {
                    return None;
                }
                *mask |= 1 << f.cell;
            }
            ids.push(id);
        }
        let mut result = vec![];
        for (old, (mask, ids)) in pools {
            let mut candidates = vec![];
            let mut seen = BTreeSet::new();
            // Prefer facebound shapes and preserve the old color when ambiguous.
            for fallback in [false, true] {
                for color in std::iter::once(old).chain(1..=6) {
                    let masks: Vec<_> = if fallback {
                        t.fallback[color as usize - 1]
                            .iter()
                            .map(|&(m, _)| m)
                            .collect()
                    } else {
                        t.placements[color as usize - 1]
                            .iter()
                            .map(|p| p.mask)
                            .collect()
                    };
                    for m in masks {
                        if m & mask == m && seen.insert(m) {
                            candidates.push((m, color));
                        }
                    }
                }
            }
            let mut pieces = vec![];
            if !cover(mask, &candidates, &mut pieces, &mut BTreeSet::new()) {
                return None;
            }
            if pieces.len() != ids.len() {
                return None;
            }
            result.extend(
                ids.into_iter()
                    .zip(pieces)
                    .map(|(id, (mask, color))| (id, mask, color)),
            );
        }
        Some(result)
    }
    pub fn rebuild_ready(&self, t: &Tables) -> bool {
        self.rebuild_partition(t).is_some()
    }
    pub fn finish_rebuilds(&mut self, t: &Tables) {
        let Some(pieces) = self.rebuild_partition(t) else {
            return;
        };
        for f in &mut self.floating {
            if self.rebuild_ids.contains(&f.id)
                && let Some(&(id, _, color)) = pieces
                    .iter()
                    .find(|&&(_, mask, _)| mask & (1 << f.cell) != 0)
            {
                f.id = id;
                f.color = color;
            }
        }
        self.rebuild_ids.clear();
    }
    pub fn move_allowed(&self, m: usize) -> bool {
        if m >= 30 {
            return false;
        }
        if !self.bandaged {
            return true;
        }
        let base = m % 15;
        let (axis, layer, wide) = if base < 6 {
            let (a, s) = FACES[base];
            (a, s, false)
        } else if base < 9 {
            (base - 6, 1, false)
        } else {
            let (a, s) = FACES[base - 9];
            (a, s, true)
        };
        self.bands.iter().all(|&mask| {
            let affected = bits(mask)
                .filter(|&i| {
                    if wide {
                        xyz(i)[axis] != 2 - layer
                    } else {
                        xyz(i)[axis] == layer
                    }
                })
                .count();
            affected == 0 || affected == mask.count_ones() as usize
        })
    }
    pub fn refresh_bands(&mut self) {
        self.bands.clear();
        if !self.bandaged {
            return;
        }
        let mut groups = BTreeMap::<u32, u32>::new();
        for f in &self.floating {
            if !self.rebuild_ids.contains(&f.id) {
                *groups.entry(f.id).or_default() |= 1 << f.cell;
            }
        }
        for mut remaining in groups.into_values() {
            while remaining != 0 {
                let first = remaining.trailing_zeros() as usize;
                let mut mask = 0u32;
                let mut todo = vec![first];
                remaining &= !(1 << first);
                while let Some(i) = todo.pop() {
                    mask |= 1 << i;
                    let p = xyz(i);
                    for axis in 0..3 {
                        for delta in [-1, 1] {
                            let mut q = p;
                            q[axis] += delta;
                            if !(0..3).contains(&q[axis]) {
                                continue;
                            }
                            let j = idx(q);
                            if remaining & (1 << j) != 0 {
                                remaining &= !(1 << j);
                                todo.push(j);
                            }
                        }
                    }
                }
                if mask.count_ones() > 1 {
                    self.bands.push(mask);
                }
            }
        }
    }
    fn free_mask(&mut self, mask: u32) {
        for i in bits(mask) {
            self.floating.push(Fragment {
                cell: i,
                color: self.board[i],
                id: self.ids[i],
            });
            self.board[i] = 0;
            self.ids[i] = 0;
        }
        if mask != 0 {
            self.record(5, mask, 0, std::array::from_fn(|i| i));
        }
    }
    pub fn release_specials(&mut self, cleared: u32, t: &Tables) {
        if cleared == 0 {
            return;
        }
        // Whole-piece reconstruction gets first choice; random singles never
        // take a cubie from a group already released for reconstruction.
        if self.rebuild_mode != 0 {
            let mut groups = BTreeMap::<u32, u32>::new();
            for i in 0..27 {
                if self.board[i] != 0 {
                    *groups.entry(self.ids[i]).or_default() |= 1 << i;
                }
            }
            let floating_ids: BTreeSet<_> = self.floating.iter().map(|f| f.id).collect();
            let mut candidates: Vec<_> = groups
                .into_iter()
                .filter(|(id, mask)| {
                    mask.count_ones() == 4
                        && !floating_ids.contains(id)
                        && (0..6).any(|p| {
                            t.placements[p].iter().any(|p| p.mask == *mask)
                                || t.fallback[p].iter().any(|&(m, _)| m == *mask)
                        })
                })
                .collect();
            let count = if self.rebuild_mode == 1 {
                candidates.len()
            } else {
                cleared as usize
            };
            for _ in 0..count.min(candidates.len()) {
                let index = if self.rebuild_mode == 1 {
                    0
                } else {
                    self.range(candidates.len() as u32) as usize
                };
                let (id, mask) = candidates.remove(index);
                self.rebuild_ids.push(id);
                self.free_mask(mask);
            }
        }
        // Broken fragments are released before singles when both are enabled.
        self.release_fragments();
        if self.random_cubies {
            for _ in 0..cleared {
                let choices: Vec<_> = bits(self.occupied()).collect();
                if choices.is_empty() {
                    break;
                }
                let cell = choices[self.range(choices.len() as u32) as usize];
                self.free_mask(1 << cell);
            }
        }
    }
}
