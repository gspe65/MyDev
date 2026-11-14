// replace mette un valore nuovo al posto del vecchio e restituisce il vecchio.
use std::mem;

struct Tabella {
    bucket: Vec<String>,
}

impl Tabella {
    fn rinnova(&mut self, nuovi: Vec<String>) -> Vec<String> {
        mem::replace(&mut self.bucket, nuovi)
    }
}

fn main() {
    let mut t = Tabella { bucket: vec!["a".to_string(), "b".to_string()] };
    let vecchi = t.rinnova(vec!["c".to_string()]);
    println!("vecchi: {}", vecchi.len());
    println!("ora: {}", t.bucket.len());
}
