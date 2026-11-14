// Da un valore in prestito non si puo' portare via un campo.
struct Tabella {
    bucket: Vec<String>,
}

impl Tabella {
    fn rinnova(&mut self, nuovi: Vec<String>) -> Vec<String> {
        let vecchi = self.bucket;
        self.bucket = nuovi;
        vecchi
    }
}

fn main() {
    let mut t = Tabella { bucket: Vec::new() };
    let vecchi = t.rinnova(Vec::new());
    println!("{}", vecchi.len());
}
