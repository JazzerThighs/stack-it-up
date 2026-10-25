use cube_stack::engine::*;
fn fixture() -> Game {
    let mut g = Game::new(1);
    g.state.bandaged = true;
    g.state.floating = vec![
        Fragment {
            cell: 0,
            color: 3,
            id: 99,
        },
        Fragment {
            cell: 1,
            color: 3,
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
    g
}
#[test]
fn early_lock_preserves_turn_and_restores_with_undo() {
    let mut g = fixture();
    let before = g.state.clone();
    assert!(!g.state.move_allowed(2));
    assert!(g.lock_band(1));
    assert_eq!(g.state.board[0..2], [3, 3]);
    assert_eq!(g.state.ids[0..2], [99, 99]);
    assert_eq!(g.state.floating.len(), 2);
    assert_eq!(g.state.bands, vec![(1 << 2) | (1 << 5)]);
    assert!(g.state.move_allowed(2));
    assert_eq!(g.state.active, before.active);
    assert_eq!(g.state.queue, before.queue);
    assert_eq!(g.state.fragment_turns, before.fragment_turns);
    assert_eq!(
        (g.state.score, g.state.pieces, g.state.clears),
        (before.score, before.pieces, before.clears)
    );
    assert!(g.undo());
    assert_eq!(g.state, before);
}
#[test]
fn rejects_disabled_invalid_and_occupied_without_partial_writes() {
    for mode in 0..6 {
        let mut g = fixture();
        let cell = if mode == 0 { 27 } else { 0 };
        match mode {
            1 => g.state.early_lock = false,
            2 => g.state.bandaged = false,
            3 => g.state.board[1] = 2,
            4 => g.state.over = true,
            5 => g.pending.push(g.tables.placements[0][0]),
            _ => (),
        }
        let before = g.state.clone();
        assert!(!g.lock_band(cell));
        assert_eq!(g.state, before);
        assert!(g.history.is_empty());
    }
}
#[test]
fn overlapping_colored_active_can_escape_after_locking_white_group() {
    let mut g = fixture();
    g.state.active = 3;
    assert!(g.lock_band(0));
    assert_eq!(g.state.active, 3);
    assert_eq!(g.state.board[0], 3);
    // Active cells may overlap the static stack while maneuvering, as before.
    assert!(g.state.move_allowed(2));
}
