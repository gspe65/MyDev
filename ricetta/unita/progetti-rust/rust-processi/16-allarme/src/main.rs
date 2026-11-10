// 16 - alarm(): mettere una scadenza a un'operazione
//
// alarm(n) chiede al sistema di mandarci un SIGALRM fra n secondi. E' il modo
// piu' semplice di dire "se entro tot non ho finito, interrompimi".
//
// Qui il programma finge un lavoro da 10 secondi ma si da' 3 secondi di
// tempo. Quando scatta l'allarme, il gestore alza la bandierina e la sleep
// viene interrotta.
//
// Nota: qui il gestore NON ha SA_RESTART, che non cambierebbe nulla: riprende
// una read o una write interrotte, ma una sleep si interrompe comunque.

use std::ffi::{c_int, c_uint};
use std::io;
use std::process::ExitCode;
use std::ptr;
use std::sync::atomic::{AtomicBool, Ordering};

const SIGALRM: c_int = 14;
const TEMPO_MASSIMO: c_uint = 3;
const LAVORO_LUNGO: c_uint = 10;

#[repr(C)]
struct Sigaction {
    sa_handler: extern "C" fn(c_int),
    sa_mask: u64,
    sa_flags: c_int,
}

unsafe extern "C" {
    fn sigaction(segnale: c_int, nuova: *const Sigaction, vecchia: *mut Sigaction) -> c_int;
    fn sigemptyset(insieme: *mut u64) -> c_int;
    fn alarm(secondi: c_uint) -> c_uint;
    fn sleep(secondi: c_uint) -> c_uint;
}

static SCADUTO: AtomicBool = AtomicBool::new(false);

extern "C" fn gestore(_segnale: c_int) {
    SCADUTO.store(true, Ordering::SeqCst);
}

fn main() -> ExitCode {
    let mut sa = Sigaction {
        sa_handler: gestore,
        sa_mask: 0,
        sa_flags: 0, // niente SA_RESTART: vogliamo interrompere
    };

    unsafe { sigemptyset(&mut sa.sa_mask) };

    if unsafe { sigaction(SIGALRM, &sa, ptr::null_mut()) } < 0 {
        eprintln!("sigaction: {}", io::Error::last_os_error());
        return ExitCode::FAILURE;
    }

    println!(
        "il lavoro durerebbe {LAVORO_LUNGO} secondi, ma mi do' {TEMPO_MASSIMO} secondi di tempo"
    );

    unsafe { alarm(TEMPO_MASSIMO) }; // la sveglia parte adesso

    // il "lavoro lungo": dormo, e verro' svegliato dall'allarme.
    // sleep torna i secondi che mancavano quando e' stata interrotta.
    let restanti = unsafe { sleep(LAVORO_LUNGO) };

    if SCADUTO.load(Ordering::SeqCst) {
        println!("\nTEMPO SCADUTO dopo {TEMPO_MASSIMO} secondi.");
        println!("Al lavoro mancavano ancora {restanti} secondi.");
        return ExitCode::FAILURE;
    }

    unsafe { alarm(0) }; // finito in tempo: disdico la sveglia
    println!("\nfinito prima della scadenza.");
    ExitCode::SUCCESS
}
