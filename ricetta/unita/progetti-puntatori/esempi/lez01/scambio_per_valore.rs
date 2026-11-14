// Anche in Rust una funzione riceve una copia di due interi.
fn scambia(mut a: i32, mut b: i32) {
    let temporanea = a;
    a = b;
    b = temporanea;
    println!("dentro: a={a} b={b}");
}

fn main() {
    let a = 1;
    let b = 2;
    scambia(a, b);
    println!("fuori: a={a} b={b}");
}
