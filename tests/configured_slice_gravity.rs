use cube_stack::engine::*;
fn puzzle(slice_gravity:bool)->State {
    let mut s=State::empty(1);s.rules=Some(8|32|(1<<23));s.slice_gravity=slice_gravity;
    s.gravity_plane=Some(1);s.recording=true;
    for i in 0..27 {if xyz(i)[0]==1 {s.board[i]=1;s.ids[i]=1;}}
    s.board[idx([2,2,2])]=2;s.ids[idx([2,2,2])]=2;s
}
#[test]
fn slice_only_clear_respects_toggle_and_preserves_last_direction() {
 let t=Tables::new();
 for ring in [false,true] {for on in [false,true] {
  let mut s=puzzle(on);
  if ring {s.rules=Some(16|32|(1<<23));s.board[13]=0;s.ids[13]=0;}
  assert_eq!(s.clear(&t),1);
  assert_eq!(s.gravity_plane,Some(if on {6}else{1}));
  assert_eq!(s.board[idx([if on {1}else{2},2,2])],2);
  assert_eq!(s.events.iter().any(|e|e.kind==3),on);
 }}
}
#[test]
fn simultaneous_face_clear_still_triggers_gravity() {
 let t=Tables::new();let mut s=puzzle(false);s.rules=Some(2|8|32|(1<<23));
 for i in 0..27 {if xyz(i)[2]==0 {s.board[i]=1;s.ids[i]=1;}}
 assert_eq!(s.clear(&t),2);assert_eq!(s.gravity_plane,Some(2));
 assert_eq!(s.board[idx([2,2,0])],2);
}
