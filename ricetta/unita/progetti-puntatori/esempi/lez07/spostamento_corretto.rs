// Dopo lo spostamento si usa soltanto il nuovo proprietario.
fn main() {
    let a = Box::new(5);
    let b = a;
    println!("{}", b);
}
