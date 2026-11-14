// Una lista di numeri: si inserisce in testa, si contano i nodi, si toglie.
struct Nodo {
    valore: i32,
    successivo: Option<Box<Nodo>>,
}

struct Lista {
    testa: Option<Box<Nodo>>,
}

impl Lista {
    fn new() -> Lista {
        Lista { testa: None }
    }

    fn inserisci(&mut self, valore: i32) {
        let nuovo = Box::new(Nodo { valore, successivo: self.testa.take() });
        self.testa = Some(nuovo);
    }

    fn quanti(&self) -> i32 {
        let mut n = 0;
        let mut corrente = self.testa.as_deref();
        while let Some(nodo) = corrente {
            n += 1;
            corrente = nodo.successivo.as_deref();
        }
        n
    }

    fn togli(&mut self, valore: i32) -> bool {
        let mut posto = &mut self.testa;
        loop {
            match posto {
                None => return false,
                Some(nodo) if nodo.valore == valore => {
                    *posto = nodo.successivo.take();
                    return true;
                }
                Some(nodo) => posto = &mut nodo.successivo,
            }
        }
    }
}

fn main() {
    let mut lista = Lista::new();
    lista.inserisci(1);
    lista.inserisci(2);
    lista.inserisci(3);
    println!("{}", lista.quanti());
    println!("{}", lista.togli(2));
    println!("{}", lista.togli(9));
    println!("{}", lista.quanti());
}
