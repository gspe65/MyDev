// Un riferimento presta il valore: il proprietario resta lo stesso.
fn mostra(b: &Box<i32>) {
    println!("{}", b);
}

fn main() {
    let a = Box::new(5);
    mostra(&a);
    println!("{}", a);
}
