// Passare una Box per valore la sposta dentro la funzione.
fn mostra(b: Box<i32>) {
    println!("{}", b);
}

fn main() {
    let a = Box::new(5);
    mostra(a);
    println!("{}", a);
}
