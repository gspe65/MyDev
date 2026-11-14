// La doppia free non si puo' scrivere: dopo drop il valore non c'e' piu'.
fn main() {
    let a = Box::new(5);
    drop(a);
    drop(a);
}
