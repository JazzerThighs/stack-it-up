use cube_stack::engine::*;
#[test]
fn shared_states_round_trip_and_continue_deterministically() {
    let mut a = Game::new(42);
    a.set_modes(true, true, 2);
    for m in [0, 6, 11, 18] {
        a.turn(m);
        if !a.pending.is_empty() {
            a.choose(a.pending[0].face);
        }
    }
    let words = a.export_state();
    let mut b = Game::new(999);
    assert!(b.import_state(&words));
    assert_eq!(b.export_state(), words);
    for m in [2, 7, 19, 4] {
        assert_eq!(a.turn(m), b.turn(m));
        assert_eq!(a.export_state(), b.export_state());
    }
}
#[test]
fn malformed_states_do_not_change_the_game_and_load_can_be_undone() {
    let mut g = Game::new(3);
    let original = g.export_state();
    for len in 0..original.len() {
        assert!(!g.import_state(&original[..len]));
    }
    for (index, value) in [(0, 0), (1, 99), (3, u32::MAX), (8, 3), (16, 7), (22, 7)] {
        let mut bad = original.clone();
        bad[index] = value;
        assert!(!g.import_state(&bad));
        assert_eq!(g.export_state(), original);
    }
    let other = Game::new(99).export_state();
    assert!(g.import_state(&other));
    assert!(g.undo());
    assert_eq!(g.export_state(), original);
}
#[test]
fn next_piece_changes_only_queue_and_is_undoable() {
    let mut g = Game::new(5);
    let original = g.export_state();
    let active = g.state.active;
    let current = g.state.queue[0];
    assert!(!g.set_next_piece(0));
    assert!(!g.set_next_piece(7));
    assert!(g.set_next_piece(2));
    assert_eq!(g.state.queue[1], 2);
    assert_eq!(g.state.active, active);
    assert_eq!(g.state.queue[0], current);
    assert!(g.undo());
    assert_eq!(g.export_state(), original);
}
#[test]
fn floating_groups_pending_choices_and_topout_survive_transport() {
    let mut g = Game::new(1);
    g.state = State::empty(20);
    g.state.pieces = 5;
    g.state.queue.extend([2, 1, 3]);
    g.state.bandaged = true;
    g.state.floating = vec![
        Fragment {
            cell: 0,
            color: 1,
            id: 1,
        },
        Fragment {
            cell: 1,
            color: 1,
            id: 1,
        },
    ];
    let piece = g.tables.placements[1]
        .iter()
        .find(|p| p.mask & 3 == 0)
        .unwrap()
        .mask;
    g.state.rebuild_ids.push(2);
    for cell in bits(piece) {
        g.state.floating.push(Fragment {
            cell,
            color: 2,
            id: 2,
        });
    }
    g.state.refresh_bands();
    g.state.active = g.tables.placements[1]
        .iter()
        .find(|p| p.mask & (piece | 3) == 0)
        .unwrap()
        .mask;
    g.pending = g.state.matches(&g.tables);
    assert!(!g.pending.is_empty());
    let mut h = Game::new(2);
    assert!(h.import_state(&g.export_state()));
    assert_eq!(h.export_state(), g.export_state());
    assert_eq!(h.state.bands, g.state.bands);
    assert_eq!(h.pending.len(), g.pending.len());
    g.pending.clear();
    g.state.over = true;
    assert!(h.import_state(&g.export_state()));
    assert!(h.state.over);
}
