use cube_stack::{engine::*,pieces::PIECES};
#[test]
fn every_spatial_shape_matches_including_special_core_inventory() {
    let t=Tables::new();
    for id in 7..=9 {
        let p=&PIECES[id-1];
        assert!(t.fallback[id-1].iter().all(|(m,tier)|m&(1<<13)!=0 && *tier==2));
        for &mask in p.placements {
            let mut s=State::empty(1);s.queue.extend([id as u8,1]);s.active=mask;
            assert!(!s.matches(&t).is_empty());
            if id>=8 {
                s.queue[0]=if id==8 {9} else {8};
                assert!(s.matches(&t).is_empty());
            }
        }
    }
}
#[test]
fn spatial_spawns_have_minimal_inventory_and_no_finished_piece() {
    let t=Tables::new();
    for id in 7..=9 {for seed in 1..20 {
        let mut s=State::empty(seed);s.queue.extend([id,1]);
        assert_eq!(s.spawn_decision(&t),SpawnDecision::Active);
        assert_eq!(s.active&(1<<13),0);assert!(s.matches(&t).is_empty());
        let mut counts=[0;3];for i in bits(s.active) {counts[kind(i)-1]+=1;}
        assert_eq!(counts,PIECES[id as usize-1].surface_inventory);
    }}
}
#[test]
fn sole_spatial_gap_is_automatic_on_surface_or_in_core() {
    let t=Tables::new();
    for id in 7..=9 {
        for &gap in PIECES[id-1].placements {
            let mut s=State::empty(1);s.queue.extend([id as u8,1]);
            for i in bits(FULL^gap) {s.board[i]=1;s.ids[i]=1;}
            let decision=s.spawn_decision(&t);
            if gap&(1<<13)==0 {assert_eq!(decision,SpawnDecision::Automatic{mask:gap,tier:1});}
            else {assert_eq!(decision,SpawnDecision::Automatic{mask:gap,tier:2});}
        }
    }
}
#[test]
fn spatial_turn_lock_hold_and_transport() {
    for id in 7..=9 {
        let mut g=Game::new(42);g.state=State::empty(42);g.state.queue.extend([id,1,2]);
        let mask=PIECES[id as usize-1].surface_placements[0];
        g.state.active=g.tables.rotated(mask,15);
        assert!(!g.preview(0).is_empty());assert!(g.turn(0));
        if !g.pending.is_empty() {assert!(g.choose(g.pending[0].face));}
        assert_eq!(g.state.pieces,1);assert_eq!(g.lock_mask,mask);
        assert_eq!(g.state.board.iter().filter(|&&c|c==id).count(),4);
        assert!(g.state.last_lock.unwrap().0.is_none());
        let data=g.export_state();assert_eq!(data[1],5);
        let mut h=Game::new(1);assert!(h.import_state(&data));assert_eq!(h.export_state(),data);
        assert!(g.undo());assert_eq!(g.state.queue[0],id);assert!(g.hold());assert_eq!(g.state.held,id);
        assert!(h.import_state(&g.export_state()));assert_eq!(h.state.held,id);
    }
}
#[test]
fn custom_pool_and_pending_spatial_choices_roundtrip() {
    let mut g=Game::new(123);
    assert!(!g.set_piece_pool(0,true));assert!(g.set_piece_pool(448,true));
    assert!(g.state.queue.iter().all(|id|*id>=7));
    let saved=g.export_state();let mut h=Game::new(4);assert!(h.import_state(&saved));assert_eq!(h.export_state(),saved);
    assert!(g.set_piece_pool(1,false));assert!(g.state.queue.iter().skip(1).all(|&id|id==1));
    assert!(g.undo());assert_eq!(g.state.piece_pool,448);
    // Find an overlapping pair of surface completions within the actual inventory.
    g.state=State::empty(5);g.state.queue.extend([7,8]);
    let placements=&g.tables.placements[6];
    let pair=placements.iter().flat_map(|a|placements.iter().map(move |b|(a.mask,b.mask)))
        .find(|(a,b)| {
            if a==b {return false;}
            let mut counts=[0;3];for i in bits(a|b) {counts[kind(i)-1]+=1;}
            (0..3).all(|i|counts[i]<=PIECES[6].surface_inventory[i])
        }).unwrap();
    g.state.active=pair.0|pair.1;g.pending=g.state.matches(&g.tables);
    assert!(g.pending.len()>1);assert!(g.pending.iter().all(|p|p.face>=6));
    assert!(h.import_state(&g.export_state()));assert_eq!(h.pending.len(),g.pending.len());
    let choice=h.pending[1];assert!(h.choose(choice.face));assert_eq!(h.lock_mask,choice.mask);
}
