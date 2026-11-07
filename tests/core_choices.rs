use cube_stack::engine::*;
fn filled_except(piece:u8,gap:u32)->State {
 let mut s=State::empty(42);s.queue.extend([piece,1,2,3,4,5,6]);s.pieces=1;
 for i in bits(FULL^gap){s.board[i]=1;s.ids[i]=1;}s
}
#[test]
fn every_multi_center_spawn_is_adjacent_even_when_empty_centers_are_opposite(){
 let t=Tables::new();
 for id in 7..=9 {
  assert!(t.spawns[id-1].iter().all(|&(m,_)|adjacent_centers(m)));
  let blocked=(0..27).filter(|&i|kind(i)==1 && i!=4 && i!=22).fold(0,|m,i|m|1<<i);
  let mut s=filled_except(id as u8,FULL^blocked);
  assert!(t.available(id-1,blocked).len()>1);
  assert_eq!(s.spawn_decision(&t),SpawnDecision::Active);
  assert!(adjacent_centers(s.active));assert_ne!(s.active&blocked,0);
  assert!(s.matches(&t).is_empty());
 }
}
#[test]
fn every_single_fit_is_automatic_in_all_tiers_and_aliases(){
 let t=Tables::new();
 for piece in 0..11 {for (mask,tier) in t.available(piece,0){
  let mut s=filled_except(piece as u8+1,mask);
  assert_eq!(s.spawn_decision(&t),SpawnDecision::Automatic{mask,tier});
 }}
}
#[test]
fn crowded_core_choices_are_explicit_reachable_undoable_and_shareable(){
 let t=Tables::new();
 for piece in 0..11 {
  let cores=t.fallback[piece].iter().filter(|(_,tier)|*tier==2).map(|(m,_)|*m).collect::<Vec<_>>();
  let gap=cores.iter().flat_map(|a|cores.iter().map(move |b|a|b)).find(|&gap|{
   let fits=t.available(piece,FULL^gap);fits.len()>1 && fits.iter().all(|(_,tier)|*tier==2)
  }).expect("multiple core-only orientations");
  let mut g=Game::new(1);g.state=filled_except(piece as u8+1,gap);
  assert_eq!(g.state.spawn_decision(&g.tables),SpawnDecision::Active);
  assert_ne!(g.state.active&(1<<13),0);assert_ne!(g.state.active&g.state.occupied(),0);
  assert!(adjacent_centers(g.state.active));assert!(g.state.matches(&g.tables).is_empty());
  let saved=g.export_state();let options=g.core_options();assert!(options.len()>1);
  for mask in options {
   assert!(g.import_state(&saved));let before=g.state.pieces;
   assert!(g.select_core(mask,false));assert_eq!(g.state.active,mask);assert_eq!(g.state.pieces,before);
   let preview=g.export_state();assert!(g.import_state(&preview));assert_eq!(g.state.active,mask);
   assert!(g.select_core(mask,true));assert!(g.state.pieces>before);assert_eq!(g.lock_mask,mask);
   assert!(g.undo());assert_eq!(g.state.active,mask);assert_eq!(g.state.pieces,before);
  }
 }
}
