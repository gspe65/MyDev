// &mut e' un riferimento con cui si puo' scrivere.
fn scambia(a: &mut i32, b: &mut i32) {
    let temporanea = *a;
    *a = *b;
    *b = temporanea;
}

fn main() {
    let mut a = 1;
    let mut b = 2;
    scambia(&mut a, &mut b);
    println!("a={a} b={b}");
}
