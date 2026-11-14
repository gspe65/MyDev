// Con un riferimento semplice si legge soltanto.
fn azzera(a: &i32) {
    *a = 0;
}

fn main() {
    let a = 1;
    azzera(&a);
    println!("{a}");
}
