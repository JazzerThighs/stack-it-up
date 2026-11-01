use cube_stack::engine::*;
use std::collections::BTreeSet;
const RULES: u32 = 1 | 2 | 8 | 512 | (15 << 10) | (1 << 14);
fn mask(points: &[[i32; 3]]) -> u32 {
    points.iter().fold(0, |m, &p| m | 1 << idx(p))
}
fn orientations(seed: u32) -> BTreeSet<u32> {
    let mut found = BTreeSet::from([seed]);
    let mut todo = vec![seed];
    while let Some(m) = todo.pop() {
        for axis in 0..3 {
            let a = (axis + 1) % 3;
            let b = (axis + 2) % 3;
            let next = bits(m).fold(0, |out, i| {
                let mut p = xyz(i);
                let old = p[a];
                p[a] = 2 - p[b];
                p[b] = old;
                out | 1 << idx(p)
            });
            if found.insert(next) {
                todo.push(next);
            }
        }
    }
    found
}
fn placements(seed: u32) -> BTreeSet<u32> {
    let mut out = BTreeSet::new();
    for rotated in orientations(seed) {
        let points: Vec<_> = bits(rotated).map(xyz).collect();
        let low: [i32; 3] = std::array::from_fn(|a| points.iter().map(|p| p[a]).min().unwrap());
        for x in 0..2 {
            for y in 0..2 {
                for z in 0..2 {
                    let offset = [x, y, z];
                    out.insert(points.iter().fold(0, |m, p| {
                        m | 1 << idx(std::array::from_fn(|a| p[a] - low[a] + offset[a]))
                    }));
                }
            }
        }
    }
    out
}
fn state(m: u32) -> State {
    let mut s = State::empty(93);
    s.rules = Some(RULES);
    s.fragment_enabled = false;
    s.pieces = 1;
    s.rebuild_ids = vec![1];
    s.queue.extend([1, 2, 3, 4, 5, 6, 1]);
    s.floating = bits(m)
        .map(|cell| Fragment {
            cell,
            color: 1,
            id: 1,
        })
        .collect();
    s
}
#[test]
fn exactly_three_nonplanar_rotation_classes_all_lock_and_release_again() {
    let t = Tables::new();
    let branch = mask(&[[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    let screw = mask(&[[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]]);
    let mirror = bits(screw).fold(0, |m, i| {
        let mut p = xyz(i);
        p[0] = 2 - p[0];
        m | 1 << idx(p)
    });
    let classes = [placements(branch), placements(screw), placements(mirror)];
    for a in 0..3 {
        for b in a + 1..3 {
            assert!(
                classes[a].is_disjoint(&classes[b]),
                "proper rotations must not merge screw chirality"
            );
        }
    }
    let all: BTreeSet<_> = classes.into_iter().flatten().collect();
    assert_eq!(all, t.tetracubes.iter().copied().collect());
    for m in all {
        let mut s = state(m);
        assert!(s.rebuild_ready(&t));
        assert_eq!(s.rebuild_shape(1, &t), Some(1));
        s.rules = Some(RULES | (1 << 15));
        assert!(!s.rebuild_ready(&t));
        assert_eq!(s.rebuild_shape(1, &t), None);
        s.rules = Some(RULES);
        let target = t.placements[0]
            .iter()
            .find(|p| p.mask & m == 0)
            .unwrap()
            .mask;
        s.active = target;
        assert!(
            !s.matches(&t).is_empty(),
            "valid sphere piece should place alongside a rebuilt tetracube"
        );
        s.finish_rebuilds(&t);
        s.lock_mask(target);
        assert_eq!(
            bits(m)
                .filter(|&i| s.ids[i] == 1 && s.board[i] == 1)
                .count(),
            4
        );
        s.rules = Some(RULES | (2 << 16));
        s.release_configured(1, &t);
        assert!(s.rebuild_ids.contains(&1));
        assert_eq!(s.rebuild_shape(1, &t), Some(1));
    }
}
#[test]
fn pooled_spatial_reconstruction_disconnected_rejection_and_legacy_unchanged() {
    let t = Tables::new();
    let a = mask(&[[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    let b = mask(&[[2, 2, 2], [1, 2, 2], [2, 1, 2], [2, 2, 1]]);
    let mut s = state(a | b);
    s.pieces = 2;
    s.rebuild_ids = vec![1, 2];
    for (n, f) in s.floating.iter_mut().enumerate() {
        f.id = 1 + (n % 2) as u32;
    }
    let partition = s.rebuild_partition(&t).unwrap();
    assert_eq!(partition.len(), 2);
    assert_eq!(partition.iter().fold(0, |m, p| m | p.1), a | b);
    assert_eq!(partition[0].1 & partition[1].1, 0);
    s = state(mask(&[[0, 0, 0], [2, 0, 0], [0, 2, 2], [2, 2, 2]]));
    assert!(!s.rebuild_ready(&t));
    s = state(a);
    s.rules = None;
    assert!(!s.rebuild_ready(&t));
    let mut g = Game::new(33);
    g.state = state(a);
    let words = g.export_state();
    assert!(g.import_state(&words));
    assert!(g.state.rebuild_ready(&g.tables));
    assert_eq!(g.export_state(), words);
}
