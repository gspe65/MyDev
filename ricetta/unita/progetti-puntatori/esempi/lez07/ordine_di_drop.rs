// Alla fine del blocco i valori si liberano in ordine inverso.
struct Risorsa {
    numero: i32,
}

impl Drop for Risorsa {
    fn drop(&mut self) {
        println!("libero {}", self.numero);
    }
}

fn main() {
    println!("inizio");
    let _prima = Risorsa { numero: 1 };
    let _seconda = Risorsa { numero: 2 };
    println!("fine");
}
