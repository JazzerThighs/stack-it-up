use super::*;
impl State {
    pub fn groups(&self) -> Vec<Group> {
        let mut seen = 0;
        let mut out = Vec::new();
        for i in 0..27 {
            if self.board[i] == 0 || seen & (1 << i) != 0 {
                continue;
            }
            let mut mask = 0;
            let mut todo = vec![i];
            seen |= 1 << i;
            while let Some(j) = todo.pop() {
                mask |= 1 << j;
                let p = xyz(j);
                for axis in 0..3 {
                    for delta in [-1, 1] {
                        let mut q = p;
                        q[axis] += delta;
                        if !(0..3).contains(&q[axis]) {
                            continue;
                        }
                        let k = idx(q);
                        if seen & (1 << k) == 0
                            && self.board[k] == self.board[i]
                            && self.ids[k] == self.ids[i]
                        {
                            seen |= 1 << k;
                            todo.push(k);
                        }
                    }
                }
            }
            out.push(Group {
                mask,
                id: self.ids[i],
                color: self.board[i],
            });
        }
        out
    }
    pub fn settle(&mut self, face: Option<usize>) {
        let Some(face) = face else {
            return;
        };
        let (axis, side) = FACES[face];
        self.settle_toward(axis, side, face as u32 + 1);
    }
    fn settle_toward(&mut self, axis: usize, target: i32, event_plane: u32) {
        let mut groups = self.groups();
        loop {
            let mut moved = false;
            for g in &mut groups {
                let low = bits(g.mask).map(|i| xyz(i)[axis]).min().unwrap();
                let high = bits(g.mask).map(|i| xyz(i)[axis]).max().unwrap();
                let step = if high < target {
                    1
                } else if low > target {
                    -1
                } else {
                    continue;
                };
                let mut next = 0;
                let mut valid = true;
                let occupied = self.occupied();
                for i in bits(g.mask) {
                    let mut p = xyz(i);
                    p[axis] += step;
                    if !(0..3).contains(&p[axis]) {
                        valid = false;
                        break;
                    }
                    let b = 1 << idx(p);
                    if occupied & !g.mask & b != 0 {
                        valid = false;
                        break;
                    }
                    next |= b;
                }
                if !valid {
                    continue;
                }
                for i in bits(g.mask) {
                    self.board[i] = 0;
                    self.ids[i] = 0;
                }
                for i in bits(next) {
                    self.board[i] = g.color;
                    self.ids[i] = g.id;
                }
                let mut origins = std::array::from_fn(|i| i);
                for i in bits(g.mask) {
                    let mut p = xyz(i);
                    p[axis] += step;
                    origins[idx(p)] = i;
                }
                self.record(3, next, event_plane, origins);
                g.mask = next;
                moved = true;
            }
            if !moved {
                break;
            }
        }
    }
    pub fn clear_plane_mask(t: &Tables, plane: usize) -> u32 {
        if plane < 6 {
            t.faces[plane]
        } else {
            (0..27)
                .filter(|&i| xyz(i)[plane - 6] == 1)
                .fold(0, |m, i| m | (1 << i))
        }
    }
    pub fn clear(&mut self, t: &Tables) -> u32 {
        let mut total = 0;
        if self.gravity_mode == 1 {
            self.gravity = None;
        }
        self.last_clears.clear();
        loop {
            let full_faces = |s: &Self| {
                let occupied = s.occupied();
                CLEAR_ORDER
                    .into_iter()
                    .chain((6..9).filter(|_| s.slice_clear_mode != 0))
                    .filter(|&f| {
                        let mask = Self::clear_plane_mask(t, f);
                        let required = if f >= 6 && s.slice_clear_mode == 2 {
                            mask & !(1 << 13)
                        } else {
                            mask
                        };
                        occupied & required == required
                    })
                    .collect::<Vec<_>>()
            };
            let mut full = full_faces(self);
            if full.is_empty() {
                self.settle(self.gravity);
                full = full_faces(self);
            }
            if full.is_empty() {
                break;
            }
            let removed = full
                .iter()
                .fold(0, |m, &f| m | Self::clear_plane_mask(t, f));
            for i in bits(removed) {
                self.board[i] = 0;
                self.ids[i] = 0;
            }
            self.record(2, removed, 0, std::array::from_fn(|i| i));
            self.last_clears.extend(&full);
            if self.gravity_mode != 1 {
                if self.gravity_mode != 2 {
                    let plane = *full.last().unwrap();
                    if plane >= 6 {
                        self.gravity = None;
                        self.settle_toward(plane - 6, 1, plane as u32 + 1);
                    } else {
                        self.gravity = Some(plane);
                    }
                }
                self.settle(self.gravity);
            }
            total += full.len() as u32;
        }
        if self.gravity_mode != 2 {
            self.gravity = None;
        }
        self.clears += total;
        self.score += total * 500;
        if self.fragment_enabled {
            self.fragment_turns += total;
        }
        self.release_specials(total, t);
        if total == 0 {
            self.release_fragments();
        }
        self.refresh_bands();
        total
    }
}
#[derive(Clone, Copy)]
pub struct Group {
    pub mask: u32,
    pub id: u32,
    pub color: u8,
}
