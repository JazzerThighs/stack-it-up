//! Seamless rounded piece surfaces. Generated only when the solid stack changes.
//! WebGL transforms and shades the retained vertex buffer during orbiting.
use crate::engine::{COLORS, State, bits, xyz};
type V = [f32; 3];
type NormalCache = std::collections::HashMap<[u32;3],V>;
// Smooth the occupied volume as a whole. Adjacent cell integrals telescope,
// avoiding raised seams where overlapping rounded boxes used to meet.
const SOFTNESS: f32 = 0.30;
const ISO: f32 = 0.65;
#[derive(Clone)]
struct CellVolume {
    center: V,
    shape_center: V,
    shape_half: V,
    corner_axis: Option<usize>,
    softness: f32,
    opening: f32,
    profile: f32,
    elbow: f32,
    scale: f32,
    hulls: Vec<(V,V)>,
}
// A separable, symmetric kernel preserves telescoping at joined cell faces.
// Its positive half has a superellipse profile: p near 1 gives a chamfer;
// larger p retains more of the square corner. Width sets the support separately.
fn integral(x: f32, width: f32, profile: f32) -> f32 {
    if x <= -width { return 0.; }
    if x >= width { return 1.; }
    let v=(-std::f32::consts::LN_2*(1.-x.abs()/width).powf(profile)).exp();
    if x>=0. {v} else {1.-v}
}
fn bevel_profile(x:f32,y:f32,width:f32,profile:f32)->f32 {
    let a=(x.abs()-(1.-width)).max(0.);
    let b=(y.abs()-(1.-width)).max(0.);
    (a.powf(profile)+b.powf(profile)).powf(1./profile)-width
}
fn field(p: V, boxes: &[CellVolume]) -> f32 {
    if let Some(b) = boxes.first().filter(|b| b.corner_axis.is_some()) {
        let axis=b.corner_axis.unwrap();
        let x=p[(axis+1)%3]-b.shape_center[(axis+1)%3];
        let y=p[(axis+2)%3]-b.shape_center[(axis+2)%3];
        let z=p[axis]-b.shape_center[axis];
        let exponent=4.;
        let radius=(x.abs().powf(exponent)+y.abs().powf(exponent)).powf(1./exponent);
        let major=(0.93+b.opening)*0.5;
        let tube=(0.93-b.opening)*0.5*b.scale;
        return bevel_profile((radius-major)/tube,z/(0.43*b.scale),b.softness*2.,b.profile);
    }
    // Generate thinner connected runs before meshing. A maximum of run
    // occupancies cannot inflate the missing quadrant at an elbow.
    if let Some(b)=boxes.first().filter(|b|b.scale<1.) {
        let width=b.softness*b.scale;
        // Bound the blend and avoid allocations in the field sampling loop.
        let k=0.12*b.elbow;
        let (sharp,smooth)=b.hulls.iter().map(|(lo,hi)| (0..3).map(|axis| {
            let inset=(1.-b.scale)*0.5;
            integral(p[axis]-lo[axis]-inset,width,b.profile)-integral(p[axis]-hi[axis]+inset,width,b.profile)
        }).product::<f32>()).fold((0.0_f32,0.0_f32),|(sharp,a),v| {
            let blend=if k<=0. {a.max(v)} else {a.max(v)+(k-(a-v).abs()).max(0.).powi(2)/(4.*k)};
            (sharp.max(v),blend)
        });
        return ISO-(sharp+(smooth-sharp)*b.elbow);
    }
    let filled = boxes.iter().map(|b| {
        (0..3).map(|k| {
            let x = p[k] - b.center[k];
            integral(x + 0.5, b.softness, b.profile) - integral(x - 0.5, b.softness, b.profile)
        }).product::<f32>()
    }).sum::<f32>();
    let filled=if let Some(b)=boxes.first().filter(|b| b.elbow<1.) {
        let sharp=b.hulls.iter().map(|(lo,hi)| (0..3).map(|k|
            integral(p[k]-lo[k],b.softness,b.profile)-integral(p[k]-hi[k],b.softness,b.profile)
        ).product::<f32>()).fold(0.,f32::max);
        sharp+(filled-sharp)*b.elbow
    } else {filled};
    // Disjoint pieces cannot overlap: their normalized occupancies sum to at
    // most one, and each surface requires more than half of that occupancy.
    // A piece-wide pressure profile bows broad faces without reintroducing
    // per-cell seams. The threshold is always >= 0.55, retaining separation.
    let dome = boxes.first().map_or(0., |b| {
        (0..3).map(|k| ((p[k]-b.shape_center[k])/b.shape_half[k]).powi(2)).sum::<f32>()
    });
    // Broad faces keep a gentle crown; the wider edge kernel carries the bevel.
    ISO + 0.08 * (dome - 1.) - filled
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
    let mut hulls=Vec::new();
    for a in &cells {for b in &cells {
        if (0..3).any(|k|a[k]>b[k]) {continue;}
        let mut full=true;
        for x in a[0]..=b[0] {for y in a[1]..=b[1] {for z in a[2]..=b[2] {
            if mask & (1 << (x*9+y*3+z))==0 {full=false;}
        }}}
        if full {hulls.push((a.map(|v|v as f32-1.5),b.map(|v|v as f32-0.5)));}
    }}
    let all=hulls.clone();
    hulls.retain(|(lo,hi)|!all.iter().any(|(a,b)|(a!=lo || b!=hi)&&(0..3).all(|k|a[k]<=lo[k]&&b[k]>=hi[k])));
    cells.into_iter().map(|cell| CellVolume {
        center: cell.map(|v| v as f32 - 1.), shape_center, shape_half, corner_axis: None, softness: SOFTNESS, opening: 0.24, profile: 2., elbow: 1., scale: 1., hulls: hulls.clone(),
    }).collect()
}
fn triangle(mut points: [V; 3], boxes: &[CellVolume], color: V, out: &mut Vec<f32>, cache: &mut NormalCache) {
    let mut normals=points.map(|p| *cache.entry(p.map(f32::to_bits)).or_insert_with(||normal(p,boxes)));
    let n:V=std::array::from_fn(|k|normals.iter().map(|v|v[k]).sum());
    let u: V = std::array::from_fn(|k| points[1][k] - points[0][k]);
    let v: V = std::array::from_fn(|k| points[2][k] - points[0][k]);
    let cross = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    ];
    if (0..3).map(|k| cross[k] * n[k]).sum::<f32>() < 0. {
        points.swap(1, 2);
        normals.swap(1,2);
    }
    for (p,n) in points.into_iter().zip(normals) {
        out.extend(p);
        out.extend(n);
        out.extend(color);
    }
}
// Periodic supertorus: rounded-square centerline and rounded-square tube.
// Unlike cutting a tiny hole into a coarse marching grid, both rims have
// regular tessellation and share the same continuous analytic surface.
fn corner_o_mesh(boxes: &[CellVolume], color: V, out: &mut Vec<f32>) {
    let mut normals=NormalCache::new();
    const A: usize=80;
    const B: usize=40;
    let b=&boxes[0];let axis=b.corner_axis.unwrap();
    let exponent=4.;
    let squircle=|angle:f32| {
        let (s,c)=angle.sin_cos();
        let scale=(s.abs().powf(exponent)+c.abs().powf(exponent)).powf(1./exponent);
        [c/scale,s/scale]
    };
    let points:Vec<V>=(0..A).flat_map(|i| {
        let d=squircle(i as f32*std::f32::consts::TAU/A as f32);
        (0..B).map(move |j| {
            let angle=j as f32*std::f32::consts::TAU/B as f32;
            let (sy,cx)=angle.sin_cos();
            let (mut lo,mut hi)=(0.,1.415);
            for _ in 0..22 {let mid=(lo+hi)*0.5;
                if bevel_profile(cx*mid,sy*mid,b.softness*2.,b.profile)>0. {hi=mid;}else{lo=mid;}
            }
            let tube=[cx*(lo+hi)*0.5,sy*(lo+hi)*0.5];
            let radius=(0.93+b.opening)*0.5+(0.93-b.opening)*0.5*b.scale*tube[0];
            let mut p=b.shape_center;
            p[(axis+1)%3]+=radius*d[0];p[(axis+2)%3]+=radius*d[1];
            p[axis]+=0.43*b.scale*tube[1];p
        })
    }).collect();
    for i in 0..A {for j in 0..B {
        let p=points[i*B+j];let q=points[((i+1)%A)*B+j];
        let r=points[((i+1)%A)*B+(j+1)%B];let s=points[i*B+(j+1)%B];
        triangle([p,q,r],boxes,color,out,&mut normals);triangle([p,r,s],boxes,color,out,&mut normals);
    }}
}
pub fn build(state: &State) -> Vec<f32> { build_styled(state, false) }
pub fn build_styled(state: &State, corner_o: bool) -> Vec<f32> {
    build_tuned(state, corner_o, SOFTNESS, 0.24)
}
pub fn build_tuned(state: &State, corner_o: bool, softness: f32, opening: f32) -> Vec<f32> {
    build_profiled(state,corner_o,softness,opening,2.)
}
pub fn build_profiled(state: &State, corner_o: bool, softness: f32, opening: f32, profile: f32) -> Vec<f32> {
    build_elbows(state,corner_o,softness,opening,profile,1.)
}
pub fn build_elbows(state: &State, corner_o: bool, softness: f32, opening: f32, profile: f32, elbow: f32) -> Vec<f32> {
    build_sized(state,corner_o,softness,opening,profile,elbow,1.)
}
pub fn build_sized(state: &State, corner_o: bool, softness: f32, opening: f32, profile: f32, elbow: f32, scale: f32) -> Vec<f32> {
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
    // Fine sampling resolves narrow bevels at the square end of the profile range.
    let step: f32 = (if profile>3. || softness<0.24 {0.09} else {0.12}) * scale.clamp(0.4,1.);
    for g in state.groups() {
        let mut boxes = boxes(g.mask);
        for b in &mut boxes { b.softness=softness.clamp(0.15,0.48); b.opening=opening.clamp(0.18,0.40); b.profile=profile.clamp(1.05,6.); b.elbow=elbow.clamp(0.,1.); b.scale=scale.clamp(0.4,1.); }
        if corner_o && boxes.len()==4 {
            let half=boxes[0].shape_half;
            if half.iter().filter(|&&v| v==1.).count()==2 && half.contains(&0.5) {
                let axis=half.iter().position(|&v| v==0.5);
                for b in &mut boxes { b.corner_axis=axis; }
            }
        }
        if boxes[0].corner_axis.is_some() {
            corner_o_mesh(&boxes,COLORS[g.color as usize-1],&mut out);
            continue;
        }
        let mut normals=NormalCache::new();
        let mut edges=std::collections::HashMap::<(usize,usize),V>::new();
        let cells = bits(g.mask).map(xyz).collect::<Vec<_>>();
        let lo: V = std::array::from_fn(|k| cells.iter().map(|p| p[k]).min().unwrap() as f32 - 1.6);
        let n: [usize; 3] = std::array::from_fn(|k| {
            ((cells.iter().map(|p| p[k]).max().unwrap() as f32 - 0.4 - lo[k]) / step).ceil()
                as usize
        });
        let key = |x: usize, y: usize, z: usize| (x * (n[1] + 1) + y) * (n[2] + 1) + z;
        let position = |x: usize, y: usize, z: usize| {
            [
                lo[0] + x as f32 * step,
                lo[1] + y as f32 * step,
                lo[2] + z as f32 * step,
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
                    let indices:[usize;8]=std::array::from_fn(|i|key(x+CORNERS[i][0],y+CORNERS[i][1],z+CORNERS[i][2]));
                    let mut edge = |a: usize, b: usize| {
                        let edge_key=(indices[a].min(indices[b]),indices[a].max(indices[b]));
                        if let Some(p)=edges.get(&edge_key){return *p;}

                        // Refine on the shared edge so normals are sampled on
                        // the actual curved surface, not a linear approximation.
                        let (mut lo, mut hi) = (0., 1.);
                        let (mut dl, mut dh) = (d[a], d[b]);
                        for _ in 0..10 {
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
                        let p=std::array::from_fn(|k| {
                            vertices[a][k] + (vertices[b][k] - vertices[a][k]) * t
                        });
                        edges.insert(edge_key,p);p
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
                                &mut out, &mut normals,
                            ),
                            3 => triangle(
                                [
                                    edge(outside[0], inside[0]),
                                    edge(outside[0], inside[1]),
                                    edge(outside[0], inside[2]),
                                ],
                                &boxes,
                                COLORS[g.color as usize - 1],
                                &mut out, &mut normals,
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
                                    &mut out, &mut normals,
                                );
                                triangle(
                                    [ad, bd, bc],
                                    &boxes,
                                    COLORS[g.color as usize - 1],
                                    &mut out, &mut normals,
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
    #[test]
    fn small_elbows_stay_inside_thin_runs_and_remain_joined() {
        use super::*;
        // L at the origin, along positive X and Y. The missing quadrant
        // must stay empty instead of growing a sheet toward the cell seam.
        for scale in [0.4,0.6,0.8] {for elbow in [0.,1.] {
            let mut volumes=boxes((1<<13)|(1<<22)|(1<<16));
            for b in &mut volumes {b.scale=scale;b.elbow=elbow;}
            assert!(field([0.45,0.45,0.],&volumes)>0.);
            assert!(field([0.5,0.,0.],&volumes)<0.);
            assert!(field([0.,0.5,0.],&volumes)<0.);
            assert!(field([0.,0.,0.],&volumes)<0.);
        }}
    }

    use super::*;
    #[test]
    fn bevel_controls_preserve_seams_and_piece_separation_at_extremes() {
        let mask=(1<<0)|(1<<1)|(1<<2)|(1<<5);
        for width in [0.15,0.30,0.48] {for profile in [1.05,2.,6.] {
            let mut a=boxes(mask);let mut b=boxes(((1<<27)-1)^mask);
            for cell in a.iter_mut().chain(b.iter_mut()) {cell.softness=width;cell.profile=profile;}
            assert!(field([-1.,-1.,-0.5],&a)<0.);
            for y in 0..25 {for z in 0..25 {
                let p=[-1.,-1.5+y as f32*0.12,-1.5+z as f32*0.12];
                assert!(field(p,&a)>=0. || field(p,&b)>=0.);
            }}
            for x in [-0.5,-0.25,0.,0.25,0.5] {
                assert!((integral(x,width,profile)+integral(-x,width,profile)-1.).abs()<1e-6);
            }
        }}
        // Increasing profile preserves a fuller corner without moving the
        // start of the rounded-rectangle bevel on either broad face.
        for width in [0.3,0.6,0.96] {
            for profile in [1.05,2.,6.] {assert!(bevel_profile(1.,1.-width,width,profile).abs()<1e-6);}
            assert!(bevel_profile(0.9,0.9,width,1.05)>bevel_profile(0.9,0.9,width,6.));
        }
    }
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
    #[test]
    fn corner_o_is_optional_seamless_and_cosmetic() {
        for cells in [[0,1,3,4],[0,1,9,10],[0,3,9,12]] {
            let mut s=State::empty(1);
            for i in cells {s.board[i]=1;s.ids[i]=1;}
            let ordinary=build(&s);
            assert_eq!(ordinary,build_styled(&s,false));
            let rounded=build_styled(&s,true);
            assert_ne!(ordinary,rounded);
            assert!(rounded.iter().all(|x|x.is_finite()));
            let mut volume=boxes(cells.into_iter().fold(0,|m,i|m|(1<<i)));
            let axis=volume[0].shape_half.iter().position(|&v|v==0.5).unwrap();
            for b in &mut volume {b.corner_axis=Some(axis);}
            assert!(field(volume[0].shape_center,&volume)>0.);
            for v in rounded.chunks_exact(9) {
                assert!((v[3..6].iter().map(|n|n*n).sum::<f32>()-1.).abs()<0.002);
                assert!(field([v[0],v[1],v[2]],&volume).abs()<0.003);
            }
            assert_eq!(s.board.iter().filter(|&&v|v!=0).count(),4);
        }
        let mut l=State::empty(1);
        for i in [0,1,2,5]{l.board[i]=1;l.ids[i]=1;}
        assert_eq!(build(&l),build_styled(&l,true));
    }

    #[test]
    fn supertorus_is_watertight_without_polar_pinching() {
        let mut state=State::empty(1);
        for i in [0,1,3,4]{state.board[i]=1;state.ids[i]=1;}
        let mesh=build_styled(&state,true);
        let mut edges=std::collections::BTreeMap::new();
        for t in mesh.chunks_exact(27) {
            let p: [[f32;3];3]=std::array::from_fn(|i|[t[i*9],t[i*9+1],t[i*9+2]]);
            let u:V=std::array::from_fn(|i|p[1][i]-p[0][i]);
            let v:V=std::array::from_fn(|i|p[2][i]-p[0][i]);
            let cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
            assert!(cross.iter().map(|n|n*n).sum::<f32>()>1e-10);
            for (a,b) in [(0,1),(1,2),(2,0)] {
                let mut pair=[p[a].map(f32::to_bits),p[b].map(f32::to_bits)];pair.sort();
                *edges.entry(pair).or_insert(0)+=1;
            }
        }
        assert!(edges.values().all(|&n|n==2),"every edge joins exactly two triangles");
    }

}
