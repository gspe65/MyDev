// push potrebbe spostare il blocco: il riferimento al primo elemento non varrebbe piu'.
fn main() {
    let mut v = vec![1, 2, 3];
    let primo = &v[0];
    v.push(4);
    println!("{primo}");
}
