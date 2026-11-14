// String possiede il suo testo e lo fa crescere.
fn main() {
    let mut s = String::from("ciao");
    s.push_str(" mondo");
    println!("{s}");
    println!("{}", s.len());
}
