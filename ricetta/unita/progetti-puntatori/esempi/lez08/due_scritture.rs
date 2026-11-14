// Un solo riferimento &mut alla volta.
fn main() {
    let mut x = 1;
    let a = &mut x;
    let b = &mut x;
    *a = 2;
    *b = 3;
}
