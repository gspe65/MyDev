// 15 - Segnali: essere interrotti senza morire
//
// Un segnale arriva quando vuole lui, nel mezzo di qualunque istruzione.
// Per questo il gestore deve fare pochissimo: qui si limita ad alzare una
// bandierina, e il lavoro vero lo fa il ciclo principale.
//
// Il C usa `volatile sig_atomic_t`. Rust ha i tipi Atomic: una lettura o una
// scrittura non si spezzano a meta', e il compilatore non puo' farle sparire.

use std::ffi::{c_int, c_uint};
use std::io;
use std::process::ExitCode;
use std::ptr;
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};

const SIGINT: c_int = 2;
const SIGUSR1: c_int = 30; // su questa piattaforma: su Linux vale 10
const SA_RESTART: c_int = 0x1000_0000;

// La stessa disposizione della struct sigaction di questa piattaforma, misurata
// sul compilatore C: 24 byte, con il campo sa_mask a 8 e sa_flags a 16.
#[repr(C)]
struct Sigaction {
    sa_handler: extern "C" fn(c_int),
    sa_mask: u64,
    sa_flags: c_int,
}

unsafe extern "C" {
    fn sigaction(segnale: c_int, nuova: *const Sigaction, vecchia: *mut Sigaction) -> c_int;
    fn sigemptyset(insieme: *mut u64) -> c_int;
    fn kill(processo: c_int, segnale: c_int) -> c_int;
    fn getpid() -> c_int;
    fn sleep(secondi: c_uint) -> c_uint;
}

static INTERRUZIONI: AtomicI32 = AtomicI32::new(0);
static RICEVUTO_USR1: AtomicBool = AtomicBool::new(false);

// extern "C": la chiama il sistema, che parla la convenzione del C
extern "C" fn gestore(segnale: c_int) {
    if segnale == SIGINT {
        INTERRUZIONI.fetch_add(1, Ordering::SeqCst);
    } else if segnale == SIGUSR1 {
        RICEVUTO_USR1.store(true, Ordering::SeqCst);
    }
}

fn installa(segnale: c_int) -> bool {
    let mut sa = Sigaction {
        sa_handler: gestore,
        sa_mask: 0,
        sa_flags: SA_RESTART, // riprende le chiamate interrotte
    };

    unsafe { sigemptyset(&mut sa.sa_mask) }; // nessun altro segnale bloccato nel gestore

    if unsafe { sigaction(segnale, &sa, ptr::null_mut()) } < 0 {
        eprintln!("sigaction: {}", io::Error::last_os_error());
        return false;
    }
    true
}

fn main() -> ExitCode {
    if !installa(SIGINT) || !installa(SIGUSR1) {
        return ExitCode::FAILURE;
    }

    // 1) un segnale che il programma manda a se stesso
    println!("mi mando un SIGUSR1...");
    unsafe {
        kill(getpid(), SIGUSR1);
        sleep(1);
    }
    let visto = if RICEVUTO_USR1.load(Ordering::SeqCst) {
        "si"
    } else {
        "no"
    };
    println!("SIGUSR1 ricevuto: {visto}");

    // 2) un segnale che arriva dalla tastiera
    println!(
        "\nsono il processo {}. Ora premi Ctrl+C. Al terzo esco.",
        unsafe { getpid() }
    );

    while INTERRUZIONI.load(Ordering::SeqCst) < 3 {
        println!(
            "  ...sto lavorando (Ctrl+C ricevuti: {})",
            INTERRUZIONI.load(Ordering::SeqCst)
        );

        unsafe { sleep(1) };
    }

    println!("\ntre interruzioni, esco con calma.");
    ExitCode::SUCCESS
}
