//! Selection policies and the independent random stack-group release perk.
use super::*;
impl State {
    pub fn connected(mask: u32) -> bool {
        if mask == 0 {
            return false;
        }
        let mut seen = 0;
        let mut todo = vec![mask.trailing_zeros() as usize];
        while let Some(i) = todo.pop() {
            if seen & (1 << i) != 0 {
                continue;
            }
            seen |= 1 << i;
            for axis in 0..3 {
                for delta in [-1, 1] {
                    let mut p = xyz(i);
                    p[axis] += delta;
                    if !(0..3).contains(&p[axis]) {
                        continue;
                    }
                    let j = idx(p);
                    if mask & (1 << j) != 0 && seen & (1 << j) == 0 {
                        todo.push(j);
                    }
                }
            }
        }
        seen == mask
    }
    pub fn connected_parts(mut remaining: u32) -> Vec<u32> {
        let mut parts = vec![];
        while remaining != 0 {
            let first = remaining.trailing_zeros() as usize;
            let mut part = 0;
            let mut todo = vec![first];
            remaining &= !(1 << first);
            while let Some(i) = todo.pop() {
                part |= 1 << i;
                for axis in 0..3 {
                    for delta in [-1, 1] {
                        let mut p = xyz(i);
                        p[axis] += delta;
                        if !(0..3).contains(&p[axis]) {
                            continue;
                        }
                        let j = idx(p);
                        if remaining & (1 << j) != 0 {
                            remaining &= !(1 << j);
                            todo.push(j);
                        }
                    }
                }
            }
            parts.push(part);
        }
        parts
    }
    /// A random-cell miss is intentional: never retry an empty/ineligible cell.
    pub fn select_release(&mut self, candidates: &[u32]) -> Option<usize> {
        if candidates.is_empty() {
            return None;
        }
        match self.release_selection {
            1 => {
                let total = candidates.iter().map(|m| m.count_ones()).sum();
                let mut choice = self.range(total);
                for (i, m) in candidates.iter().enumerate() {
                    if choice < m.count_ones() {
                        return Some(i);
                    }
                    choice -= m.count_ones();
                }
                None
            }
            2 => {
                let cell = self.range(27);
                candidates.iter().position(|m| m & (1 << cell) != 0)
            }
            3 | 4 => {
                let size = if self.release_selection == 3 {
                    candidates.iter().map(|m| m.count_ones()).max()
                } else {
                    candidates.iter().map(|m| m.count_ones()).min()
                }?;
                let choices: Vec<_> = candidates
                    .iter()
                    .enumerate()
                    .filter(|(_, m)| m.count_ones() == size)
                    .map(|(i, _)| i)
                    .collect();
                Some(choices[self.range(choices.len() as u32) as usize])
            }
            _ => Some(self.range(candidates.len() as u32) as usize),
        }
    }
    pub fn release_random_groups(&mut self, count: u32) {
        for _ in 0..count {
            // Connected components keep separate broken fragments separate even
            // when they used to share one tetromino ID.
            let candidates: Vec<_> = self.groups().iter().map(|g| g.mask).collect();
            let Some(index) = self.select_release(&candidates) else {
                continue;
            };
            let mask = candidates[index];
            self.add_free_group(mask);
            self.free_mask(mask);
        }
    }
}
impl Game {
    pub fn set_release_rules(
        &mut self,
        trigger: u32,
        bandaged: bool,
        scattered: bool,
        selection: u32,
    ) {
        if self.state.release_trigger != trigger.min(2) {
            self.state.release_started = Some(self.state.pieces);
        }
        self.state.release_trigger = trigger.min(2);
        self.state.release_bandaged = bandaged;
        self.state.release_scattered = scattered;
        self.state.release_selection = selection.min(4);
        self.state.refresh_bands();
        // Changing reconnection requirements can invalidate a pending face choice.
        if !self.pending.is_empty() {
            self.pending = self.state.matches(&self.tables);
        }
        self.revision += 1;
    }
}
