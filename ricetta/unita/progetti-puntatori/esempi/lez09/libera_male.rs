// L'errore del programma C: dopo drop il nodo non si puo' piu' usare.
struct Nodo {
    successivo: Option<Box<Nodo>>,
}

fn main() {
    let nodo = Box::new(Nodo { successivo: None });
    drop(nodo);
    let dopo = nodo.successivo;
    println!("{}", dopo.is_none());
}
