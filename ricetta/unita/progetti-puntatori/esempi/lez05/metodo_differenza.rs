// Un metodo che legge soltanto i campi riceve &self: la variabile non deve essere mut.
struct Punto {
    x: i32,
    y: i32,
}

impl Punto {
    fn somma(&self) -> i32 {
        self.x + self.y
    }

    fn differenza(&self) -> i32 {
        self.x - self.y
    }
}

fn main() {
    let p = Punto { x: 7, y: 2 };
    println!("{}", p.somma());
    println!("{}", p.differenza());
}
