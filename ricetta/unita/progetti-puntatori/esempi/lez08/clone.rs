// clone chiede un blocco nuovo: due proprietari, due blocchi.
fn main() {
    let a = Box::new(5);
    let b = a.clone();
    println!("{a} {b}");
}
