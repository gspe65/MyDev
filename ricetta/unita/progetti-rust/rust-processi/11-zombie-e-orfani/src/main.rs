// 11 - Zombie e orfani: cosa succede se non aspetti i figli
//
// ZOMBIE: il figlio finisce, ma il padre non ha ancora chiamato wait().
//   Il sistema non puo' buttare via del tutto il figlio, perche' deve ancora
//   consegnare al padre il suo valore di uscita: resta una voce nella tabella
//   dei processi, senza memoria e senza codice. Sparisce nell'istante in cui
//   il padre chiama wait().
//
// ORFANO: il padre finisce prima del figlio.
//   Il figlio non muore: viene adottato da un altro processo, e il suo
//   getppid() cambia. Quel nuovo padre chiamera' wait() al posto suo, cosi'
//   l'orfano non diventera' mai uno zombie eterno.
//
// Morale: ogni fork vuole il suo wait.

use std::ffi::{c_int, c_uint};
use std::io;

unsafe extern "C" {
    fn fork() -> c_int;
    fn getpid() -> c_int;
    fn getppid() -> c_int;
    fn sleep(secondi: c_uint) -> c_uint;
    fn wait(stato: *mut c_int) -> c_int;
    fn _exit(valore: c_int) -> !;
}

fn parte_zombie() {
    println!("=== ZOMBIE ===");

    let f = unsafe { fork() };
    if f < 0 {
        eprintln!("fork: {}", io::Error::last_os_error());
        return;
    }

    if f == 0 {
        println!("  [figlio {}] finisco subito", unsafe { getpid() });
        unsafe { _exit(0) };
    }

    unsafe { sleep(1) }; // il figlio e' gia' morto, ma io non l'ho ancora aspettato

    println!("  [padre] il figlio {f} e' morto un secondo fa e io non l'ho");
    println!("          ancora aspettato: adesso e' uno ZOMBIE.");
    println!("          Da un altro terminale lo vedresti con:  ps");

    let mut stato: c_int = 0;
    unsafe { wait(&mut stato) };
    println!("  [padre] ho chiamato wait(): lo zombie e' sparito\n");
}

fn parte_orfano() {
    println!("=== ORFANO ===");

    let f = unsafe { fork() };
    if f < 0 {
        eprintln!("fork: {}", io::Error::last_os_error());
        return;
    }

    if f == 0 {
        println!(
            "  [figlio {}] mio padre adesso e' {}",
            unsafe { getpid() },
            unsafe { getppid() }
        );

        unsafe { sleep(2) }; // nel frattempo il padre se ne va

        println!(
            "  [figlio {}] mio padre adesso e' {}  <- sono stato adottato",
            unsafe { getpid() },
            unsafe { getppid() }
        );
        unsafe { _exit(0) };
    }

    println!(
        "  [padre {}] esco subito, senza aspettare il figlio",
        unsafe { getpid() }
    );
}

fn main() {
    parte_zombie();
    parte_orfano();

    // Il main finisce qui: il figlio della seconda parte resta vivo ancora
    // un paio di secondi e stampa la sua seconda riga da orfano.
    println!("[main] il programma principale termina.");
}
