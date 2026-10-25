use cube_stack::engine::*;

fn with_gap(piece: u8, gap: u32) -> State {
    let mut s = State::empty(42);
    s.queue.extend([piece, 1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]);
    for i in 0..27 {
        if gap & (1 << i) == 0 {
            s.board[i] = 1;
            s.ids[i] = 1;
        }
    }
    s
}

#[test]
fn every_face_gap_survives_a_missing_full_inventory() {
    let t = Tables::new();
    for piece in 0..6 {
        for p in &t.placements[piece] {
            let mut s = with_gap(piece as u8 + 1, p.mask);
            assert_eq!(
                s.spawn_decision(&t),
                SpawnDecision::Automatic {
                    mask: p.mask,
                    tier: 0
                }
            );
        }
    }
}

#[test]
fn surface_gaps_are_used_before_core_gaps() {
    let t = Tables::new();
    let mut checked = 0;
    for piece in 0..6 {
        for &(gap, tier) in &t.fallback[piece] {
            let mut s = with_gap(piece as u8 + 1, gap);
            assert_eq!(
                s.spawn_decision(&t),
                SpawnDecision::Automatic { mask: gap, tier }
            );
            assert_eq!(tier == 1, gap & (1 << 13) == 0);
            assert!(!t.faces.iter().any(|&face| face & gap == gap));
            checked += 1;
        }
    }
    assert!(checked > 0);
    // Compare mixed gaps too: a core fit must never preempt a surface fit.
    for piece in 0..6 {
        for &(surface, tier) in &t.fallback[piece] {
            if tier != 1 {
                continue;
            }
            for &(core, tier) in &t.fallback[piece] {
                if tier != 2 {
                    continue;
                }
                let mut s = with_gap(piece as u8 + 1, surface | core);
                let d = s.spawn_decision(&t);
                assert!(!matches!(
                    d,
                    SpawnDecision::Automatic { tier: 2, .. } | SpawnDecision::TopOut
                ));
            }
        }
    }
}

#[test]
fn only_exhausting_all_three_tiers_can_top_out() {
    let t = Tables::new();
    for piece in 1..=6 {
        let mut s = with_gap(piece, (1 << 0) | (1 << 13) | (1 << 26));
        assert_eq!(s.spawn_decision(&t), SpawnDecision::TopOut);
        assert!(!s.spawn(&t));
        assert!(s.over);
    }
}

#[test]
fn automatic_gap_fill_can_clear_then_resume_normal_play() {
    let t = Tables::new();
    let mut s = with_gap(1, t.placements[0][0].mask);
    assert!(s.spawn(&t));
    assert_eq!(s.auto_placements, 1);
    assert_eq!(s.auto_tiers, 1);
    assert_eq!(s.pieces, 1);
    assert_eq!(s.clears, 9);
    assert_eq!(s.score, 4600);
    assert!(!s.over);
    assert_ne!(s.active, 0);
    assert!(
        t.find(s.queue[0] as usize - 1, s.occupied(), s.active)
            .is_none()
    );
}

#[test]
fn selected_unfinished_spawn_has_globally_maximal_separation() {
    let t = Tables::new();
    // Independently visit all feasible inventories, including some occupied cells.
    for piece in 0..6 {
        for occupied in [0, 1 << 0, (1 << 0) | (1 << 8) | (1 << 26)] {
            let mut s = State::empty(123);
            s.queue.push_back(piece as u8 + 1);
            for i in bits(occupied) {
                s.board[i] = 1;
                s.ids[i] = 1;
            }
            assert_eq!(s.spawn_decision(&t), SpawnDecision::Active);
            assert_eq!(s.active & occupied, 0);
            assert!(t.find(piece, occupied, s.active).is_none());
            let (ne, nc) = t.inventory[piece];
            let mut best = 0;
            for e in combinations(t.edges & !occupied, ne) {
                for c in combinations(t.corners & !occupied, nc) {
                    for center in (0..27).filter(|&i| kind(i) == 1 && occupied & (1 << i) == 0) {
                        let a = e | c | (1 << center);
                        if t.find(piece, occupied, a).is_none() {
                            best = best.max(separation(a));
                        }
                    }
                }
            }
            assert_eq!(separation(s.active), best);
        }
    }
}

#[test]
fn fragmented_shape_without_planar_fit_is_not_accepted() {
    let t = Tables::new();
    // A 3D tripod is not any of the game's planar tetrominoes.
    let gap = [13, 14, 16, 22].into_iter().fold(0, |m, i| m | 1 << i);
    for p in 1..=6 {
        assert_eq!(with_gap(p, gap).spawn_decision(&t), SpawnDecision::TopOut);
    }
}
