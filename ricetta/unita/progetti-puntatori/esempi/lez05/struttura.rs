// impl raccoglie le funzioni della struct: &self legge, &mut self modifica.
struct Punto {
    x: i32,
    y: i32,
}

impl Punto {
    fn somma(&self) -> i32 {
        self.x + self.y
    }

    fn sposta(&mut self, passo: i32) {
        self.x += passo;
    }
}

fn main() {
    let mut p = Punto { x: 1, y: 2 };
    println!("{}", p.somma());
    p.sposta(10);
    println!("{}", p.somma());
}
