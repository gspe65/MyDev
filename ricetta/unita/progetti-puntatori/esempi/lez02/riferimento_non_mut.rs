// La funzione chiede &mut: un riferimento semplice non basta.
fn azzera(a: &mut i32) {
    *a = 0;
}

fn main() {
    let mut a = 1;
    azzera(&a);
    a += 1;
    println!("{a}");
}
