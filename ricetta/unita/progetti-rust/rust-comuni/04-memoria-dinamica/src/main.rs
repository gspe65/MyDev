// 04 - Memoria dinamica: Vec al posto di malloc, realloc e free
//
// Un array dichiarato normalmente ha dimensione decisa quando SCRIVI il
// programma. Con un Vec la decidi quando lo ESEGUI.
//
// Le tre regole del C qui sono del compilatore:
//   1. se la memoria finisce il programma si ferma: non c'e' un NULL da controllare
//   2. la memoria si restituisce da sola quando il Vec esce dal suo blocco
//   3. dopo la drop la variabile non esiste piu': usarla non compila

fn stampa(titolo: &str, v: &[i32]) {
    let valori: Vec<String> = v.iter().map(|x| x.to_string()).collect();
    println!(
        "{:<22} [{}]  ({} elementi)",
        titolo,
        valori.join(" "),
        v.len()
    );
}

fn main() {
    let n: usize = 5;

    // 1) chiedo memoria per n interi: e' la malloc
    let mut v: Vec<i32> = Vec::with_capacity(n);

    for i in 1..=n as i32 {
        v.push(i * 10);
    }
    stampa("dopo malloc:", &v);

    // 2) ne voglio il doppio: e' la realloc, e conserva quello che c'era gia'
    let nuovo = n * 2;
    v.reserve_exact(nuovo - n);

    for i in n as i32 + 1..=nuovo as i32 {
        v.push(i * 10);
    }
    stampa("dopo realloc:", &v);

    // 3) restituisco la memoria: e' la free, e da qui in poi v non si puo' piu' nominare
    drop(v);

    println!("memoria restituita.");
}
