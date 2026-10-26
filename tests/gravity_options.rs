use cube_stack::engine::*;
fn paint(s:&mut State,mask:u32){for i in bits(mask){s.board[i]=1;s.ids[i]=i as u32+1;}}
#[test]
fn slices_can_clear_without_triggering_gravity_in_both_clear_modes(){
 let t=Tables::new();
 for mode in [1,2] { for axis in 0..3 { for gravity in [0,2] {
  let mut s=State::empty(1);s.fragment_enabled=false;s.slice_clear_mode=mode;s.slice_gravity=false;s.gravity_mode=gravity;s.gravity=if gravity==2 {Some(1)} else {None};
  let mask=State::clear_plane_mask(&t,6+axis);
  paint(&mut s,if mode==2 {mask & !(1<<13)} else {mask});
  paint(&mut s,1 | (1<<26));
  assert_eq!(s.clear(&t),1);assert_eq!(s.occupied(),1 | (1<<26));
 }}}
}
#[test]
fn single_step_does_not_repeat_after_clear_until_next_event(){
 let t=Tables::new();
 let mut s=State::empty(1);s.fragment_enabled=false;s.gravity_one_step=true;
 paint(&mut s,t.faces[1] | (1<<idx([0,2,0])));
 assert_eq!(s.clear(&t),1);
 assert_eq!(s.occupied(),1<<idx([0,1,0]));
 assert_eq!(s.clear(&t),0);assert_eq!(s.occupied(),1<<idx([0,1,0]));
 s.gravity_one_step=false;s.settle(Some(1));assert_eq!(s.occupied(),1<<idx([0,0,0]));
}
#[test]
fn single_step_retries_blocked_groups_but_never_moves_them_twice(){
 let mut s=State::empty(1);s.gravity_one_step=true;
 paint(&mut s,(1<<idx([0,0,0])) | (1<<idx([0,1,0])));
 s.settle(Some(0));
 assert_eq!(s.occupied(),(1<<idx([0,1,0])) | (1<<idx([0,2,0])));
}
#[test]
fn gravity_options_roundtrip_and_old_states_load_legacy_rules(){
 let mut g=Game::new(1);g.state.slice_gravity=false;g.state.gravity_one_step=true;
 let words=g.export_state();let mut h=Game::new(2);assert!(h.import_state(&words));assert!(!h.state.slice_gravity);assert!(h.state.gravity_one_step);
 let mut old=words[..words.len()-2].to_vec();old[1]=1;
 assert!(h.import_state(&old));assert!(h.state.slice_gravity);assert!(!h.state.gravity_one_step);
 assert!(h.undo());assert!(!h.state.slice_gravity);assert!(h.state.gravity_one_step);
}
