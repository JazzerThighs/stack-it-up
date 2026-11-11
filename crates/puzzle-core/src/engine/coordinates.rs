//! Rules ported from the supplied game. The internal face order is preserved;
//! presentation labels are U D F B R L (the historical x-axis label correction).

pub const FULL: u32 = (1 << 27) - 1;
pub use crate::pieces::CLASSIC_SHAPES as SHAPES;
pub const FACES: [(usize, i32); 6] = [(1, 2), (1, 0), (2, 0), (2, 2), (0, 0), (0, 2)];
pub const CLEAR_ORDER: [usize; 6] = [1, 2, 4, 3, 5, 0];
pub const COLORS: [[f32; 3]; 9] = [
    [1., 0.827, 0.361],
    [0.741, 0.549, 1.],
    [1., 0.671, 0.361],
    [0.392, 0.604, 1.],
    [0.384, 0.851, 0.678],
    [1., 0.443, 0.553],
    [0.6, 0.4, 0.2],
    [0.314, 0.314, 0.314],
    [0.784, 0.784, 0.784],
];
pub fn xyz(i: usize) -> [i32; 3] {
    [(i / 9) as i32, (i / 3 % 3) as i32, (i % 3) as i32]
}
pub fn idx(p: [i32; 3]) -> usize {
    (p[0] * 9 + p[1] * 3 + p[2]) as usize
}
pub fn kind(i: usize) -> usize {
    xyz(i).iter().filter(|&&v| v != 1).count()
}
pub fn cell(f: usize, u: i32, v: i32) -> usize {
    let u = 2 - u;
    idx(match f {
        0 => [u, 2, 2 - v],
        1 => [u, 0, v],
        2 => [u, 2 - v, 0],
        3 => [2 - u, 2 - v, 2],
        4 => [0, 2 - v, 2 - u],
        _ => [2, 2 - v, u],
    })
}
pub fn bits(mut mask: u32) -> impl Iterator<Item = usize> {
    std::iter::from_fn(move || {
        if mask == 0 {
            None
        } else {
            let i = mask.trailing_zeros() as usize;
            mask &= mask - 1;
            Some(i)
        }
    })
}
