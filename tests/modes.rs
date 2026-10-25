use cube_stack::engine::*;
fn paint(s: &mut State, mask: u32, id: u32, color: u8) {
    for i in bits(mask) {
        s.board[i] = color;
        s.ids[i] = id;
    }
}
fn profile(mask: u32) -> [usize; 4] {
    let mut n = [0; 4];
    for i in bits(mask) {
        n[kind(i)] += 1;
    }
    n
}
#[test]
fn bandages_reject_split_turns_without_mutating_or_hinting() {
    let mut g = Game::new(1);
    g.state.fragment_enabled = false;
    g.state.bandaged = true;
    g.state.floating = vec![
        Fragment {
            cell: 0,
            color: 1,
            id: 99,
        },
        Fragment {
            cell: 1,
            color: 1,
            id: 99,
        },
    ];
    g.state.refresh_bands();
    assert_eq!(g.state.bands, vec![3]);
    let before = g.state.clone();
    assert!(!g.state.move_allowed(2));
    assert!(!g.turn(2));
    assert_eq!(g.state, before);
    assert!(g.history.is_empty());
    assert!(g.preview(2).is_empty());
    assert!(g.state.move_allowed(4));
    assert!(g.turn(4));
    assert_eq!(g.state.bands[0], g.tables.rotated(3, 4));
    assert!(g.undo());
    assert_eq!(g.state, before);
    g.set_modes(false, false, 0);
    assert!(g.state.move_allowed(2));
}
#[test]
fn singles_release_exactly_one_distinct_cubie_per_clear_and_rng_is_reproducible() {
    let t = Tables::new();
    let mut s = State::empty(17);
    s.fragment_enabled = false;
    s.random_cubies = true;
    for i in 0..20 {
        paint(&mut s, 1 << i, 1 + i as u32, 1);
    }
    let mut copy = s.clone();
    s.release_specials(3, &t);
    copy.release_specials(3, &t);
    assert_eq!(s, copy);
    assert_eq!(s.floating.len(), 3);
    assert_eq!(s.floating_mask().count_ones(), 3);
    assert_eq!(s.occupied().count_ones(), 17);
    s.release_specials(0, &t);
    assert_eq!(s.floating.len(), 3);
    s.release_specials(30, &t);
    assert_eq!(s.floating.len(), 20);
    assert_eq!(s.occupied(), 0);
}
#[test]
fn reconstruction_reuses_original_cells_and_adopts_compatible_shape() {
    let t = Tables::new();
    let mut s = State::empty(7);
    s.rebuild_mode = 1;
    s.fragment_enabled = false;
    let o = t.placements[0][0].mask;
    paint(&mut s, o, 8, 1);
    s.release_specials(1, &t);
    assert_eq!(s.rebuild_ids, vec![8]);
    assert!(s.rebuild_ready(&t));
    assert_eq!(s.occupied(), 0);
    let z = t.placements[4]
        .iter()
        .find(|p| profile(p.mask) == profile(o))
        .unwrap()
        .mask;
    for (f, i) in s.floating.iter_mut().zip(bits(z)) {
        f.cell = i;
    }
    assert_eq!(s.rebuild_shape(8, &t), Some(5));
    s.finish_rebuilds(&t);
    assert!(s.floating.iter().all(|f| f.color == 5 && f.id == 8));
    s.queue.push_back(2);
    s.pieces = 8;
    let current = t.placements[1]
        .iter()
        .find(|p| p.mask & z == 0)
        .unwrap()
        .mask;
    s.lock_mask(current);
    assert!(bits(z).all(|i| s.board[i] == 5 && s.ids[i] == 8));
    assert_eq!(s.pieces, 9);
}
#[test]
fn invalid_rebuild_blocks_current_piece_lock_and_previews() {
    let t = Tables::new();
    let mut s = State::empty(2);
    s.queue.push_back(1);
    s.rebuild_ids.push(88);
    s.floating = [0, 2, 6, 8]
        .into_iter()
        .map(|cell| Fragment {
            cell,
            color: 1,
            id: 88,
        })
        .collect();
    s.active = t.placements[0]
        .iter()
        .find(|p| p.mask & s.floating_mask() == 0)
        .unwrap()
        .mask;
    assert!(!s.rebuild_ready(&t));
    assert!(s.matches(&t).is_empty());
}
#[test]
fn all_modes_combine_without_duplicate_selection_or_bandaging_rebuilds() {
    let t = Tables::new();
    let mut s = State::empty(3);
    s.bandaged = true;
    s.fragment_enabled = true;
    s.fragment_turns = 2;
    s.random_cubies = true;
    s.rebuild_mode = 2;
    let a = t.placements[0][0].mask;
    let b = t.placements[1]
        .iter()
        .find(|p| p.mask & a == 0)
        .unwrap()
        .mask;
    paint(&mut s, a, 1, 1);
    paint(&mut s, b, 2, 2);
    let remain = FULL & !(a | b);
    let broken: Vec<_> = bits(remain).take(2).collect();
    for &i in &broken {
        paint(&mut s, 1 << i, 3, 3);
    }
    s.release_specials(1, &t);
    s.refresh_bands();
    assert_eq!(s.rebuild_ids.len(), 1);
    assert_eq!(s.floating.len(), 7);
    assert_eq!(s.floating_mask().count_ones(), 7);
    assert!(s.bands.iter().all(|m| m & s.rebuilding_mask() == 0));
    assert!(s.floating.iter().all(|f| s.board[f.cell] == 0));
}
#[test]
fn rebuild_random_count_and_all_mode_include_internal_whole_pieces() {
    let t = Tables::new();
    let mut s = State::empty(5);
    s.fragment_enabled = false;
    s.rebuild_mode = 2;
    let a = t.placements[0][0].mask;
    let b = t.placements[1]
        .iter()
        .find(|p| p.mask & a == 0)
        .unwrap()
        .mask;
    paint(&mut s, a, 1, 1);
    paint(&mut s, b, 2, 2);
    s.release_specials(2, &t);
    assert_eq!(s.rebuild_ids.len(), 2);
    let mut internal = State::empty(7);
    internal.fragment_enabled = false;
    internal.rebuild_mode = 1;
    let m = t.fallback[0].iter().find(|(_, tier)| *tier == 2).unwrap().0;
    paint(&mut internal, m, 7, 1);
    internal.release_specials(1, &t);
    assert_eq!(internal.rebuild_ids, vec![7]);
    assert!(internal.rebuild_ready(&t));
}
#[test]
fn clear_counts_drive_rewards_and_off_preserves_defaults() {
    let t = Tables::new();
    let mut s = State::empty(4);
    s.fragment_enabled = false;
    s.random_cubies = true;
    s.gravity_mode = 1;
    paint(&mut s, t.faces[0], 1, 1);
    paint(&mut s, t.faces[1], 2, 2);
    paint(&mut s, (1 << 3) | (1 << 13) | (1 << 23), 3, 3);
    let clears = s.clear(&t);
    assert_eq!(clears, 2);
    assert_eq!(s.floating.len(), 2);
    let mut g = Game::new(9);
    g.set_modes(true, true, 2);
    let config = g.state.clone();
    assert!(g.turn(0));
    assert!(g.undo());
    assert_eq!(g.state, config);
}
#[test]
fn every_mode_combination_releases_without_losing_or_duplicating_cubies() {
    let t = Tables::new();
    for fragments in [false, true] {
        for bandaged in [false, true] {
            for random in [false, true] {
                for rebuild in 0..3 {
                    let mut s = State::empty(19);
                    s.fragment_enabled = fragments;
                    s.bandaged = bandaged;
                    s.random_cubies = random;
                    s.rebuild_mode = rebuild;
                    s.gravity_mode = 1;
                    paint(&mut s, t.faces[0], 10, 2);
                    let whole = t.placements[0].iter().find(|p| p.face == 1).unwrap().mask;
                    paint(&mut s, whole, 20, 1);
                    paint(&mut s, (1 << 3) | (1 << 4), 30, 3);
                    paint(&mut s, 1 << 13, 40, 4);
                    let count = s.occupied().count_ones();
                    assert_eq!(s.clear(&t), 1);
                    assert_eq!(
                        s.occupied().count_ones() + s.floating.len() as u32,
                        count - 9
                    );
                    assert_eq!(s.floating_mask().count_ones() as usize, s.floating.len());
                    assert_eq!(s.floating_mask() & s.occupied(), 0);
                    assert_eq!(s.rebuild_ids.len(), usize::from(rebuild != 0));
                    if !fragments && !random && rebuild == 0 {
                        assert!(s.floating.is_empty());
                    }
                    if !fragments && random && rebuild == 0 {
                        assert_eq!(s.floating.len(), 1);
                    }
                    if !bandaged {
                        assert!(s.bands.is_empty());
                    }
                }
            }
        }
    }
}
#[test]
fn a_current_face_gap_waits_for_reconstruction_instead_of_topping_out() {
    let t = Tables::new();
    let mut s = State::empty(3);
    s.queue.push_back(1);
    s.rebuild_ids.push(88);
    s.floating = [0, 2, 6, 8]
        .into_iter()
        .map(|cell| Fragment {
            cell,
            color: 1,
            id: 88,
        })
        .collect();
    let gap = t.placements[0]
        .iter()
        .find(|p| p.mask & s.floating_mask() == 0)
        .unwrap()
        .mask;
    let occupied = FULL & !(gap | s.floating_mask());
    paint(&mut s, occupied, 1, 1);
    assert!(matches!(s.spawn_decision(&t), SpawnDecision::Active));
    assert_eq!(s.active, gap);
    assert!(!s.over);
}

#[test]
fn wide_turn_moves_one_band_away_from_another_without_splitting_either() {
    let mut g = Game::new(1);
    g.state.bandaged = true;
    g.state.floating = vec![
        Fragment {
            cell: 0,
            color: 1,
            id: 99,
        },
        Fragment {
            cell: 1,
            color: 1,
            id: 99,
        },
        Fragment {
            cell: 2,
            color: 2,
            id: 100,
        },
        Fragment {
            cell: 5,
            color: 2,
            id: 100,
        },
    ];
    g.state.refresh_bands();
    let before = g.state.clone();
    assert!(!g.state.move_allowed(2)); // F splits the first pair.
    assert!(g.state.move_allowed(11)); // Fw contains that entire pair.
    assert!(g.turn(11));
    assert_eq!(g.state.bands[0], g.tables.rotated(3, 11));
    assert_eq!(g.state.bands[1], (1 << 2) | (1 << 5));
    assert!(g.undo());
    assert_eq!(g.state, before);
}

#[test]
fn same_color_rebuilds_can_exchange_cubies_without_using_the_current_piece() {
    let t = Tables::new();
    let a = t.placements[1][0].mask;
    let b = t.placements[1]
        .iter()
        .find(|p| p.mask & a == 0)
        .unwrap()
        .mask;
    let current = t.placements[1]
        .iter()
        .find(|p| p.mask & (a | b) == 0)
        .unwrap()
        .mask;
    let mut s = State::empty(7);
    s.pieces = 100;
    s.queue.push_back(2);
    s.active = current;
    s.rebuild_ids = vec![10, 20];
    for (id, mask) in [(10, a), (20, b)] {
        for cell in bits(mask) {
            s.floating.push(Fragment { cell, color: 2, id });
        }
    }
    // Trade two equally typed cubies, as could happen through slice turns.
    let (i, j) = (0..4)
        .flat_map(|i| (4..8).map(move |j| (i, j)))
        .find(|&(i, j)| {
            if kind(s.floating[i].cell) != kind(s.floating[j].cell) {
                return false;
            }
            let mut trial = s.clone();
            trial.floating[i].id = 20;
            trial.floating[j].id = 10;
            trial.rebuild_shape(10, &t).is_none() && trial.rebuild_shape(20, &t).is_none()
        })
        .unwrap();
    s.floating[i].id = 20;
    s.floating[j].id = 10;
    assert!(s.rebuild_ready(&t));
    assert!(s.matches(&t).iter().any(|p| p.mask == current));
    let mut different_colors = s.clone();
    for f in &mut different_colors.floating {
        if f.id == 20 {
            f.color = 1;
        }
    }
    assert!(!different_colors.rebuild_ready(&t));
    let mut missing = s.clone();
    let removed = missing.floating.pop().unwrap();
    missing.active |= 1 << removed.cell;
    assert!(!missing.rebuild_ready(&t)); // Current spheres cannot fill that gap.
    let mut blocked = s.clone();
    blocked.board[bits(a).next().unwrap()] = 3;
    assert!(blocked.matches(&t).is_empty());
    s.finish_rebuilds(&t);
    assert!(s.rebuild_ids.is_empty());
    assert!(s.rebuild_shape(10, &t).is_some());
    assert!(s.rebuild_shape(20, &t).is_some());
    s.lock_mask(current);
    assert_eq!(s.occupied().count_ones(), 12);
    assert_eq!(s.ids.iter().filter(|&&id| id == 10).count(), 4);
    assert_eq!(s.ids.iter().filter(|&&id| id == 20).count(), 4);
}
