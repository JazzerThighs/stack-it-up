//! Independent post-clear perks, bandages, and pooled same-color reconstruction.
use super::*;
use crate::game_contract as contract;
use std::collections::{BTreeMap, BTreeSet};
impl State {
    pub fn add_free_group(&mut self, mask:u32) {
        while self.free_shapes.len()<self.free_groups.len(){self.free_shapes.push(self.free_groups[self.free_shapes.len()]);}
        self.free_groups.push(mask);self.free_shapes.push(mask);
    }
    /// Distances determine all one-, two- and three-cube shapes up to rotation.
    pub fn fragment_shape(mask:u32)->Vec<i32> {
        let cells:Vec<_>=bits(mask).map(xyz).collect();let mut distances=vec![];
        for i in 0..cells.len() {for j in i+1..cells.len() {
            distances.push((0..3).map(|a|{let d=cells[i][a] as i32-cells[j][a] as i32;d*d}).sum());
        }}distances.sort();distances
    }
    pub fn fragment_ready(&self,index:usize)->bool {
        let mask=self.free_groups[index];let r=self.rules.unwrap_or(0);
        if r & contract::FRAGMENTS_CONNECTED==0 {return true;}
        Self::connected(mask) && (!self.shape_rules() || r & contract::REBUILD_ORIGINAL_SHAPE==0 ||
            Self::fragment_shape(mask)==Self::fragment_shape(*self.free_shapes.get(index).unwrap_or(&mask)))
    }
    pub fn shape_rules(&self) -> bool { self.rules.is_some_and(|r|r & contract::SHAPE_RULES!=0) }
    fn allowed_rebuild(&self, mask:u32, old:u8, origin:u8, t:&Tables) -> Option<u8> {
        let r=self.rules?;
        if r & contract::FRAGMENTS_CONNECTED==0 {return Some(old);}
        choices(old).iter().copied().chain(1..=9).find(|&color| {
            (r & contract::REBUILD_QUEUE_SHAPES==0 || (1..=11).any(|p|self.piece_pool&(1<<(p-1))!=0 && choices(p).contains(&color)))
                && (r & contract::REBUILD_ORIGINAL_SHAPE==0 || choices(origin).contains(&color))
                && if t.faces.iter().any(|&face|mask&face==mask) {
                    t.placements[color as usize-1].iter().any(|p|p.mask==mask)
                } else {crate::pieces::PIECES[color as usize-1].placements.contains(&mask)}
        })
    }
    pub fn reconstruction_facebound(&self) -> bool {
        self.rules.is_some_and(|r| r & contract::FRAGMENTS_CONNECTED != 0 && r & contract::LEGACY_FACEBOUND != 0)
    }
    pub fn spatial_reconstruction(&self) -> bool {
        self.rules.is_some() && !self.reconstruction_facebound()
    }

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
        if self.shape_rules() { return self.allowed_rebuild(mask,old,self.free_origins.get(&id).copied().unwrap_or(old),t); }
        std::iter::once(old)
            .chain(1..=6)
            .find(|&color| {
                t.placements[color as usize - 1]
                    .iter()
                    .any(|p| p.face < 6 && p.mask == mask)
            })
            .or_else(|| {
                if self.reconstruction_facebound() { return None; }
                std::iter::once(old).chain(1..=6).find(|&color| {
                    t.fallback[color as usize - 1]
                        .iter()
                        .any(|&(m, _)| m == mask)
                })
            })
            .or_else(|| (self.spatial_reconstruction() && t.tetracubes.contains(&mask)).then_some(old))
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
        if self.shape_rules() && self.rules.unwrap() & contract::FRAGMENTS_CONNECTED==0 {
            return Some(self.rebuild_ids.iter().map(|&id| {
                let group:Vec<_>=self.floating.iter().filter(|f|f.id==id).collect();
                (id,group.iter().fold(0,|m,f|m|1<<f.cell),group[0].color)
            }).collect());
        }
        let mut pools = BTreeMap::<(u8,u8), (u32, Vec<u32>)>::new();
        for &id in &self.rebuild_ids {
            let group: Vec<_> = self.floating.iter().filter(|f| f.id == id).collect();
            if group.len() != 4 {
                return None;
            }
            let color = group[0].color;
            if group.iter().any(|f| f.color != color) {
                return None;
            }
            let (mask, ids) = pools.entry((if self.shape_rules() && self.free_origins.contains_key(&id) {self.free_origins[&id]} else {color},self.free_origins.get(&id).copied().unwrap_or(color))).or_default();
            for f in group {
                if *mask & (1 << f.cell) != 0 {
                    return None;
                }
                *mask |= 1 << f.cell;
            }
            ids.push(id);
        }
        let mut result = vec![];
        for ((old,origin), (mask, ids)) in pools {
            let mut candidates = vec![];
            let mut seen = BTreeSet::new();
            if self.shape_rules() {
                for definition in &crate::pieces::PIECES {
                    for &m in definition.placements {
                        if m&mask==m && !seen.contains(&m) {
                            if let Some(color)=self.allowed_rebuild(m,old,origin,t) {seen.insert(m);candidates.push((m,color));}
                        }
                    }
                }
            } else {
            // Prefer facebound shapes and preserve the old color when ambiguous.
            for fallback in [false, true] {
                if fallback && self.reconstruction_facebound() { continue; }
                for color in std::iter::once(old).chain(1..=6) {
                    let masks: Vec<_> = if fallback {
                        t.fallback[color as usize - 1]
                            .iter()
                            .map(|&(m, _)| m)
                            .collect()
                    } else {
                        t.placements[color as usize - 1]
                            .iter()
                            .filter(|p|p.face<6).map(|p| p.mask)
                            .collect()
                    };
                    for m in masks {
                        if m & mask == m && seen.insert(m) {
                            candidates.push((m, color));
                        }
                    }
                }
            }
            if self.spatial_reconstruction() {
                for &m in &t.tetracubes {
                    if m & mask == m { candidates.push((m, old)); }
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
        if let Some(r) = self.rules {
            return self.rebuild_partition(t).is_some() && self.free_groups.iter().enumerate().all(|(index,&m)| {
                self.fragment_ready(index) && (r & contract::FRAGMENTS_CONNECTED == 0 || (Self::connected(m) && (self.shape_rules() || r & contract::LEGACY_FACEBOUND == 0 || t.faces.iter().any(|face| m & face == m))))
            });
        }
        self.release_scattered || (self.free_groups.iter().all(|&m| Self::connected(m)) && self.rebuild_partition(t).is_some())
    }
    pub fn finish_rebuilds(&mut self, t: &Tables) {
        if self.rules.is_none() && self.release_scattered { self.rebuild_ids.clear(); return; }
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
            if !self.bandaged && !(self.release_bandaged && self.free_groups.iter().any(|group| group & mask == mask)) { return true; }
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
        if self.rules.is_some() { return; }
        if self.release_bandaged {
            self.bands.extend(self.free_groups.iter().flat_map(|&m| Self::connected_parts(m)).filter(|m| m.count_ones()>1));
        }
        if !self.bandaged { return; }
        let free_mask=self.free_groups.iter().fold(0,|all,m|all|m);
        let mut groups = BTreeMap::<u32, u32>::new();
        for f in &self.floating {
            if !self.rebuild_ids.contains(&f.id) && free_mask & (1<<f.cell)==0 {
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
    pub(super) fn free_mask(&mut self, mask: u32) {
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
        if self.release_trigger == 1 { self.release_random_groups(cleared); }
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
            for _ in 0..count {
                if candidates.is_empty() { break; }
                let index = if self.rebuild_mode == 1 {
                    0
                } else {
                    let masks: Vec<_> = candidates.iter().map(|(_,mask)|*mask).collect();
                    let Some(index)=self.select_release(&masks) else { continue; };
                    index
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
                let cell = if self.release_selection==0 {
                    choices[self.range(choices.len() as u32) as usize]
                } else {
                    let groups: Vec<_> = self.groups().iter().map(|g|g.mask).collect();
                    let Some(index)=self.select_release(&groups) else { continue; };
                    let cells: Vec<_> = bits(groups[index]).collect();
                    cells[self.range(cells.len() as u32) as usize]
                };
                self.free_mask(1 << cell);
            }
        }
    }
}
