// 09 - Produttore e consumatore: la variabile di condizione
//
// Il mutex del progetto 07 risolve "non entrare mentre ci sono io".
// Non risolve "aspetta finche' non c'e' qualcosa da fare": per quello serve
// una variabile di condizione.
//
//     wait        dormi finche' qualcuno non mi sveglia
//                 (e intanto molla il lucchetto)
//     notify_one  sveglia uno che sta aspettando
//
// Qui il produttore mette numeri in un magazzino da 4 posti, il consumatore
// li prende. Se il magazzino e' pieno il produttore aspetta, se e' vuoto
// aspetta il consumatore.
//
// wait va SEMPRE dentro un while, mai dentro un if: al risveglio la condizione
// va ricontrollata, perche' potrebbe essere cambiata di nuovo. Rust non puo'
// impedirti questo errore.

use std::process::ExitCode;
use std::sync::{Condvar, Mutex};
use std::thread;

const POSTI: usize = 4;
const DA_FARE: i32 = 10;

struct Magazzino {
    celle: [i32; POSTI],
    quanti: usize, // quanti pezzi ci sono adesso
    entra: usize,  // dove scrive il produttore
    esce: usize,   // da dove legge il consumatore
}

static MAGAZZINO: Mutex<Magazzino> = Mutex::new(Magazzino {
    celle: [0; POSTI],
    quanti: 0,
    entra: 0,
    esce: 0,
});
static NON_PIENO: Condvar = Condvar::new();
static NON_VUOTO: Condvar = Condvar::new();

fn produttore() {
    for i in 1..=DA_FARE {
        let mut m = MAGAZZINO.lock().unwrap();

        while m.quanti == POSTI {
            // while, non if
            println!("  [produttore]  magazzino pieno, aspetto");
            m = NON_PIENO.wait(m).unwrap();
        }

        let posto = m.entra;
        m.celle[posto] = i;
        m.entra = (posto + 1) % POSTI;
        m.quanti += 1;
        println!(
            "  [produttore]  ho messo {i:2}   (in magazzino: {})",
            m.quanti
        );

        NON_VUOTO.notify_one(); // sveglia il consumatore
    } // qui m esce dal blocco e il lucchetto si riapre da solo
}

fn consumatore() {
    for _ in 0..DA_FARE {
        let mut m = MAGAZZINO.lock().unwrap();

        while m.quanti == 0 {
            println!("  [consumatore] magazzino vuoto, aspetto");
            m = NON_VUOTO.wait(m).unwrap();
        }

        let posto = m.esce;
        let pezzo = m.celle[posto];
        m.esce = (posto + 1) % POSTI;
        m.quanti -= 1;
        println!(
            "  [consumatore] ho preso {pezzo:2}  (in magazzino: {})",
            m.quanti
        );

        NON_PIENO.notify_one(); // sveglia il produttore
    }
}

fn main() -> ExitCode {
    println!("magazzino da {POSTI} posti, {DA_FARE} pezzi da produrre\n");

    let p = thread::spawn(produttore);
    let c = thread::spawn(consumatore);

    p.join().unwrap();
    c.join().unwrap();

    let rimasti = MAGAZZINO.lock().unwrap().quanti;
    println!("\nfinito. Pezzi rimasti in magazzino: {rimasti}");

    if rimasti == 0 {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}
