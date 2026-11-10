// 10 - fork(): un processo diventa due
//
// fork() e' l'unica funzione che si chiama UNA volta e da cui si torna DUE
// volte: una nel padre, una nel figlio. Da quel momento sono due programmi
// separati che eseguono lo stesso codice.
//
// Il valore restituito e' l'unico modo per capire dove ci si trova:
//
//     > 0   sei il PADRE, e il numero e' il PID del figlio
//     = 0   sei il FIGLIO
//     < 0   la fork e' fallita
//
// La libreria standard di Rust non ha fork: duplica un programma che lei non
// controlla, e nessuna delle sue garanzie puo' attraversare quel punto. Si
// chiama quella del sistema, e ogni chiamata porta la parola `unsafe`.

use std::ffi::{c_int, c_uint};
use std::io;
use std::process::ExitCode;

unsafe extern "C" {
    fn fork() -> c_int;
    fn getpid() -> c_int;
    fn getppid() -> c_int;
    fn sleep(secondi: c_uint) -> c_uint;
    fn wait(stato: *mut c_int) -> c_int;
    fn _exit(valore: c_int) -> !;
}

// In C sono le macro WIFEXITED e WEXITSTATUS di <sys/wait.h>.
fn e_uscito(stato: c_int) -> bool {
    stato & 0xff == 0
}

fn valore_di_uscita(stato: c_int) -> c_int {
    (stato >> 8) & 0xff
}

fn errore(cosa: &str) -> ExitCode {
    eprintln!("{cosa}: {}", io::Error::last_os_error());
    ExitCode::FAILURE
}

fn main() -> ExitCode {
    // println! svuota il buffer a ogni a-capo, anche verso un file: la riga non
    // resta nel buffer al momento della fork, e il fflush del C qui non serve.
    println!("prima della fork: sono il processo {}", unsafe { getpid() });

    let figlio = unsafe { fork() };

    if figlio < 0 {
        return errore("fork");
    }

    if figlio == 0 {
        // ---------- da qui in giu' siamo nel FIGLIO ----------
        println!(
            "  [figlio] sono {}, mio padre e' {}",
            unsafe { getpid() },
            unsafe { getppid() }
        );
        unsafe { sleep(1) };
        println!("  [figlio] esco con il valore 7");

        // _exit e non return: il figlio non deve rifare le pulizie di fine
        // programma gia' previste dal padre
        unsafe { _exit(7) };
    }

    // ---------- da qui in giu' siamo nel PADRE ----------
    println!("[padre] ho creato il figlio {figlio}, ora lo aspetto");

    let mut stato: c_int = 0;
    let finito = unsafe { wait(&mut stato) }; // si blocca finche' un figlio non finisce

    if finito < 0 {
        return errore("wait");
    }

    if e_uscito(stato) {
        println!(
            "[padre] il figlio {finito} e' uscito con {}",
            valore_di_uscita(stato)
        );
    } else {
        println!("[padre] il figlio {finito} e' finito male");
    }

    ExitCode::SUCCESS
}
