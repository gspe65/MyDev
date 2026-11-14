// Box mette il valore nell'heap e lo restituisce alla fine del blocco.
fn main() {
    let b = Box::new(5);
    println!("{}", *b + 1);
}
