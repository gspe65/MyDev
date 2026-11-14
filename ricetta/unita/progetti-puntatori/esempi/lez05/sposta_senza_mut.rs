// Per chiamare un metodo con &mut self la variabile deve essere mut.
struct Punto {
    x: i32,
}

impl Punto {
    fn sposta(&mut self, passo: i32) {
        self.x += passo;
    }
}

fn main() {
    let p = Punto { x: 1 };
    p.sposta(10);
    println!("{}", p.x);
}
