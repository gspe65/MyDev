// Il riferimento non si usa piu' dopo la stampa: ora push si puo' fare.
fn main() {
    let mut v = vec![1, 2, 3];
    let primo = &v[0];
    println!("{primo}");
    v.push(4);
    println!("{}", v.len());
}
