// Option dice se c'e' un nodo, Box lo tiene nell'heap.
struct Nodo {
    valore: i32,
    successivo: Option<Box<Nodo>>,
}

fn inserisci(testa: Option<Box<Nodo>>, valore: i32) -> Option<Box<Nodo>> {
    Some(Box::new(Nodo { valore, successivo: testa }))
}

fn main() {
    let mut testa = None;
    testa = inserisci(testa, 1);
    testa = inserisci(testa, 2);
    testa = inserisci(testa, 3);

    let mut valori = Vec::new();
    let mut corrente = &testa;
    while let Some(nodo) = corrente {
        valori.push(nodo.valore.to_string());
        corrente = &nodo.successivo;
    }
    println!("{}", valori.join(" "));
}
