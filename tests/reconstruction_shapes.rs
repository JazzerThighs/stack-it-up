use cube_stack::engine::*;
const MODERN:u32=(1<<23)|2|(1<<14)|(1<<21);
fn release(mask:u32,color:u8)->State {
    let mut s=State::empty(99);s.rules=Some(MODERN);s.piece_pool=511;
    s.rebuild_ids=vec![1];
    s.floating=(0..27).filter(|i|mask&(1<<i)!=0).map(|cell|Fragment{cell,color,id:1}).collect();s
}
#[test]
fn pool_and_original_are_independent_constraints() {
    let t=Tables::new();
    let mask=cube_stack::pieces::PIECES[7].surface_placements[0];
    let mut s=release(mask,1);s.piece_pool=1;
    assert!(!s.rebuild_ready(&t));
    s.piece_pool|=1<<7;assert!(s.rebuild_ready(&t));assert_eq!(s.rebuild_shape(1,&t),Some(8));
    s.rules=Some(MODERN|(1<<22));assert!(!s.rebuild_ready(&t));
    for f in &mut s.floating {f.color=8;}
    assert!(s.rebuild_ready(&t));s.piece_pool=1;assert!(!s.rebuild_ready(&t));
    s.rules=Some((MODERN&!(1<<21))|(1<<22));assert!(s.rebuild_ready(&t));
    s.rules=Some(MODERN&!((1<<21)|(1<<22)));assert!(s.rebuild_ready(&t));
}
#[test]
fn small_groups_require_connection_not_four_cubies_or_a_face() {
    let t=Tables::new();let mut s=State::empty(1);s.rules=Some(MODERN|(1<<22));s.piece_pool=1;
    s.free_groups=vec![(1<<1)|(1<<4)|(1<<13)];assert!(s.rebuild_ready(&t));
    s.free_groups=vec![(1<<0)|(1<<26)];assert!(!s.rebuild_ready(&t));
    s.rules=Some(MODERN&!(1<<14));assert!(s.rebuild_ready(&t));
    let mut whole=release((1<<0)|(1<<2)|(1<<24)|(1<<26),1);
    assert!(!whole.rebuild_ready(&t));whole.rules=Some(MODERN&!(1<<14));assert!(whole.rebuild_ready(&t));
}
#[test]
fn new_rules_roundtrip_and_old_transports_remain_legacy() {
    let mut g=Game::new(12);assert!(g.configure_rules(MODERN|(1<<22)));
    let state=g.export_state();assert_eq!(state[1],6);
    let mut other=Game::new(1);assert!(other.import_state(&state));assert_eq!(other.export_state(),state);
    let mut bad=state.clone();bad[1]=5;assert!(!other.import_state(&bad));
    assert!(g.configure_rules(2|(1<<14)|(1<<15)));assert!(!g.state.shape_rules());
}

#[test]
fn release_captures_original_geometry_instead_of_old_color() {
    let t=Tables::new();let mut s=State::empty(7);
    s.rules=Some(MODERN|(1<<9)|(1<<13)|(2<<16));s.piece_pool=511;
    let mask=cube_stack::pieces::PIECES[7].surface_placements[0];
    for cell in bits(mask) {s.board[cell]=1;s.ids[cell]=1;}
    s.pieces=1;s.release_configured(1,&t);
    assert_eq!(s.floating.len(),4);
    assert!(s.floating.iter().all(|f|f.color==8));
    assert!(s.rebuild_ready(&t));
    s.rules=Some(s.rules.unwrap()|(1<<22));
    assert!(s.rebuild_ready(&t));
}
