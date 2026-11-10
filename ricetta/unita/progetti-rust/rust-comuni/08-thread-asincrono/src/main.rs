// 08 - Asincronia con i thread: non stare fermo ad aspettare
//
// "Asincrono" vuol dire: faccio partire un lavoro lungo e NON mi blocco ad
// aspettarlo; intanto faccio altro, e ogni tanto controllo a che punto e'.
//
// Qui un thread "operaio" finge di scaricare un file (dieci passi da mezzo
// secondo). Il thread principale intanto disegna la barra di avanzamento.
// Alla fine il join aspetta l'operaio: quello e' l'unico momento in cui il
// programma si ferma davvero.
//
// La percentuale la scrive l'operaio e la legge il principale: sta dentro il
// mutex, come il contatore del progetto 07.

use std::io::{self, Write};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

const PASSI: i32 = 10;

struct Avanzamento {
    percentuale: i32,
    finito: bool,
}

static STATO: Mutex<Avanzamento> = Mutex::new(Avanzamento {
    percentuale: 0,
    finito: false,
});

fn operaio() {
    for i in 1..=PASSI {
        thread::sleep(Duration::from_millis(500)); // mezzo secondo di finto lavoro

        STATO.lock().unwrap().percentuale = i * 100 / PASSI;
    }

    STATO.lock().unwrap().finito = true;
}

fn main() {
    println!("faccio partire il lavoro e NON mi blocco\n");

    let lavoro = thread::spawn(operaio);

    // Il thread principale continua a lavorare mentre l'operaio va avanti
    loop {
        // prendo una copia e rilascio subito il lucchetto
        let (p, f) = {
            let s = STATO.lock().unwrap();
            (s.percentuale, s.finito)
        };

        let barra: String = (0..20).map(|i| if i < p / 5 { '#' } else { '.' }).collect();
        print!("\r  avanzamento: [{barra}] {p:3}%");
        io::stdout().flush().unwrap(); // senza questo la riga non si vede subito:
        // \r non manda a capo e il buffer resta pieno

        if f {
            break;
        }

        thread::sleep(Duration::from_millis(100)); // controllo dieci volte al secondo
    }

    lavoro.join().unwrap(); // qui, e solo qui, aspetto davvero

    println!("\n\nlavoro finito.");
}
