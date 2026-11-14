// Il Drop automatico chiama se stesso per ogni nodo: una lista lunga esaurisce lo stack.
struct Nodo {
    _successivo: Option<Box<Nodo>>,
}

fn main() {
    let mut testa = None;
    for _ in 0..1_000_000 {
        testa = Some(Box::new(Nodo { _successivo: testa }));
    }
    println!("lista creata");
}
