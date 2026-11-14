// Il Vec nasce nella funzione ed esce: la proprieta' passa a chi chiama.
fn primi_quadrati(quanti: i32) -> Vec<i32> {
    let mut v = Vec::new();
    for i in 1..=quanti {
        v.push(i * i);
    }
    v
}

fn main() {
    let v = primi_quadrati(4);
    println!("{} {}", v.len(), v[3]);
}
