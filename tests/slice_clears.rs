use cube_stack::engine::*;
fn paint(s: &mut State, mask: u32) {
    for i in bits(mask) {
        s.board[i] = 1;
        s.ids[i] = i as u32 + 1;
    }
}
fn state() -> State {
    let mut s = State::empty(7);
    s.gravity_mode = 1;
    s.fragment_enabled = false;
    s
}
#[test]
fn default_needs_core_on_each_axis_and_surface_option_does_not() {
    let t = Tables::new();
    for plane in 6..9 {
        let mask = State::clear_plane_mask(&t, plane);
        let mut s = state();
        paint(&mut s, mask & !(1 << 13));
        assert_eq!(s.clear(&t), 0);
        let mut relaxed = s.clone();
        relaxed.slice_clear_mode = 2;
        assert_eq!(relaxed.clear(&t), 1);
        assert_eq!(relaxed.occupied(), 0);
        paint(&mut s, 1 << 13);
        assert_eq!(s.clear(&t), 1);
        assert_eq!(s.occupied(), 0);
        assert_eq!(s.last_clears, vec![plane]);
        assert_eq!(s.score, 500);
    }
}
#[test]
fn intersections_clear_simultaneously_and_reward_each_plane() {
    let t = Tables::new();
    let mut s = state();
    s.fragment_enabled = true;
    paint(
        &mut s,
        State::clear_plane_mask(&t, 6) | State::clear_plane_mask(&t, 7),
    );
    assert_eq!(s.clear(&t), 2);
    assert_eq!(s.occupied(), 0);
    assert_eq!(s.fragment_turns, 2);
    assert_eq!(s.score, 1000);
    assert_eq!(s.last_clears, vec![6, 7]);
}
#[test]
fn inward_gravity_stops_at_cleared_slice_without_changing_off_mode() {
    let t = Tables::new();
    let mut s = state();
    s.gravity_mode = 0;
    paint(
        &mut s,
        State::clear_plane_mask(&t, 6) | (1 << idx([0, 0, 0])) | (1 << idx([2, 2, 2])),
    );
    assert_eq!(s.clear(&t), 1);
    assert_eq!(s.occupied(), (1 << idx([1, 0, 0])) | (1 << idx([1, 2, 2])));
    assert_eq!(s.gravity, None);
}
#[test]
fn filled_board_clears_nine_distinct_planes_without_double_counting_cells() {
    let t = Tables::new();
    let mut s = state();
    paint(&mut s, FULL);
    assert_eq!(s.clear(&t), 9);
    assert_eq!(s.occupied(), 0);
    assert_eq!(s.score, 4500);
}
