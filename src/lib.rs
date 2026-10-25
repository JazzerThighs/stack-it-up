//! Stack It Up: native rules, geometry and a dependency-free browser Wasm ABI.
mod abi;
pub mod engine;
pub mod mesh;
#[cfg(test)]
mod tests {
    use super::engine::*;
    #[test]
    fn every_turn_is_a_bijection_with_an_inverse() {
        let t = Tables::new();
        for m in 0..15 {
            for i in 0..27 {
                let b = 1 << i;
                assert_eq!(t.rotated(t.rotated(b, m), m + 15), b);
                let mut a = b;
                for _ in 0..4 {
                    a = t.rotated(a, m);
                }
                assert_eq!(a, b);
                assert_eq!(kind(i), kind(t.permutations[m][i]));
            }
        }
    }
    #[test]
    fn mirrored_letters_remain_distinct_on_every_face() {
        let t = Tables::new();
        for (a, b) in [(2, 3), (4, 5)] {
            for p in &t.placements[a] {
                assert!(!t.placements[b].iter().any(|q| p.mask == q.mask));
            }
        }
    }
    #[test]
    fn inventory_and_spawns() {
        let t = Tables::new();
        assert_eq!(t.inventory[0], (2, 1));
        assert_eq!(t.inventory[1], (3, 2));
        for seed in 1..200 {
            let mut s = State::empty(seed);
            assert!(s.spawn(&t));
            assert!(t.find(s.queue[0] as usize - 1, 0, s.active).is_none());
            assert_eq!((s.active & !(t.edges | t.corners)).count_ones(), 1);
            assert_eq!(
                s.queue
                    .iter()
                    .take(6)
                    .copied()
                    .collect::<std::collections::HashSet<_>>()
                    .len(),
                6
            );
        }
    }
    #[test]
    fn undo_restores_rng_and_queue() {
        let mut g = Game::new(57);
        let s = g.state.clone();
        g.turn(2);
        g.undo();
        assert_eq!(g.state, s);
        g.turn(2);
        let after = g.state.clone();
        g.undo();
        g.turn(2);
        assert_eq!(g.state, after);
    }
    #[test]
    fn all_full_faces_clear_simultaneously() {
        let t = Tables::new();
        let mut s = State::empty(1);
        s.board.fill(1);
        s.ids.fill(1);
        assert_eq!(s.clear(&t), 9);
        assert_eq!(
            s.board.iter().filter(|&&p| p != 0).count() + s.floating.len(),
            0
        );
        assert_eq!(s.gravity, None);
    }
    #[test]
    fn fragments_fall_separately_and_same_color_ids_stay_distinct() {
        let mut s = State::empty(1);
        for (i, id) in [(0, 1), (6, 1), (7, 2)] {
            s.board[i] = 1;
            s.ids[i] = id;
        }
        assert_eq!(s.groups().len(), 3);
        s.settle(Some(1));
        assert_eq!(s.board[3], 1);
        assert_eq!(s.board[1], 1);
        assert_eq!(s.board[0], 1);
    }
    #[test]
    fn overlap_does_not_block_turns_but_blocks_lock() {
        let mut g = Game::new(2);
        g.state.board.fill(1);
        g.state.ids.fill(1);
        assert!(g.turn(0));
        assert_eq!(g.state.pieces, 0);
        assert_eq!(g.hints(), 0);
    }
    #[test]
    fn full_board_tops_out() {
        let t = Tables::new();
        let mut s = State::empty(1);
        s.board.fill(1);
        assert!(!s.spawn(&t));
        assert!(s.over);
        assert_eq!(s.active, 0);
    }
}
