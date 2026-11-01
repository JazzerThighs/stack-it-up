//! Versioned, bounded state transport shared by native tests and the Wasm UI.
use super::*;
impl Game {
    pub fn export_state(&self) -> Vec<u32> {
        let s = &self.state;
        let spatial=s.piece_pool!=63 || s.board.iter().chain(s.queue.iter()).any(|&p|p>6) || s.held>6 || s.floating.iter().any(|f|f.color>6);
        let extended=spatial || s.rules.is_some() || s.release_trigger!=0 || !s.release_bandaged || s.release_scattered || s.release_selection!=0 || s.release_started.is_some() || !s.free_groups.is_empty();
        let mut v = vec![
            0x53554931,
            if spatial {5} else if s.rules.is_some() {4} else if extended {3} else {2},
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
        v.extend([s.slice_gravity as u32, s.gravity_one_step as u32]);
        if extended {
            v.extend([s.release_trigger,s.release_bandaged as u32,s.release_scattered as u32,s.release_selection,s.release_started.unwrap_or(u32::MAX),s.free_groups.len() as u32]);
            v.extend(&s.free_groups);
        }
        if let Some(rules)=s.rules { v.extend([rules, s.gravity_plane.map_or(9, |p|p as u32)]); }
        if spatial {
            if s.rules.is_none() {v.extend([u32::MAX,9]);}
            v.push(s.piece_pool);
        }
        v
    }
    pub fn import_state(&mut self, data: &[u32]) -> bool {
        fn decode(data: &[u32]) -> Option<(State, bool)> {
            let mut it = data.iter().copied();
            if it.next()? != 0x53554931 {
                return None;
            }
            let version=it.next()?;
            if !(1..=5).contains(&version) { return None; }
            let max_piece=if version>=5 {9} else {6};
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
                || s.held as u32 > max_piece
                || s.fragment_turns > 1_000_000
            {
                return None;
            }
            for x in &mut s.board {
                *x = u8::try_from(it.next()?).ok()?;
                if *x as u32 > max_piece {
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
                if !(1..=max_piece).contains(&p) {
                    return None;
                }
                s.queue.push_back(p as u8);
            }
            if s.queue[0]>6 {
                if s.active & (1<<13)!=0 {return None;}
                let inventory=crate::pieces::PIECES[s.queue[0] as usize-1].surface_inventory;
                let mut counts=[0usize;3];
                for i in bits(s.active) {counts[kind(i)-1]+=1;}
                if (0..3).any(|i|counts[i]>inventory[i]) {return None;}
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
                    || !(1..=max_piece).contains(&color)
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
                if band.count_ones() < 2
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
            if version >= 2 { s.slice_gravity=boolean(&mut it)?; s.gravity_one_step=boolean(&mut it)?; }
            if version>=3 {
                s.release_trigger=it.next()?;
                s.release_bandaged=boolean(&mut it)?;
                s.release_scattered=boolean(&mut it)?;
                s.release_selection=it.next()?;
                let started=it.next()?;
                s.release_started=(started!=u32::MAX).then_some(started);
                if s.release_trigger>2 || s.release_selection>4 || s.release_started.is_some_and(|n|n>s.pieces) {return None;}
                let count=it.next()?;if count>27{return None;}
                let mut free_union=0;
                for _ in 0..count {
                    let group=it.next()?;
                    if group==0 || group&mask!=group || group&(free_union|s.rebuilding_mask())!=0 {return None;}
                    free_union|=group;s.free_groups.push(group);
                }
            }
            if version >= 4 {
                let rules=it.next()?; let plane=it.next()?;
                if !(version==5 && rules==u32::MAX) && !State::valid_rules(rules) || plane>9 { return None; }
                s.rules=(rules!=u32::MAX).then_some(rules); s.gravity_plane=(plane!=9).then_some(plane as usize);
                if s.rules.is_some() && !s.bands.is_empty() { return None; }
            }
            if version>=5 {s.piece_pool=it.next()?;if s.piece_pool==0 || s.piece_pool & !511 !=0 {return None;}}
            if !s.bandaged && s.bands.iter().any(|band|!s.release_bandaged || !s.free_groups.iter().any(|group|band&group==*band)) {return None;}
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
        if self.state.rules.is_some_and(|r|r&1==0) || !(1..=9).contains(&piece) || self.state.over || !self.pending.is_empty() {
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
