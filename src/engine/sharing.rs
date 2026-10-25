//! Versioned, bounded state transport shared by native tests and the Wasm UI.
use super::*;
impl Game {
    pub fn export_state(&self) -> Vec<u32> {
        let s = &self.state;
        let mut v = vec![
            0x53554931,
            1,
            s.rng,
            s.active,
            s.pieces,
            s.clears,
            s.score,
            s.gravity.map_or(9, |x| x as u32),
            s.gravity_mode,
            s.slice_clear_mode,
            s.fragment_enabled as u32,
            s.fragment_turns,
            s.bandaged as u32,
            s.early_lock as u32,
            s.random_cubies as u32,
            s.rebuild_mode,
            s.held as u32,
            s.hold_used as u32,
            s.over as u32,
            u32::from(!self.pending.is_empty()),
            s.auto_placements,
            s.auto_tiers,
        ];
        v.extend(s.board.map(u32::from));
        v.extend(s.ids);
        v.push(s.queue.len() as u32);
        v.extend(s.queue.iter().map(|&p| u32::from(p)));
        v.push(s.floating.len() as u32);
        for f in &s.floating {
            v.extend([f.cell as u32, f.color as u32, f.id]);
        }
        for list in [&s.rebuild_ids, &s.bands] {
            v.push(list.len() as u32);
            v.extend(list);
        }
        v.push(s.last_clears.len() as u32);
        v.extend(s.last_clears.iter().map(|&x| x as u32));
        v
    }
    pub fn import_state(&mut self, data: &[u32]) -> bool {
        fn decode(data: &[u32]) -> Option<(State, bool)> {
            let mut it = data.iter().copied();
            if it.next()? != 0x53554931 || it.next()? != 1 {
                return None;
            }
            let mut s = State::empty(it.next()?);
            s.active = it.next()?;
            s.pieces = it.next()?;
            s.clears = it.next()?;
            s.score = it.next()?;
            let gravity = it.next()?;
            if gravity > 9 {
                return None;
            }
            s.gravity = (gravity != 9).then_some(gravity as usize);
            s.gravity_mode = it.next()?;
            s.slice_clear_mode = it.next()?;
            fn boolean(it: &mut impl Iterator<Item = u32>) -> Option<bool> {
                match it.next()? {
                    0 => Some(false),
                    1 => Some(true),
                    _ => None,
                }
            }
            s.fragment_enabled = boolean(&mut it)?;
            s.fragment_turns = it.next()?;
            s.bandaged = boolean(&mut it)?;
            s.early_lock = boolean(&mut it)?;
            s.random_cubies = boolean(&mut it)?;
            s.rebuild_mode = it.next()?;
            s.held = u8::try_from(it.next()?).ok()?;
            s.hold_used = boolean(&mut it)?;
            s.over = boolean(&mut it)?;
            let pending = boolean(&mut it)?;
            s.auto_placements = it.next()?;
            s.auto_tiers = it.next()?;
            if s.active & !FULL != 0
                || s.pieces > 1_000_000
                || s.clears > 1_000_000
                || s.score > 1_000_000_000
                || s.gravity_mode > 2
                || s.slice_clear_mode > 2
                || s.rebuild_mode > 2
                || s.held > 6
                || s.fragment_turns > 1_000_000
            {
                return None;
            }
            for x in &mut s.board {
                *x = u8::try_from(it.next()?).ok()?;
                if *x > 6 {
                    return None;
                }
            }
            for x in &mut s.ids {
                *x = it.next()?;
            }
            for i in 0..27 {
                if (s.board[i] == 0) != (s.ids[i] == 0) || s.ids[i] > s.pieces {
                    return None;
                }
            }
            let n = it.next()?;
            if !(2..=32).contains(&n) {
                return None;
            }
            for _ in 0..n {
                let p = it.next()?;
                if !(1..=6).contains(&p) {
                    return None;
                }
                s.queue.push_back(p as u8);
            }
            let n = it.next()?;
            if n > 27 {
                return None;
            }
            let mut mask = 0;
            for _ in 0..n {
                let cell = it.next()?;
                let color = it.next()?;
                let id = it.next()?;
                if cell >= 27
                    || !(1..=6).contains(&color)
                    || id == 0
                    || id > s.pieces
                    || mask & (1 << cell) != 0
                {
                    return None;
                }
                mask |= 1 << cell;
                s.floating.push(Fragment {
                    cell: cell as usize,
                    color: color as u8,
                    id,
                });
            }
            let n = it.next()?;
            if n > 6 {
                return None;
            }
            for _ in 0..n {
                let id = it.next()?;
                let group: Vec<_> = s.floating.iter().filter(|f| f.id == id).collect();
                if s.rebuild_ids.contains(&id)
                    || group.len() != 4
                    || group.iter().any(|f| f.color != group[0].color)
                {
                    return None;
                }
                s.rebuild_ids.push(id);
            }
            let n = it.next()?;
            if n > 13 {
                return None;
            }
            let mut band_union = 0;
            for _ in 0..n {
                let band = it.next()?;
                if !s.bandaged
                    || band.count_ones() < 2
                    || band & mask != band
                    || band & (band_union | s.rebuilding_mask()) != 0
                {
                    return None;
                }
                band_union |= band;
                s.bands.push(band);
            }
            let n = it.next()?;
            if n > 9 {
                return None;
            }
            for _ in 0..n {
                let face = it.next()?;
                if face >= 9 {
                    return None;
                }
                s.last_clears.push(face as usize);
            }
            if it.next().is_some() {
                return None;
            }
            s.recording = true;
            Some((s, pending))
        }
        let Some((s, pending)) = decode(data) else {
            return false;
        };
        let choices = if pending {
            s.matches(&self.tables)
        } else {
            vec![]
        };
        if pending && choices.is_empty() {
            return false;
        }
        self.history.push_back(self.state.clone());
        if self.history.len() > 100 {
            self.history.pop_front();
        }
        self.state = s;
        self.pending = choices;
        self.lock = None;
        self.lock_mask = 0;
        self.revision += 1;
        true
    }
    pub fn set_next_piece(&mut self, piece: u32) -> bool {
        if !(1..=6).contains(&piece) || self.state.over || !self.pending.is_empty() {
            return false;
        }
        self.history.push_back(self.state.clone());
        if self.history.len() > 100 {
            self.history.pop_front();
        }
        self.state.queue[1] = piece as u8;
        self.revision += 1;
        true
    }
}
