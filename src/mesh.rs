//! Seamless rounded piece surfaces. Generated only when the solid stack changes.
//! WebGL transforms and shades the retained vertex buffer during orbiting.
use crate::engine::{COLORS, State, bits, xyz};
type V = [f32; 3];
// Smooth the occupied volume as a whole. Adjacent cell integrals telescope,
// avoiding raised seams where overlapping rounded boxes used to meet.
const SOFTNESS: f32 = 0.28;
const ISO: f32 = 0.65;
#[derive(Clone)]
struct CellVolume {
    center: V,
    shape_center: V,
    shape_half: V,
}
fn integral(x: f32) -> f32 {
    if x <= -SOFTNESS { return 0.; }
    if x >= SOFTNESS { return 1.; }
    let t = x / SOFTNESS;
    let t2 = t * t;
    0.5 + (15. / 16.) * t * (1. + t2 * (-2. / 3. + t2 / 5.))
}
fn field(p: V, boxes: &[CellVolume]) -> f32 {
    let filled = boxes.iter().map(|b| {
        (0..3).map(|k| {
            let x = p[k] - b.center[k];
            integral(x + 0.5) - integral(x - 0.5)
        }).product::<f32>()
    }).sum::<f32>();
    // Disjoint pieces cannot overlap: their normalized occupancies sum to at
    // most one, and each surface requires more than half of that occupancy.
    // A piece-wide pressure profile bows broad faces without reintroducing
    // per-cell seams. The threshold is always >= 0.55, retaining separation.
    let dome = boxes.first().map_or(0., |b| {
        (0..3).map(|k| ((p[k]-b.shape_center[k])/b.shape_half[k]).powi(2)).sum::<f32>()
    });
    ISO + 0.10 * (dome - 1.) - filled
}
fn normal(p: V, boxes: &[CellVolume]) -> V {
    let g: V = std::array::from_fn(|k| {
        let mut a = p;
        let mut b = p;
        a[k] += 0.001;
        b[k] -= 0.001;
        field(a, boxes) - field(b, boxes)
    });
    let l = g.iter().map(|v| v * v).sum::<f32>().sqrt().max(1e-9);
    g.map(|v| v / l)
}
fn boxes(mask: u32) -> Vec<CellVolume> {
    let cells = bits(mask).map(xyz).collect::<Vec<_>>();
    if cells.is_empty() { return Vec::new(); }
    let lo: V = std::array::from_fn(|k| cells.iter().map(|c| c[k]).min().unwrap() as f32 - 1.5);
    let hi: V = std::array::from_fn(|k| cells.iter().map(|c| c[k]).max().unwrap() as f32 - 0.5);
    let shape_center = std::array::from_fn(|k| (lo[k]+hi[k])*0.5);
    let shape_half = std::array::from_fn(|k| (hi[k]-lo[k])*0.5);
    cells.into_iter().map(|cell| CellVolume {
        center: cell.map(|v| v as f32 - 1.), shape_center, shape_half,
    }).collect()
}
fn triangle(mut points: [V; 3], boxes: &[CellVolume], color: V, out: &mut Vec<f32>) {
    let center: V = std::array::from_fn(|k| (points[0][k] + points[1][k] + points[2][k]) / 3.);
    let n = normal(center, boxes);
    let u: V = std::array::from_fn(|k| points[1][k] - points[0][k]);
    let v: V = std::array::from_fn(|k| points[2][k] - points[0][k]);
    let cross = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    ];
    if (0..3).map(|k| cross[k] * n[k]).sum::<f32>() < 0. {
        points.swap(1, 2);
    }
    for p in points {
        out.extend(p);
        out.extend(normal(p, boxes));
        out.extend(color);
    }
}
pub fn build(state: &State) -> Vec<f32> {
    let mut out = Vec::new();
    const CORNERS: [[usize; 3]; 8] = [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
    ];
    const TETS: [[usize; 4]; 6] = [
        [0, 5, 1, 6],
        [0, 1, 2, 6],
        [0, 2, 3, 6],
        [0, 3, 7, 6],
        [0, 7, 4, 6],
        [0, 4, 5, 6],
    ];
    const STEP: f32 = 0.16;
    for g in state.groups() {
        let boxes = boxes(g.mask);
        let cells = bits(g.mask).map(xyz).collect::<Vec<_>>();
        let lo: V = std::array::from_fn(|k| cells.iter().map(|p| p[k]).min().unwrap() as f32 - 1.6);
        let n: [usize; 3] = std::array::from_fn(|k| {
            ((cells.iter().map(|p| p[k]).max().unwrap() as f32 - 0.4 - lo[k]) / STEP).ceil()
                as usize
        });
        let key = |x: usize, y: usize, z: usize| (x * (n[1] + 1) + y) * (n[2] + 1) + z;
        let position = |x: usize, y: usize, z: usize| {
            [
                lo[0] + x as f32 * STEP,
                lo[1] + y as f32 * STEP,
                lo[2] + z as f32 * STEP,
            ]
        };
        let mut distances = vec![0.; (n[0] + 1) * (n[1] + 1) * (n[2] + 1)];
        for x in 0..=n[0] {
            for y in 0..=n[1] {
                for z in 0..=n[2] {
                    distances[key(x, y, z)] = field(position(x, y, z), &boxes);
                }
            }
        }
        for x in 0..n[0] {
            for y in 0..n[1] {
                for z in 0..n[2] {
                    let vertices: [V; 8] = std::array::from_fn(|i| {
                        position(x + CORNERS[i][0], y + CORNERS[i][1], z + CORNERS[i][2])
                    });
                    let d: [f32; 8] = std::array::from_fn(|i| {
                        distances[key(x + CORNERS[i][0], y + CORNERS[i][1], z + CORNERS[i][2])]
                    });
                    if d.iter().all(|&d| d >= 0.) || d.iter().all(|&d| d < 0.) {
                        continue;
                    }
                    let edge = |a: usize, b: usize| {
                        // Refine on the shared edge so normals are sampled on
                        // the actual curved surface, not a linear approximation.
                        let (mut lo, mut hi) = (0., 1.);
                        let (mut dl, mut dh) = (d[a], d[b]);
                        for _ in 0..4 {
                            let t = (lo + hi) * 0.5;
                            let p = std::array::from_fn(|k| {
                                vertices[a][k] + (vertices[b][k] - vertices[a][k]) * t
                            });
                            let distance = field(p, &boxes);
                            if (distance < 0.) == (d[a] < 0.) {
                                lo = t;
                                dl = distance;
                            } else {
                                hi = t;
                                dh = distance;
                            }
                        }
                        let t = lo + (hi - lo) * dl / (dl - dh);
                        std::array::from_fn(|k| {
                            vertices[a][k] + (vertices[b][k] - vertices[a][k]) * t
                        })
                    };
                    for tet in TETS {
                        let mut inside = [0; 4];
                        let mut outside = [0; 4];
                        let (mut ni, mut no) = (0, 0);
                        for i in tet {
                            if d[i] < 0. {
                                inside[ni] = i;
                                ni += 1;
                            } else {
                                outside[no] = i;
                                no += 1;
                            }
                        }
                        match ni {
                            1 => triangle(
                                [
                                    edge(inside[0], outside[0]),
                                    edge(inside[0], outside[1]),
                                    edge(inside[0], outside[2]),
                                ],
                                &boxes,
                                COLORS[g.color as usize - 1],
                                &mut out,
                            ),
                            3 => triangle(
                                [
                                    edge(outside[0], inside[0]),
                                    edge(outside[0], inside[1]),
                                    edge(outside[0], inside[2]),
                                ],
                                &boxes,
                                COLORS[g.color as usize - 1],
                                &mut out,
                            ),
                            2 => {
                                let ac = edge(inside[0], outside[0]);
                                let ad = edge(inside[0], outside[1]);
                                let bc = edge(inside[1], outside[0]);
                                let bd = edge(inside[1], outside[1]);
                                triangle(
                                    [ac, ad, bc],
                                    &boxes,
                                    COLORS[g.color as usize - 1],
                                    &mut out,
                                );
                                triangle(
                                    [ad, bd, bc],
                                    &boxes,
                                    COLORS[g.color as usize - 1],
                                    &mut out,
                                );
                            }
                            _ => (),
                        }
                    }
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn connected_field_has_no_internal_seams() {
        let b = boxes((1 << 0) | (1 << 1) | (1 << 2) | (1 << 5));
        assert!(field([-1., -1., -0.5], &b) < 0.);
        assert!(field([-1., -0.5, -1.], &b) > 0.);
    }
    #[test]
    fn broad_faces_bow_smoothly_across_cell_joins() {
        let b = boxes((1 << 0) | (1 << 1) | (1 << 2));
        let surface_x = |z| {
            let (mut lo,mut hi)=(-1.5,-1.);
            for _ in 0..24 {
                let x=(lo+hi)*0.5;
                if field([x,-1.,z],&b)>0. {lo=x;} else {hi=x;}
            }
            (lo+hi)*0.5
        };
        assert!(surface_x(0.) < surface_x(0.75)-0.005);
        for z in [-0.75,-0.5,-0.25,0.,0.25,0.5,0.75] {
            assert!((surface_x(z)-surface_x(-z)).abs()<1e-5);
            let a=normal([surface_x(z),-1.,z],&b);
            let c=normal([surface_x(z+0.001),-1.,z+0.001],&b);
            assert!((0..3).map(|k|(a[k]-c[k]).powi(2)).sum::<f32>()<0.001);
        }
    }
    #[test]
    fn concave_joins_are_smooth_and_order_independent() {
        let b = boxes((1 << 0) | (1 << 1) | (1 << 2) | (1 << 5));
        let mut reversed = b.clone();
        reversed.reverse();
        for y in 0..60 {
            for z in 0..60 {
                let p = [-1., -0.8 + y as f32 * 0.01, 0.2 + z as f32 * 0.01];
                assert!((field(p, &b) - field(p, &reversed)).abs() < 1e-6);
                let n = normal(p, &b);
                let m = normal([p[0], p[1] + 0.0001, p[2]], &b);
                if field(p, &b).abs() < 0.02 {
                    assert!((0..3).map(|k| (n[k]-m[k]).powi(2)).sum::<f32>() < 0.001);
                }
            }
        }
    }
    #[test]
    fn separate_pieces_do_not_inflate_into_each_other() {
        let a = boxes((1 << 0) | (1 << 1) | (1 << 2) | (1 << 5));
        let b = boxes(((1 << 27) - 1) ^ ((1 << 0) | (1 << 1) | (1 << 2) | (1 << 5)));
        for y in 0..30 {
            for z in 0..30 {
                let p = [-1., -1.5 + y as f32 * 0.1, -1.5 + z as f32 * 0.1];
                assert!(field(p, &a) >= 0. || field(p, &b) >= 0.);
            }
        }
    }
    #[test]
    fn mesh_has_finite_unit_normals() {
        let mut s = State::empty(1);
        for i in [0, 1, 2, 5] {
            s.board[i] = 1;
            s.ids[i] = 1;
        }
        let m = build(&s);
        assert!(!m.is_empty());
        assert_eq!(m.len() % 27, 0);
        assert!(m.iter().all(|x| x.is_finite()));
        let surface = boxes((1 << 0) | (1 << 1) | (1 << 2) | (1 << 5));
        for v in m.chunks_exact(9) {
            assert!(field([v[0],v[1],v[2]], &surface).abs() < 0.002);
            let n = v[3..6].iter().map(|x| x * x).sum::<f32>();
            assert!((n - 1.).abs() < 0.002);
        }
    }
}
