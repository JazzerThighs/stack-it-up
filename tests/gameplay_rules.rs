use cube_stack::engine::*;
const DEFAULT: u32 = 1 | 2 | 8 | 32 | 512 | (15 << 10) | (1 << 14) | (1 << 15) | (1 << 20);
fn paint(s: &mut State, cells: &[usize], id: u32) {
    for &i in cells {
        s.board[i] = 1;
        s.ids[i] = id;
    }
    s.pieces = s.pieces.max(id);
}
fn sample() -> State {
    let mut s = State::empty(123);
    s.rules = Some(DEFAULT);
    s.fragment_enabled = false;
    paint(&mut s, &[0, 1, 3, 4], 1);
    paint(&mut s, &[18, 19, 20], 2);
    paint(&mut s, &[24, 25], 3);
    paint(&mut s, &[26], 4);
    s
}
#[test]
fn clear_types_are_independent_and_ring_clears_count_once() {
    let t = Tables::new();
    for plane in 0..9 {
        for ring in [false, true] {
            for flags in 1..16 {
                let mut s = State::empty(1);
                s.rules = Some(flags << 1);
                let mask = State::clear_plane_mask(&t, plane);
                let center = if plane < 6 {
                    let (a, v) = FACES[plane];
                    let mut p = [1, 1, 1];
                    p[a] = v;
                    idx(p)
                } else {
                    13
                };
                for i in bits(mask) {
                    if !ring || i != center {
                        paint(&mut s, &[i], i as u32 + 1);
                    }
                }
                let bit = if plane < 6 { 0 } else { 2 };
                let expected = flags & (1 << (bit + 1)) != 0 || !ring && flags & (1 << bit) != 0;
                assert_eq!(
                    s.configured_planes(&t).contains(&plane),
                    expected,
                    "plane {plane}, ring {ring}, flags {flags}"
                );
                assert_eq!(s.clear(&t), expected as u32);
                if expected {
                    assert_eq!(s.occupied(), 0);
                }
            }
        }
    }
}
#[test]
fn each_size_filter_and_all_release_have_no_bands() {
    let t = Tables::new();
    for size in 1..=4 {
        let mut s = sample();
        s.rules = Some((DEFAULT & !(15 << 10)) | (1 << (9 + size)) | (2 << 16));
        s.release_configured(1, &t);
        assert_eq!(s.floating.len(), size as usize);
        assert!(s.bands.is_empty());
        for m in 0..30 {
            assert!(s.move_allowed(m));
        }
    }
    let mut s = sample();
    s.rules = Some(DEFAULT | (2 << 16));
    s.release_configured(1, &t);
    assert_eq!(s.floating.len(), 10);
    assert_eq!(s.rebuild_ids, vec![1]);
    assert_eq!(s.free_groups.len(), 3);
    assert_eq!(s.occupied(), 0);
}
#[test]
fn fragment_reconnection_and_face_rules_are_lock_only() {
    let t = Tables::new();
    let mut s = State::empty(1);
    s.rules = Some(DEFAULT);
    s.free_groups = vec![5];
    assert!(!s.rebuild_ready(&t));
    for m in 0..30 {
        assert!(s.move_allowed(m));
    }
    s.free_groups = vec![3];
    assert!(s.rebuild_ready(&t));
    s.free_groups = vec![(1 << 4) | (1 << 13)];
    assert!(!s.rebuild_ready(&t));
    s.rules = Some(DEFAULT & !(1 << 15));
    assert!(s.rebuild_ready(&t));
    s.free_groups = vec![5];
    assert!(!s.rebuild_ready(&t));
    s.rules = Some(DEFAULT & !(1 << 14));
    assert!(s.rebuild_ready(&t));
    s.free_groups = vec![1 << 13];
    s.rules = Some(DEFAULT);
    assert!(!s.rebuild_ready(&t));
}
#[test]
fn direction_timing_and_one_step_gravity() {
    let t = Tables::new();
    for (direction, expected) in [
        (0, idx([1, 0, 1])),
        (1, idx([1, 2, 1])),
        (2, idx([1, 0, 1])),
    ] {
        let mut s = State::empty(1);
        s.rules = Some(2 | 32 | (direction << 6) | (1 << 8) | (1 << 20));
        s.gravity_one_step = true;
        s.gravity_plane = Some(1);
        paint(&mut s, &[13], 1);
        s.clear(&t);
        assert_eq!(s.occupied(), 1 << expected);
    }
    let mut s = State::empty(1);
    s.rules = Some(2 | 32 | (2 << 6) | (1 << 20));
    paint(&mut s, &[13], 1);
    s.clear(&t);
    assert_eq!(
        s.occupied(),
        1 << 13,
        "clear-only gravity must wait for a clear"
    );
    s.rules = Some(2 | 32 | (2 << 6) | (1 << 8) | (1 << 20));
    s.gravity_one_step = true;
    s.board = [0; 27];
    s.ids = [0; 27];
    paint(&mut s, &[idx([1, 2, 1])], 1);
    s.clear(&t);
    assert_eq!(s.occupied(), 1 << 13);
}
#[test]
fn random_gravity_changes_on_placement_not_turns_and_undo_restores() {
    let mut g = Game::new(129);
    assert!(g.configure_rules(DEFAULT | (3 << 6)));
    let rng = g.state.rng;
    let direction = g.state.gravity;
    assert!(g.turn(6));
    assert_eq!(g.state.rng, rng);
    assert_eq!(g.state.gravity, direction);
    assert!(g.undo());
    assert_eq!(g.state.rng, rng);
    g.state.lock_mask(15);
    assert_ne!(g.state.rng, rng);
    assert!(g.state.gravity.unwrap() < 6);
}
#[test]
fn state_roundtrip_validation_debug_and_undo_policy() {
    let mut g = Game::new(321);
    assert!(g.configure_rules(DEFAULT));
    let before = g.export_state();
    assert_eq!(before[1], 4);
    assert!(g.debug_piece(true, 6));
    assert_eq!(g.state.held, 6);
    assert!(g.undo());
    assert_eq!(g.export_state(), before);
    assert!(g.debug_piece(true, 0));
    assert!(g.debug_piece(false, 2));
    assert_eq!(g.state.queue[0], 2);
    let data = g.export_state();
    assert!(g.import_state(&data));
    assert_eq!(g.export_state(), data);
    assert!(!g.configure_rules(DEFAULT & !30));
    assert!(!g.configure_rules(DEFAULT & !(15 << 10)));
    assert!(!g.configure_rules(DEFAULT | (3 << 16)));
    assert!(g.configure_rules(DEFAULT & !1));
    assert!(!g.debug_piece(true, 4));
    assert!(!g.undo());
    g.state.over = true;
    assert!(g.undo());
    let mut corrupt = data.clone();
    let n = corrupt.len();
    corrupt[n - 2] = 0;
    assert!(!g.import_state(&corrupt));
}
#[test]
fn release_policies_and_placement_event_do_not_repeat_on_hold() {
    let t = Tables::new();
    for (method, size) in [(2, 4), (3, 1)] {
        let mut s = sample();
        s.rules = Some(DEFAULT | (method << 18));
        s.release_configured(1, &t);
        assert_eq!(s.floating.len(), size);
    }
    let mut s = sample();
    s.rules = Some(DEFAULT | (1 << 16));
    s.queue.extend([2, 1, 3, 4, 5, 6, 1]);
    s.spawn(&t);
    let n = s.floating.len();
    assert!(n > 0);
    s.spawn(&t);
    assert_eq!(s.floating.len(), n);
    let mut hits = 0;
    for seed in 1..=1000 {
        let mut s = State::empty(seed * 7919);
        s.rules = Some(DEFAULT | (1 << 18));
        paint(&mut s, &[0], 1);
        s.release_configured(1, &t);
        hits += s.floating.len();
    }
    assert!((10..65).contains(&hits), "{hits}");
}
#[test]
fn actual_multi_clear_awards_attempts_and_all_mode_releases_every_survivor() {
    let t = Tables::new();
    for (event, expected) in [(0, 2), (2, 3)] {
        let mut s = State::empty(7);
        s.rules = Some(2 | 512 | (15 << 10) | (event << 16));
        for i in bits(t.faces[0] | t.faces[2]) {
            paint(&mut s, &[i], 1);
        }
        for (id, i) in [2, 11, 20].into_iter().enumerate() {
            paint(&mut s, &[i], id as u32 + 2);
        }
        assert_eq!(s.clear(&t), 2);
        assert_eq!(s.floating.len(), expected);
        assert!(s.bands.is_empty());
    }
}
#[test]
fn enabling_placement_release_midturn_does_not_release_on_hold() {
    let mut g = Game::new(52);
    paint(&mut g.state, &[0], 1);
    let rules = DEFAULT | (1 << 16);
    assert!(g.configure_rules(rules));
    assert!(g.hold());
    assert!(g.state.floating.is_empty());
}
