// In Rust un indice negativo non si puo' scrivere: l'indice e' un usize.
fn main() {
    let conteggi = [0, 0, 0, 0];
    let i: i32 = -2;
    println!("{}", conteggi[i]);
}
