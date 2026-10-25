use cube_stack::engine::*;

#[test]
fn automatic_multiclear_chains_preserve_the_queue_and_score() {
    let t = Tables::new();
    let mut seed = 91271u32;
    let mut random = || {
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        seed
    };
    let mut found = false;
    for _ in 0..4000 {
        let mut s = State::empty(54321);
        s.fragment_enabled = false;
        s.queue.extend([3, 1, 2, 4, 5, 6, 3, 1, 2, 4, 5, 6]);
        for i in 0..27 {
            if random() % 100 < 65 {
                s.board[i] = 1 + (i % 6) as u8;
                s.ids[i] = i as u32 + 1;
            }
        }
        // Start from a stable stack: remove existing full faces before the spawn.
        s.clear(&t);
        s.clears = 0;
        s.score = 0;
        s.last_clears.clear();
        let original = s.clone();
        s.spawn(&t);
        if s.auto_placements >= 2 && s.clears >= 2 {
            assert_eq!(s.pieces, s.auto_placements);
            assert_eq!(s.score, s.pieces * 100 + s.clears * 500);
            assert_eq!(s.last_clears.len() as u32, s.clears);
            // Replaying the same state reproduces the whole automatic chain.
            let mut replay = original;
            replay.spawn(&t);
            assert_eq!(replay, s);
            found = true;
            break;
        }
    }
    assert!(
        found,
        "expected a stable-stack automatic multiclear fixture"
    );
}
