// Dopo l'assegnazione il proprietario e' b: a non si puo' piu' usare.
fn main() {
    let a = Box::new(5);
    let b = a;
    println!("{} {}", a, b);
}
