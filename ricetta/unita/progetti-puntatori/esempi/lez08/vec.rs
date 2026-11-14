// Vec cresce da solo, come il buffer con realloc.
fn main() {
    let mut v = Vec::new();
    v.push(1);
    v.push(2);
    v.push(3);
    println!("{}", v.len());
    println!("{} {} {}", v[0], v[1], v[2]);
}
