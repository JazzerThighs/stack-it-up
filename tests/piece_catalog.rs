use cube_stack::{engine::{bits, idx, kind, xyz, Tables},pieces::*};
use std::collections::BTreeSet;

fn connected(mask:u32)->bool {
    let mut seen=1<<mask.trailing_zeros();
    loop {
        let old=seen;
        for i in bits(old) {for j in bits(mask) {
            if xyz(i).iter().zip(xyz(j)).map(|(a,b)|(a-b).abs()).sum::<i32>()==1 {seen|=1<<j;}
        }}
        if seen==old {return seen==mask;}
    }
}
#[test]
fn ids_and_classic_shape_seeds_stay_compatible() {
    assert_eq!(PIECES.map(|p|p.letter),['O','T','L','J','S','Z','B','D','F']);
    for (i,p) in PIECES.iter().enumerate() {assert_eq!(p.id as usize,i+1);}
    assert!(piece_by_id(0).is_none());assert!(piece_by_id(10).is_none());
    let tables=Tables::new();
    for (i,p) in PIECES[..6].iter().enumerate() {
        for placement in &tables.placements[i] {assert!(p.placements.contains(&placement.mask));}
    }
}
#[test]
fn covers_every_connected_tetracube_without_merging_screw_handedness() {
    let actual:BTreeSet<_>=PIECES.iter().flat_map(|p|p.placements.iter().copied()).collect();
    let mut expected=BTreeSet::new();
    for a in 0..27 {for b in a+1..27 {for c in b+1..27 {for d in c+1..27 {
        let mask=(1<<a)|(1<<b)|(1<<c)|(1<<d);
        if connected(mask) {expected.insert(mask);}
    }}}}
    assert_eq!(actual,expected);assert_eq!(actual.len(),580);
    // Planar J/L and S/Z coincide under 3D rotations, but not face projection.
    assert_eq!(PIECES[2].placements,PIECES[3].placements);
    assert_eq!(PIECES[4].placements,PIECES[5].placements);
    assert!(PIECES[7].placements.iter().all(|m|!PIECES[8].placements.contains(m)));
    for &mask in PIECES[7].placements {
        let mirror=bits(mask).fold(0,|m,i| {let [x,y,z]=xyz(i);m|1<<idx([2-x,y,z])});
        assert!(PIECES[8].placements.contains(&mirror));
    }
}
#[test]
fn proper_rotations_preserve_type_and_noncore_inventories_are_minimal() {
    assert_eq!(PIECES[6].surface_inventory,[2,3,1]);
    assert_eq!(PIECES[7].surface_inventory,[2,2,1]);
    assert_eq!(PIECES[8].surface_inventory,[2,2,1]);
    for p in PIECES {
        for &mask in p.placements {
            for axis in 0..3 {
                let rotated=bits(mask).fold(0,|m,i| {
                    let mut c=xyz(i);let a=(axis+1)%3;let b=(axis+2)%3;
                    let old=c[a];c[a]=2-c[b];c[b]=old;m|1<<idx(c)
                });
                assert!(p.placements.contains(&rotated));
            }
        }
        let compositions:BTreeSet<_>=p.surface_placements.iter().map(|&mask| {
            assert_eq!(mask&(1<<13),0);
            let mut counts=[0usize;3];for i in bits(mask) {counts[kind(i)-1]+=1;}counts
        }).collect();
        assert_eq!(compositions,p.surface_compositions.iter().copied().collect());
        for axis in 0..3 {
            assert_eq!(p.surface_inventory[axis],compositions.iter().map(|c|c[axis]).max().unwrap());
        }
    }
}
