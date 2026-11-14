// La lunghezza e' quanti elementi ci sono, la capacita' quanti ne entrano.
fn main() {
    let mut v = Vec::new();
    for i in 1..=5 {
        v.push(i);
        println!("lunghezza {}, capacita {}", v.len(), v.capacity());
    }
}
