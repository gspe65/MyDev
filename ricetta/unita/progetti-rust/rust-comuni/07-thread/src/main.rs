// 07 - Thread: quattro esecuzioni dentro lo STESSO programma
//
// Quattro thread aumentano lo stesso contatore. In C il mutex e il contatore
// sono due variabili separate, e tocca a te ricordarti di prendere il primo
// prima di toccare il secondo. Qui il contatore sta DENTRO il mutex: l'unico
// modo di arrivarci e' lock(), e il lucchetto si riapre da solo a fine istruzione.
//
// La libreria standard ha i thread: niente unsafe e niente pthread da dichiarare.

use std::process::ExitCode;
use std::sync::Mutex;
use std::thread;

const N_THREAD: usize = 4;
const GIRI: i64 = 100_000;

static CONTATORE: Mutex<i64> = Mutex::new(0); // condiviso da tutti i thread

// Questa funzione viene eseguita da ogni thread.
fn conta(id: usize) {
    for _ in 0..GIRI {
        *CONTATORE.lock().unwrap() += 1;
    }

    println!("  thread {id} ha finito");
}

fn main() -> ExitCode {
    println!("avvio {N_THREAD} thread, {GIRI} incrementi ciascuno");

    let operai: Vec<_> = (0..N_THREAD)
        .map(|id| thread::spawn(move || conta(id)))
        .collect();

    // join = aspetta che quel thread abbia finito
    for operaio in operai {
        operaio.join().unwrap();
    }

    let atteso = N_THREAD as i64 * GIRI;
    let contatore = *CONTATORE.lock().unwrap();
    println!("contatore = {contatore} (atteso {atteso})");

    if contatore == atteso {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}
