//! Seamless rounded piece surfaces. Generated only when the solid stack changes.
//! WebGL transforms and shades the retained vertex buffer during orbiting.
use crate::engine::{COLORS, State, bits, xyz};
type V = [f32; 3];
#[derive(Clone)]
struct RoundBox {
    center: V,
    half: V,
}
fn field(p: V, boxes: &[RoundBox]) -> f32 {
    let mut d: f32 = 10.;
    for b in boxes {
        let q: V = std::array::from_fn(|k| (p[k] - b.center[k]).abs() - b.half[k] + 0.16);
        let outside = q.iter().map(|x| x.max(0.).powi(2)).sum::<f32>().sqrt();
        let distance = outside + q[0].max(q[1]).max(q[2]).min(0.) - 0.16;
        let h = (0.06 - (d - distance).abs()).max(0.) / 0.06;
        d = d.min(distance) - h * h * 0.015;
    }
    d
}
fn normal(p: V, boxes: &[RoundBox]) -> V {
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
fn boxes(mask: u32) -> Vec<RoundBox> {
    let cells = bits(mask).map(xyz).collect::<Vec<_>>();
    let mut candidates = Vec::new();
    for &lo in &cells {
        for &hi in &cells {
            if (0..3).any(|k| lo[k] > hi[k]) {
                continue;
            }
            let mut filled = true;
            for x in lo[0]..=hi[0] {
                for y in lo[1]..=hi[1] {
                    for z in lo[2]..=hi[2] {
                        if mask & (1 << crate::engine::idx([x, y, z])) == 0 {
                            filled = false;
                        }
                    }
                }
            }
            if filled {
                candidates.push((lo, hi));
            }
        }
    }
    candidates
        .iter()
        .filter(|&&(lo, hi)| {
            !candidates
                .iter()
                .any(|&(a, b)| (a, b) != (lo, hi) && (0..3).all(|k| lo[k] >= a[k] && hi[k] <= b[k]))
        })
        .map(|&(lo, hi)| RoundBox {
            center: std::array::from_fn(|k| (lo[k] + hi[k]) as f32 / 2. - 1.),
            half: std::array::from_fn(|k| (hi[k] - lo[k] + 1) as f32 / 2. - 0.055),
        })
        .collect()
}
fn triangle(mut points: [V; 3], boxes: &[RoundBox], color: V, out: &mut Vec<f32>) {
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
                        let t = d[a] / (d[a] - d[b]);
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
        for v in m.chunks_exact(9) {
            let n = v[3..6].iter().map(|x| x * x).sum::<f32>();
            assert!((n - 1.).abs() < 0.002);
        }
    }
}
