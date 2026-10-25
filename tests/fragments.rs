use cube_stack::engine::*;

#[test]
fn multi_clear_releases_only_broken_original_pieces() {
    let t = Tables::new();
    let mut s = State::empty(42);
    // Isolate the original two-face reward fixture; slice behavior has its own tests.
    s.slice_clear_mode = 0;
    s.gravity_mode = 1;
    s.recording = true;
    for i in bits(t.faces[1] | t.faces[2]) {
        s.board[i] = 1;
        s.ids[i] = 99;
    }
    for i in [4, 5, 13, 14] {
        s.board[i] = 2;
        s.ids[i] = 10;
    }
    for i in [22, 23] {
        s.board[i] = 3;
        s.ids[i] = 11;
    }
    assert_eq!(s.clear(&t), 2);
    assert_eq!(s.fragment_turns, 2);
    assert_eq!(s.floating_mask(), (1 << 22) | (1 << 23));
    assert_eq!(
        s.occupied(),
        [4, 5, 13, 14].into_iter().fold(0, |m, i| m | 1 << i)
    );
    assert_eq!(s.events.last().unwrap().kind, 5);
    assert_eq!(s.gravity, None);
}

#[test]
fn hold_preserves_fragments_and_undo_restores_entire_pocket() {
    let mut g = Game::new(19);
    g.state.floating.push(Fragment {
        cell: 13,
        color: 3,
        id: 77,
    });
    g.state.fragment_turns = 2;
    let original = g.state.clone();
    assert!(g.hold());
    assert_eq!(g.state.held, original.queue[0]);
    assert_eq!(g.state.floating, original.floating);
    assert_eq!(g.state.fragment_turns, 2);
    assert!(!g.hold());
    assert!(g.undo());
    assert_eq!(g.state, original);
}

#[test]
fn fragment_turns_permute_and_disabling_allows_one_final_lock() {
    let mut g = Game::new(81);
    g.state.floating.push(Fragment {
        cell: 13,
        color: 4,
        id: 88,
    });
    g.state.fragment_turns = 3;
    let before = g.state.clone();
    let _ = g.preview(6);
    assert_eq!(g.state, before);
    g.set_fragments(false);
    assert_eq!(g.state.fragment_turns, 1);
    for m in 0..30 {
        let mut s = before.clone();
        for f in &mut s.floating {
            f.cell = g.tables.permutations[m][f.cell];
        }
        assert_eq!(
            s.floating_mask(),
            g.tables.rotated(before.floating_mask(), m)
        );
    }
    let hit = g.tables.placements[g.state.queue[0] as usize - 1][0];
    g.state.lock_mask(hit.mask);
    assert!(g.state.floating.is_empty());
    assert_eq!(g.state.board[13], 4);
    assert_eq!(g.state.ids[13], 88);
    assert_eq!(g.state.fragment_turns, 0);
    assert!(!g.state.hold_used);
}
