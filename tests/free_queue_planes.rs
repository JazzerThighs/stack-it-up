use cube_stack::engine::*;
const RULES:u32=2|(1<<23)|(1<<14)|(1<<21)|(1<<22);
#[test]
fn free_queue_accepts_both_choices_and_keeps_actual_colors() {
    let t=Tables::new();
    for (alias,options) in [(10,[4,3]),(11,[5,6])] {
        for color in options {
            for p in &t.placements[color as usize-1] {
                let mut s=State::empty(5);s.rules=Some(RULES);s.piece_pool=1<<(alias-1);
                s.queue.push_back(alias);s.active=p.mask;
                assert!(s.matches(&t).iter().any(|m|m.face==p.face&&m.mask==p.mask));
                assert_eq!(s.lock_mask_on(p.mask,Some(p.face)),color);
                assert!(bits(p.mask).all(|i|s.board[i]==color));
                assert_eq!(s.free_origins.get(&1),Some(&alias));
            }
        }
        let mut s=State::empty(5);s.piece_pool=1<<(alias-1);
        assert!(s.spawn(&t));assert_eq!(s.queue[0],alias);assert_eq!(s.active&(1<<13),0);
        assert!(s.matches(&t).is_empty());
    }
}
#[test]
fn free_origin_survives_release_reconstruction_and_transport() {
    let mut g=Game::new(7);g.state=State::empty(7);
    g.state.rules=Some(RULES|(1<<9)|(1<<13)|(2<<16));g.state.piece_pool=1<<10;
    let z=g.tables.placements[5][0];let s=g.tables.placements[4][0];
    g.state.queue.extend([11,11,11]);g.state.lock_mask_on(z.mask,Some(z.face));
    g.state.release_configured(1,&g.tables);
    assert_eq!(g.state.floating.len(),4);
    for (f,i) in g.state.floating.iter_mut().zip(bits(s.mask)){f.cell=i;}
    assert!(g.state.rebuild_ready(&g.tables));
    let mut ordinary=g.state.clone();ordinary.free_origins.clear();
    assert!(!ordinary.rebuild_ready(&g.tables),"ordinary Z must retain its face shape under original-shape rules");
    let words=g.export_state();assert_eq!(words[1],7);
    let mut restored=Game::new(1);assert!(restored.import_state(&words));
    assert_eq!(restored.state.free_origins.get(&1),Some(&11));
    assert!(restored.state.rebuild_ready(&restored.tables));
    restored.state.finish_rebuilds(&restored.tables);
    assert!(restored.state.floating.iter().all(|f|f.color==5));
    let wrong=restored.tables.placements[0][0].mask;
    restored.state.rebuild_ids=vec![1];
    for (f,i) in restored.state.floating.iter_mut().zip(bits(wrong)){f.cell=i;}
    assert!(!restored.state.rebuild_ready(&restored.tables));
    let mut old=words;old[1]=6;assert!(!restored.import_state(&old));
}
fn at(axis:usize,level:i32,a:i32,b:i32)->usize {
    let mut p=[0;3];p[axis]=level;p[(axis+1)%3]=a;p[(axis+2)%3]=b;idx(p)
}
#[test]
fn planes_never_mix_with_occupied_layers_and_keep_relative_positions() {
    for face in 0..6 {
        let (axis,target)=FACES[face];let source=2-target;let middle=1;
        let mut s=State::empty(1);s.rules=Some(RULES|(1<<24));s.gravity_one_step=true;s.recording=true;
        let a=at(axis,source,0,0);let b=at(axis,source,2,2);let block=at(axis,middle,1,1);
        s.board[a]=3;s.ids[a]=1;s.board[b]=4;s.ids[b]=2;s.board[block]=2;s.ids[block]=3;
        // Occupied destination moves first; its fragments never combine with the following layer.
        s.settle(Some(face));
        assert_eq!(s.board[at(axis,target,1,1)],2);
        assert_eq!(s.board[at(axis,middle,0,0)],3);
        assert_eq!(s.board[at(axis,middle,2,2)],4);
        assert_eq!(s.board[at(axis,middle,1,1)],0);
        assert_eq!(s.ids[at(axis,middle,2,2)],2);
        assert_eq!(s.events.last().unwrap().origins[at(axis,middle,0,0)],a);
        let before=s.board;s.settle(Some(face));assert_eq!(s.board,before);
    }
}
#[test]
fn plane_fall_distance_and_legacy_fragment_mode_are_independent() {
    for one in [false,true] {
        let mut s=State::empty(1);s.rules=Some(RULES|(1<<24));s.gravity_one_step=one;
        s.board[idx([2,0,0])]=1;s.ids[idx([2,0,0])]=1;
        s.board[idx([2,2,2])]=2;s.ids[idx([2,2,2])]=2;
        s.settle(Some(4));let level=if one {1}else{0};
        assert_eq!(s.board[idx([level,0,0])],1);assert_eq!(s.board[idx([level,2,2])],2);
    }
    let mut s=State::empty(1);s.rules=Some(RULES);s.board[idx([0,0,0])]=1;s.ids[idx([0,0,0])]=1;
    s.board[idx([2,2,2])]=2;s.ids[idx([2,2,2])]=2;s.settle(Some(4));
    assert_eq!(s.board[idx([0,2,2])],2);
}
