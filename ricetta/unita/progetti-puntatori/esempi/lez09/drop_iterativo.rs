// Scrivendo Drop con un ciclo si libera un nodo alla volta.
struct Nodo {
    successivo: Option<Box<Nodo>>,
}

struct Lista {
    testa: Option<Box<Nodo>>,
}

impl Drop for Lista {
    fn drop(&mut self) {
        let mut corrente = self.testa.take();
        while let Some(mut nodo) = corrente {
            corrente = nodo.successivo.take();
        }
    }
}

fn main() {
    let mut lista = Lista { testa: None };
    for _ in 0..1_000_000 {
        lista.testa = Some(Box::new(Nodo { successivo: lista.testa.take() }));
    }
    drop(lista);
    println!("lista liberata");
}
