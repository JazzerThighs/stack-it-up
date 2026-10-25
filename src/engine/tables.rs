use super::*;
#[derive(Clone, Copy, Debug)]
pub struct Placement {
    pub face: usize,
    pub mask: u32,
    pub required: u32,
}
pub struct Tables {
    pub placements: [Vec<Placement>; 6],
    /// Non-facebound planar placements, ordered surface-only then core-containing.
    pub fallback: [Vec<(u32, u8)>; 6],
    /// All legal inventories, sorted by minimum separation then total separation.
    pub spawns: [Vec<(u32, u32)>; 6],
    pub inventory: [(usize, usize); 6],
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
        let placements = std::array::from_fn(|piece| {
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
        let fallback = std::array::from_fn(|piece| spatial_placements(piece, &faces));
        let spawns = std::array::from_fn(|piece| {
            let (ne, nc) = inventory[piece];
            let es = combinations(edges, ne);
            let cs = combinations(corners, nc);
            let mut all = Vec::new();
            for &e in &es {
                for &c in &cs {
                    for center in bits(centers) {
                        let mask = e | c | (1 << center);
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
        Self {
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
/// At most five active cubies: the pair sum is below 256.
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
