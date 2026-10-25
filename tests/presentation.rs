use cube_stack::engine::*;

#[test]
fn ambiguous_t_waits_for_either_face_and_undo_restores_the_turn() {
    let tables = Tables::new();
    let mut tested = 0;
    for p in &tables.placements[1] {
        let Some(q) = tables.placements[1]
            .iter()
            .find(|q| q.face != p.face && (q.mask & p.mask).count_ones() == 3)
        else {
            continue;
        };
        for target in [p, q] {
            let mut g = Game::new(19);
            g.state.queue[0] = 2;
            g.state.active = tables.rotated(p.mask | q.mask, 15);
            let before = g.state.clone();
            assert!(g.turn(0));
            assert_eq!(g.state.pieces, 0);
            assert_eq!(g.state.occupied(), 0);
            assert_eq!(g.state.active, p.mask | q.mask);
            assert!(g.pending.len() >= 2);
            assert!(!g.turn(2));
            assert!(!g.choose(6));
            assert!(g.choose(target.face));
            assert_eq!(g.state.occupied(), target.mask);
            assert_eq!(g.lock_mask, target.mask);
            assert_eq!(g.state.pieces, 1);
            assert_eq!(g.state.events[0].kind, 1);
            assert_eq!(g.state.events[0].mask, target.mask);
            assert!(g.pending.is_empty());
            assert!(!g.choose(target.face));
            assert!(g.undo());
            assert_eq!(g.state, before);
            tested += 1;
        }
    }
    assert!(tested >= 24, "exercise every shared cube edge");
}

#[test]
fn occupied_face_is_not_offered_and_pending_choice_can_be_undone() {
    let mut g = Game::new(3);
    g.state.queue[0] = 2;
    let p = *g.tables.placements[1]
        .iter()
        .find(|p| {
            g.tables.placements[1]
                .iter()
                .any(|q| q.face != p.face && (q.mask & p.mask).count_ones() == 3)
        })
        .unwrap();
    let q = *g.tables.placements[1]
        .iter()
        .find(|q| q.face != p.face && (q.mask & p.mask).count_ones() == 3)
        .unwrap();
    g.state.active = g.tables.rotated(p.mask | q.mask, 15);
    let before = g.state.clone();
    g.turn(0);
    assert!(!g.pending.is_empty());
    assert!(g.undo());
    assert_eq!(g.state, before);
    let center = bits(q.mask & !p.mask).next().unwrap();
    g.state.board[center] = 1;
    g.state.ids[center] = 99;
    g.turn(0);
    assert!(g.pending.is_empty());
    assert_eq!(g.lock, Some((p.face, 2)));
}

#[test]
fn animation_events_preserve_clear_before_gravity_and_cell_origins() {
    let t = Tables::new();
    let mut s = State::empty(1);
    s.recording = true;
    s.queue.push_back(2);
    let face = t.faces[1];
    for i in bits(face) {
        s.board[i] = 1;
        s.ids[i] = 1;
    }
    // A disconnected cell above the clearing face must subsequently fall.
    s.board[4] = 3;
    s.ids[4] = 2;
    let mut previous_board = s.board;
    let mut previous_ids = s.ids;
    assert_eq!(s.clear(&t), 1);
    assert_eq!(s.events[0].kind, 2);
    assert_eq!(s.events[0].mask, face);
    assert!(s.events.iter().any(|e| e.kind == 3));
    for e in &s.events {
        if e.kind == 3 {
            assert_eq!(
                e.board.iter().filter(|&&p| p != 0).count(),
                previous_board.iter().filter(|&&p| p != 0).count()
            );
            for i in 0..27 {
                if e.board[i] != 0 {
                    assert_eq!(e.board[i], previous_board[e.origins[i]]);
                    assert_eq!(e.ids[i], previous_ids[e.origins[i]]);
                }
            }
        }
        previous_board = e.board;
        previous_ids = e.ids;
    }
    assert_eq!(previous_board, s.board);
    assert_eq!(previous_ids, s.ids);
}
