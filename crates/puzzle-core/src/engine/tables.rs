use super::*;
#[derive(Clone, Copy, Debug)]
pub struct Placement {
    pub face: usize,
    pub mask: u32,
    pub required: u32,
}
pub struct Tables {
    /// Connected nonplanar tetracubes: both screws and the branch.
    pub tetracubes: Vec<u32>,
    pub placements: [Vec<Placement>; 11],
    /// Fallback placements: non-facebound planar surfaces, then core fits for every piece.
    pub fallback: [Vec<(u32, u8)>; 11],
    /// All legal inventories, sorted by minimum separation then total separation.
    pub spawns: [Vec<(u32, u32)>; 11],
    pub inventory: [(usize, usize); 11],
    pub faces: [u32; 6],
    pub edges: u32,
    pub corners: u32,
    pub permutations: [[usize; 27]; 30],
}
impl Default for Tables {
    fn default() -> Self {
        Self::new()
    }
}
impl Tables {
    pub fn new() -> Self {
        let centers = (0..27).filter(|&i| kind(i) == 1).fold(0, |m, i| m | 1 << i);
        let edges = (0..27).filter(|&i| kind(i) == 2).fold(0, |m, i| m | 1 << i);
        let corners = (0..27).filter(|&i| kind(i) == 3).fold(0, |m, i| m | 1 << i);
        let faces = std::array::from_fn(|f| (0..9).fold(0, |m, i| m | 1 << cell(f, i % 3, i / 3)));
        let mut placements: [Vec<Placement>;11] = std::array::from_fn(|piece| {
            if piece >= 9 {return vec![];}
            if piece >= 6 {
                return crate::pieces::PIECES[piece].surface_placements.iter()
                    .map(|&mask|Placement{face:6,mask,required:mask}).collect();
            }
            let mut out: Vec<Placement> = Vec::new();
            let mut s = SHAPES[piece];
            for _ in 0..4 {
                let min_x = s.iter().map(|p| p[0]).min().unwrap();
                let min_y = s.iter().map(|p| p[1]).min().unwrap();
                for p in &mut s {
                    p[0] -= min_x;
                    p[1] -= min_y;
                }
                let w = s.iter().map(|p| p[0]).max().unwrap();
                let h = s.iter().map(|p| p[1]).max().unwrap();
                for f in 0..6 {
                    for u in 0..3 - w {
                        for v in 0..3 - h {
                            let mask = s
                                .iter()
                                .fold(0, |m, p| m | 1 << cell(f, u + p[0], v + p[1]));
                            if !out.iter().any(|p| p.face == f && p.mask == mask) {
                                out.push(Placement {
                                    face: f,
                                    mask,
                                    required: mask,
                                });
                            }
                        }
                    }
                }
                for p in &mut s {
                    *p = [-p[1], p[0]];
                }
            }
            out
        });
        for (alias,a,b) in [(9,2,3),(10,4,5)] {
            placements[alias]=placements[a].iter().chain(&placements[b]).copied().collect();
        }
        let inventory = std::array::from_fn(|i| {
            (
                placements[i]
                    .iter()
                    .map(|p| (p.mask & edges).count_ones() as usize)
                    .max()
                    .unwrap(),
                placements[i]
                    .iter()
                    .map(|p| (p.mask & corners).count_ones() as usize)
                    .max()
                    .unwrap(),
            )
        });
        let fallback = std::array::from_fn(|piece| if piece < 6 { spatial_placements(piece, &faces) } else if piece>=9 {spatial_placements(if piece==9 {2}else{4}, &faces)} else { crate::pieces::PIECES[piece].placements.iter().copied().filter(|m|m&(1<<13)!=0).map(|m|(m,2)).collect() });
        let spawns = std::array::from_fn(|piece| {
            let (ne, nc) = inventory[piece];
            let ns = if piece < 6 || piece>=9 {1} else {crate::pieces::PIECES[piece].surface_inventory[0]};
            let center_sets = combinations(centers, ns).into_iter().filter(|&m|adjacent_centers(m)).collect::<Vec<_>>();
            let es = combinations(edges, ne);
            let cs = combinations(corners, nc);
            let mut all = Vec::new();
            for &e in &es {
                for &c in &cs {
                    for &center_mask in &center_sets {
                        let mask = e | c | center_mask;
                        all.push((mask, separation(mask)));
                    }
                }
            }
            all.sort_unstable_by_key(|&(mask, score)| (std::cmp::Reverse(score), mask));
            all
        });
        let permutations = std::array::from_fn(|m| {
            std::array::from_fn(|i| {
                let reverse = m >= 15;
                let m = m % 15;
                let (axis, layer, side, wide) = if m < 6 {
                    let (a, s) = FACES[m];
                    (a, s, s, false)
                } else if m < 9 {
                    ([0, 1, 2][m - 6], 1, 0, false)
                } else {
                    let (a, s) = FACES[m - 9];
                    (a, s, s, true)
                };
                let mut p = xyz(i);
                if if wide {
                    p[axis] != 2 - side
                } else {
                    p[axis] == layer
                } {
                    let a = (axis + 1) % 3;
                    let b = (axis + 2) % 3;
                    if reverse == (side == 0) {
                        (p[a], p[b]) = (p[b], 2 - p[a]);
                    } else {
                        (p[a], p[b]) = (2 - p[b], p[a]);
                    }
                }
                idx(p)
            })
        });
        // Shared precomputed spatial catalog; reconstruction accepts all three types.
        let mut tetracubes: Vec<u32> = crate::pieces::PIECES.iter()
            .filter(|p| p.spatial).flat_map(|p| p.placements.iter().copied()).collect();
        tetracubes.sort_unstable();
        tetracubes.dedup();
        Self {
            tetracubes,
            placements,
            fallback,
            spawns,
            inventory,
            faces,
            edges,
            corners,
            permutations,
        }
    }
    pub fn rotated(&self, active: u32, m: usize) -> u32 {
        bits(active).fold(0, |mask, i| mask | 1 << self.permutations[m][i])
    }
    pub fn find(&self, piece: usize, occupied: u32, active: u32) -> Option<Placement> {
        self.placements[piece]
            .iter()
            .find(|p| p.mask & occupied == 0 && p.required & active == p.required)
            .copied()
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpawnDecision {
    Active,
    Automatic { mask: u32, tier: u8 },
    TopOut,
}

/// Lexicographic maximin squared Euclidean distance, then sum of pair distances.
/// At most six active cubies: the pair sum is below 256.
pub fn separation(mask: u32) -> u32 {
    let points = bits(mask).map(xyz).collect::<Vec<_>>();
    let mut minimum = 12;
    let mut total = 0;
    for i in 0..points.len() {
        for j in i + 1..points.len() {
            let d = (0..3)
                .map(|k| (points[i][k] - points[j][k]).pow(2) as u32)
                .sum::<u32>();
            minimum = minimum.min(d);
            total += d;
        }
    }
    minimum * 256 + total
}

fn spatial_placements(piece: usize, faces: &[u32; 6]) -> Vec<(u32, u8)> {
    let mut masks = std::collections::BTreeSet::new();
    // Every pair of perpendicular signed axes can be completed by their cross
    // product to a proper 3D rotation. No reflection of the solid is introduced.
    for a in 0..3 {
        for b in 0..3 {
            if a == b {
                continue;
            }
            for sa in [-1, 1] {
                for sb in [-1, 1] {
                    let mut shape = SHAPES[piece].map(|xy| {
                        let mut p = [0; 3];
                        p[a] = xy[0] * sa;
                        p[b] = xy[1] * sb;
                        p
                    });
                    let lo: [i32; 3] =
                        std::array::from_fn(|k| shape.iter().map(|p| p[k]).min().unwrap());
                    for p in &mut shape {
                        for k in 0..3 {
                            p[k] -= lo[k];
                        }
                    }
                    let hi: [i32; 3] =
                        std::array::from_fn(|k| shape.iter().map(|p| p[k]).max().unwrap());
                    for x in 0..3 - hi[0] {
                        for y in 0..3 - hi[1] {
                            for z in 0..3 - hi[2] {
                                let mask = shape
                                    .iter()
                                    .fold(0, |m, p| m | 1 << idx([p[0] + x, p[1] + y, p[2] + z]));
                                if !faces.iter().any(|&f| mask & f == mask) {
                                    masks.insert(mask);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    let mut result = masks
        .into_iter()
        .map(|mask| (mask, if mask & (1 << 13) == 0 { 1 } else { 2 }))
        .collect::<Vec<_>>();
    result.sort_unstable_by_key(|&(mask, tier)| (tier, mask));
    result
}
pub fn combinations(pool: u32, n: usize) -> Vec<u32> {
    fn visit(pool: u32, n: usize, prefix: u32, out: &mut Vec<u32>) {
        if n == 0 {
            out.push(prefix);
            return;
        }
        let mut pool = pool;
        while pool.count_ones() >= n as u32 {
            let bit = 1 << pool.trailing_zeros();
            pool &= !bit;
            visit(pool, n - 1, prefix | bit, out);
        }
    }
    let mut out = Vec::new();
    visit(pool, n, 0, &mut out);
    out
}

/// Queue-only free choices; catalog and packing IDs remain the original nine.
pub fn choices(piece:u8)->&'static [u8] {
    match piece {1=>&[1],2=>&[2],3=>&[3],4=>&[4],5=>&[5],6=>&[6],7=>&[7],8=>&[8],9=>&[9],10=>&[4,3],11=>&[5,6],_=>&[]}
}
pub fn queue_color(piece:u8,mask:u32)->u8 { queue_color_on(piece,mask,None) }
pub fn queue_color_on(piece:u8,mask:u32,face:Option<usize>)->u8 {
    if piece<10 {return piece;}
    for &color in choices(piece) {
        let mut shape=SHAPES[color as usize-1];
        for _ in 0..4 {
            let x=shape.iter().map(|p|p[0]).min().unwrap();
            let y=shape.iter().map(|p|p[1]).min().unwrap();
            for p in &mut shape {p[0]-=x;p[1]-=y;}
            let w=shape.iter().map(|p|p[0]).max().unwrap();
            let h=shape.iter().map(|p|p[1]).max().unwrap();
            for f in (0..6).filter(|f|face.is_none_or(|chosen|chosen==*f)) {for u in 0..3-w {for v in 0..3-h {
                if shape.iter().fold(0,|m,p|m|1<<cell(f,u+p[0],v+p[1]))==mask {return color;}
            }}}
            for p in &mut shape {*p=[-p[1],p[0]];}
        }
    }
    choices(piece)[0]
}

/// Centers on different, non-opposite faces remain mutually adjacent under cube turns.
pub fn adjacent_centers(mask:u32)->bool {
    let centers=bits(mask).filter(|&i|kind(i)==1).collect::<Vec<_>>();
    !centers.iter().any(|&a|centers.iter().any(|&b|a!=b && (0..3).all(|k|xyz(a)[k]+xyz(b)[k]==2)))
}
impl Tables {
    /// Distinct occupied-cell masks, so face/alias duplicates do not hide a forced move.
    pub fn available(&self,piece:usize,blocked:u32)->Vec<(u32,u8)> {
        let mut result=Vec::new();
        for (mask,tier) in self.placements[piece].iter().map(|p|(p.mask,if (6..9).contains(&piece){1}else{0})).chain(self.fallback[piece].iter().copied()) {
            if mask&blocked==0 && !result.iter().any(|&(m,_)|m==mask){result.push((mask,tier));}
        }
        result
    }
}
