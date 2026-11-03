use cube_stack::engine::*;
fn mask(c:&[usize])->u32 {c.iter().fold(0,|m,&i|m|1<<i)}
#[test]
fn freed_v_and_bar_keep_shape_and_roundtrip() {
 let mut g=Game::new(19);let s=&mut g.state;
 s.rules=Some(2|(1<<14)|(1<<22)|(1<<23));s.pieces=1;
 let v=mask(&[0,1,3]);s.add_free_group(v);
 s.floating=[0,1,3].into_iter().map(|cell|Fragment{cell,color:1,id:1}).collect();
 assert!(s.fragment_ready(0));
 s.free_groups[0]=mask(&[0,1,2]);s.floating[2].cell=2;
 assert!(!s.fragment_ready(0));
 let data=g.export_state();assert_eq!(data[1],8);
 let mut h=Game::new(2);assert!(h.import_state(&data));assert_eq!(h.export_state(),data);
 assert!(!h.state.fragment_ready(0));
 h.state.free_groups[0]=mask(&[18,19,21]);assert!(h.state.fragment_ready(0));
 h.state.rules=Some(2|(1<<14)|(1<<23));h.state.free_groups[0]=mask(&[0,1,2]);assert!(h.state.fragment_ready(0));
 h.state.rules=Some(2|(1<<22)|(1<<23));h.state.free_groups[0]=mask(&[0,13,26]);assert!(h.state.fragment_ready(0));
}
#[test]
fn undo_stops_at_placement_even_after_topout() {
 let mut g=Game::new(1);g.state.rules=Some(2);
 let start=g.state.clone();g.history.push_back(start.clone());g.state.active^=1;
 assert!(g.undo());assert_eq!(g.state,start);
 g.history.push_back(start);g.state.pieces+=1;
 assert!(!g.can_undo());assert!(!g.undo());
 g.state.over=true;assert!(!g.undo());
 g.state.rules=Some(3);assert!(g.undo());
}
