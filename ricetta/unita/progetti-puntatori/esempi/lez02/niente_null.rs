// Un riferimento punta sempre a qualcosa: non puo' valere null.
fn main() {
    let p: &i32 = std::ptr::null();
    println!("{p}");
}
