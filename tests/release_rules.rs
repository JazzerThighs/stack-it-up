use cube_stack::engine::*;
fn paint(s: &mut State, mask: u32, id: u32) {
    for cell in bits(mask) {
        s.board[cell] = 1;
        s.ids[cell] = id;
    }
    s.pieces = s.pieces.max(id);
}
fn sample() -> State {
    let mut s = State::empty(4321);
    s.fragment_enabled = false;
    s.gravity_mode = 1;
    s.queue.extend([2, 1, 3, 4, 5, 6, 1]);
    paint(&mut s, 1 | 2 | 8 | 16, 1);
    paint(&mut s, 1 << 18, 2);
    paint(&mut s, 1 << 26, 3);
    s
}
#[test]
fn policies_weight_cells_choose_groups_and_allow_misses() {
    let candidates = [1 | 2 | 8 | 16, 1 << 18, 1 << 26];
    let mut s = sample();
    s.release_selection = 1;
    let mut counts = [0; 3];
    for _ in 0..12000 {
        counts[s.select_release(&candidates).unwrap()] += 1;
    }
    assert!((7600..8400).contains(&counts[0]), "{counts:?}");
    for &count in &counts[1..] {
        assert!((1750..2250).contains(&count), "{counts:?}");
    }
    s.release_selection = 3;
    for _ in 0..100 {
        assert_eq!(s.select_release(&candidates), Some(0));
    }
    s.release_selection = 4;
    for _ in 0..100 {
        assert_ne!(s.select_release(&candidates), Some(0));
    }
    s.release_selection = 2;
    let mut hits = 0;
    for _ in 0..27000 {
        if s.select_release(&candidates).is_some() {
            hits += 1;
        }
    }
    assert!((5600..6400).contains(&hits), "{hits}");
    s.release_selection = 0;
    let mut equal = [0; 3];
    for _ in 0..9000 {
        equal[s.select_release(&candidates).unwrap()] += 1;
    }
    assert!(
        equal.iter().all(|&n| (2700..3300).contains(&n)),
        "{equal:?}"
    );
}
#[test]
fn release_keeps_original_components_and_has_no_duplicates() {
    let mut s = sample();
    s.release_selection = 3;
    s.release_random_groups(1);
    assert_eq!(s.floating_mask(), 27);
    assert_eq!(s.free_groups, vec![27]);
    s.release_random_groups(5);
    assert_eq!(s.floating.len(), 6);
    assert_eq!(s.free_groups.len(), 3);
    assert_eq!(s.occupied(), 0);
    let mut s = State::empty(1);
    paint(&mut s, 1 | (1 << 26), 1);
    s.release_random_groups(1);
    assert_eq!(
        s.floating.len(),
        1,
        "disconnected remnants of the same ID are separate choices"
    );
}
#[test]
fn two_planes_give_two_releases_and_off_does_not() {
    let t = Tables::new();
    for enabled in [false, true] {
        let mut s = State::empty(4);
        s.fragment_enabled = false;
        s.gravity_mode = 1;
        s.release_trigger = if enabled { 1 } else { 0 };
        for i in bits(t.faces[0] | t.faces[1]) {
            paint(&mut s, 1 << i, i as u32 + 1);
        }
        for i in [3, 14, 22] {
            paint(&mut s, 1 << i, i as u32 + 1);
        }
        assert_eq!(s.clear(&t), 2);
        assert_eq!(s.free_groups.len(), if enabled { 2 } else { 0 });
        assert_eq!(s.occupied().count_ones() + s.floating.len() as u32, 3);
    }
}
#[test]
fn new_piece_trigger_fires_once_not_for_hold_or_slice_turns() {
    let mut g = Game::new(1);
    g.state = sample();
    g.state.release_trigger = 2;
    g.state.release_selection = 3;
    assert!(g.state.spawn(&g.tables));
    assert_eq!(g.state.free_groups.len(), 1);
    let ids: Vec<_> = g.state.floating.iter().map(|f| f.id).collect();
    assert!(g.hold());
    assert_eq!(g.state.free_groups.len(), 1);
    assert_eq!(
        g.state.floating.iter().map(|f| f.id).collect::<Vec<_>>(),
        ids
    );
    let count = g.state.pieces;
    assert_eq!(g.state.release_started, Some(count));
    // Repeated spawn/recovery requests in this same placement turn do not reroll.
    g.state.spawn(&g.tables);
    assert_eq!(g.state.free_groups.len(), 1);
    g.state.finish_rebuilds(&g.tables);
    let mask = g.tables.placements[g.state.queue[0] as usize - 1]
        .iter()
        .find(|p| p.mask & (g.state.occupied() | g.state.floating_mask()) == 0)
        .unwrap()
        .mask;
    g.state.lock_mask(mask);
    g.state.spawn(&g.tables);
    assert_eq!(g.state.release_started, Some(count + 1));
    assert_eq!(g.state.free_groups.len(), 1);
}
#[test]
fn independent_bandages_move_and_early_lock_without_legacy_mode() {
    let mut g = Game::new(1);
    g.state = State::empty(9);
    g.state.queue.extend([1, 2]);
    paint(&mut g.state, 3, 1);
    g.state.fragment_enabled = false;
    g.state.bandaged = false;
    g.state.release_random_groups(1);
    g.state.refresh_bands();
    assert_eq!(g.state.bands, vec![3]);
    assert!(!g.state.move_allowed(2));
    assert!(g.state.move_allowed(6));
    let before = g.state.clone();
    assert!(g.turn(6));
    assert_eq!(g.state.free_groups[0], g.tables.rotated(3, 6));
    assert!(g.undo());
    assert_eq!(g.state, before);
    assert!(g.lock_band(0));
    assert!(g.state.free_groups.is_empty());
    assert_eq!(g.state.occupied(), 3);
}
#[test]
fn scattered_locking_bypasses_only_shape_requirements_never_overlap() {
    let t = Tables::new();
    let mut s = State::empty(1);
    s.queue.extend([1, 2]);
    s.release_bandaged = false;
    for cell in [0, 26] {
        s.floating.push(Fragment {
            cell,
            color: 2,
            id: 1,
        });
    }
    s.free_groups.push(1 | (1 << 26));
    s.pieces = 1;
    s.active = t.placements[0]
        .iter()
        .find(|p| p.mask & s.floating_mask() == 0)
        .unwrap()
        .mask;
    assert!(s.matches(&t).is_empty());
    s.release_scattered = true;
    assert!(!s.matches(&t).is_empty());
    paint(&mut s, 1, 2);
    assert!(s.matches(&t).is_empty());
    s.board[0] = 0;
    s.ids[0] = 0;
    let mask = s.active;
    s.finish_rebuilds(&t);
    s.lock_mask(mask);
    assert!(s.free_groups.is_empty());
    assert_eq!(s.board[0], 2);
    assert_eq!(s.board[26], 2);
}
#[test]
fn new_rules_roundtrip_with_old_formats_supported_and_undo_deterministic() {
    let mut g = Game::new(1);
    g.state = sample();
    g.set_release_rules(1, true, false, 1);
    g.state.release_random_groups(1);
    g.state.refresh_bands();
    let words = g.export_state();
    assert_eq!(words[1], 8);
    let mut h = Game::new(2);
    assert!(h.import_state(&words));
    assert_eq!(h.export_state(), words);
    for m in [0, 6, 12, 20] {
        assert_eq!(g.turn(m), h.turn(m));
        assert_eq!(g.export_state(), h.export_state());
    }
    for len in 0..words.len() {
        assert!(!h.import_state(&words[..len]));
    }
    let old = Game::new(3).export_state();
    assert_eq!(old[1], 2);
    assert!(h.import_state(&old));
    assert_eq!(h.state.release_trigger, 0);
}
#[test]
fn free_modes_combine_and_scattered_rebuilds_keep_their_ids() {
    let t = Tables::new();
    let mut s = sample();
    s.release_trigger = 1;
    s.rebuild_mode = 2;
    s.random_cubies = true;
    s.fragment_enabled = true;
    s.fragment_turns = 1;
    s.release_specials(2, &t);
    assert_eq!(s.floating_mask().count_ones() as usize, s.floating.len());
    let mut s = State::empty(2);
    s.queue.extend([1, 2]);
    s.rebuild_ids.push(1);
    for cell in [0, 2, 24, 26] {
        s.floating.push(Fragment {
            cell,
            color: 2,
            id: 1,
        });
    }
    assert!(!s.rebuild_ready(&t));
    s.release_scattered = true;
    assert!(s.rebuild_ready(&t));
    s.finish_rebuilds(&t);
    assert!(s.rebuild_ids.is_empty());
    assert!(s.floating.iter().all(|f| f.id == 1 && f.color == 2));
}

#[test]
fn each_cleared_plane_gets_a_cell_attempt_even_after_a_miss() {
    let t=Tables::new();let mask=t.placements[0][0].mask;
    let seed=(1..10000).find(|&seed|{
        let mut s=State::empty(seed);s.release_selection=2;
        s.select_release(&[mask]).is_none() && s.select_release(&[mask]).is_some()
    }).unwrap();
    let mut s=State::empty(seed);s.fragment_enabled=false;s.rebuild_mode=2;s.release_selection=2;
    paint(&mut s,mask,1);s.release_specials(2,&t);
    assert_eq!(s.floating_mask(),mask);
}
