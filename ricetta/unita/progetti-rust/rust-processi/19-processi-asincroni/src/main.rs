// 19 - Asincronia con i processi: tre figli, e nessuna attesa inutile
//
// E' il gemello del progetto 08, ma con i processi al posto dei thread.
//
// Il padre fa partire TRE figli che durano tempi diversi (3, 1 e 2 secondi)
// e poi NON si blocca: continua a fare il suo lavoro e ogni mezzo secondo
// chiede "e' finito qualcuno?" con
//
//     waitpid(-1, &mut stato, WNOHANG)
//
//   -1        qualunque figlio
//   WNOHANG   non bloccarti: se non e' finito nessuno, torna subito 0
//
// Risultato: i figli vengono raccolti nell'ordine in cui hanno finito
// DAVVERO (il secondo per primo, perche' dorme meno), non in quello in cui
// sono stati creati. Questa e' l'asincronia.

use std::ffi::{c_int, c_uint};
use std::io;
use std::process::ExitCode;
use std::thread;
use std::time::Duration;

const N_FIGLI: usize = 3;
const WNOHANG: c_int = 1;

unsafe extern "C" {
    fn fork() -> c_int;
    fn waitpid(figlio: c_int, stato: *mut c_int, opzioni: c_int) -> c_int;
    fn sleep(secondi: c_uint) -> c_uint;
    fn _exit(valore: c_int) -> !;
}

fn main() -> ExitCode {
    let durate: [c_uint; N_FIGLI] = [3, 1, 2]; // secondi di "lavoro"

    for (i, &durata) in durate.iter().enumerate() {
        let pid = unsafe { fork() };

        if pid < 0 {
            eprintln!("fork: {}", io::Error::last_os_error());
            return ExitCode::FAILURE;
        }

        if pid == 0 {
            // FIGLIO: dorme e se ne va
            unsafe {
                sleep(durata);
                _exit(10 + i as c_int); // valore di uscita riconoscibile
            }
        }

        println!("[padre] avviato figlio {i} (pid {pid}, durera' {durata} s)");
    }

    println!("\n[padre] tutti avviati. Intanto lavoro io.\n");

    let mut vivi = N_FIGLI;
    let mut giro = 0;

    while vivi > 0 {
        let mut stato: c_int = 0;

        // WNOHANG: chiedo e basta, non aspetto
        let finito = unsafe { waitpid(-1, &mut stato, WNOHANG) };

        if finito > 0 {
            println!(
                "  -> il figlio {finito} ha finito (valore {})",
                (stato >> 8) & 0xff
            );
            vivi -= 1;
        } else if finito < 0 {
            eprintln!("waitpid: {}", io::Error::last_os_error());
            break;
        } else {
            // nessuno ha finito: faccio il mio lavoro
            giro += 1;
            println!("  [padre] giro {giro}, ancora {vivi} figli al lavoro");
        }

        thread::sleep(Duration::from_millis(500)); // mezzo secondo
    }

    println!("\n[padre] tutti finiti dopo {giro} giri di lavoro mio.");
    ExitCode::SUCCESS
}
