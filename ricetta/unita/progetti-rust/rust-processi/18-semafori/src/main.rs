// 18 - Semafori fra processi: la mutua esclusione senza thread
//
// Questo programma e' il gemello del progetto 07, ma con i PROCESSI al posto
// dei thread. Vale la pena aprirli affiancati: il Mutex di Rust non attraversa
// una fork, e qui il compilatore non protegge piu' nulla.
//
//   progetto 07:  thread   +  Mutex
//   progetto 18:  processi +  semaforo in memoria condivisa
//
// Due processi aumentano lo stesso contatore, che sta in memoria condivisa.
// Il semaforo inizializzato a 1 fa da lucchetto: sem_wait entra (e
// decrementa), sem_post esce (e incrementa). Se e' gia' a 0, chi arriva
// aspetta.
//
// Il secondo argomento di sem_init e' quello che conta: 1 = "questo semaforo
// e' condiviso fra PROCESSI, non solo fra thread".

use std::ffi::{c_int, c_uint, c_void};
use std::io;
use std::mem;
use std::process::ExitCode;
use std::ptr;

const GIRI: i64 = 50_000;
const PROT_READ: c_int = 1;
const PROT_WRITE: c_int = 2;
const MAP_SHARED: c_int = 1;
const MAP_ANONYMOUS: c_int = 32;

// Su questa piattaforma sem_t occupa 8 byte (misurato): e' un puntatore.
type SemT = *mut c_void;

#[repr(C)]
struct Condiviso {
    lucchetto: SemT,
    contatore: i64,
}

unsafe extern "C" {
    fn mmap(
        indirizzo: *mut c_void,
        quanti: usize,
        protezione: c_int,
        opzioni: c_int,
        canale: c_int,
        scostamento: i64,
    ) -> *mut c_void;
    fn munmap(indirizzo: *mut c_void, quanti: usize) -> c_int;
    fn sem_init(semaforo: *mut SemT, fra_processi: c_int, valore: c_uint) -> c_int;
    fn sem_wait(semaforo: *mut SemT) -> c_int;
    fn sem_post(semaforo: *mut SemT) -> c_int;
    fn sem_destroy(semaforo: *mut SemT) -> c_int;
    fn fork() -> c_int;
    fn wait(stato: *mut c_int) -> c_int;
    fn _exit(valore: c_int) -> !;
}

fn lavora(c: *mut Condiviso, chi: &str, usa_lucchetto: bool) {
    for _ in 0..GIRI {
        // SICUREZZA: c punta alla pagina di mmap, viva finche' i due processi
        // lavorano. Senza lucchetto questo incremento e' proprio l'errore che il
        // programma vuole mostrare: due processi leggono e riscrivono insieme.
        // volatile impedisce al compilatore di fondere i giri in una somma
        // sola, che nasconderebbe la gara.
        unsafe {
            if usa_lucchetto {
                sem_wait(&raw mut (*c).lucchetto); // entro, o aspetto
            }

            let contatore = &raw mut (*c).contatore;
            contatore.write_volatile(contatore.read_volatile() + 1);

            if usa_lucchetto {
                sem_post(&raw mut (*c).lucchetto); // esco e lascio passare
            }
        }
    }
    println!("  {chi} ha finito i suoi {GIRI} incrementi");
}

fn prova(usa_lucchetto: bool) -> i64 {
    let quanti = mem::size_of::<Condiviso>();
    let pagina = unsafe {
        mmap(
            ptr::null_mut(),
            quanti,
            PROT_READ | PROT_WRITE,
            MAP_SHARED | MAP_ANONYMOUS,
            -1,
            0,
        )
    };
    if pagina as isize == -1 {
        eprintln!("mmap: {}", io::Error::last_os_error());
        return -1;
    }
    let c = pagina.cast::<Condiviso>();

    unsafe {
        (*c).contatore = 0;

        // 1 = condiviso fra processi ; 1 = valore iniziale (lucchetto aperto)
        if sem_init(&raw mut (*c).lucchetto, 1, 1) < 0 {
            eprintln!("sem_init: {}", io::Error::last_os_error());
            munmap(pagina, quanti);
            return -1;
        }
    }

    let f = unsafe { fork() };
    if f < 0 {
        eprintln!("fork: {}", io::Error::last_os_error());
        unsafe { munmap(pagina, quanti) };
        return -1;
    }

    if f == 0 {
        lavora(c, "[figlio]", usa_lucchetto);
        unsafe { _exit(0) };
    }

    lavora(c, "[padre] ", usa_lucchetto);

    unsafe {
        wait(ptr::null_mut());

        let risultato = (*c).contatore;

        sem_destroy(&raw mut (*c).lucchetto);
        munmap(pagina, quanti);
        risultato
    }
}

fn main() -> ExitCode {
    let atteso = 2 * GIRI;

    println!("=== SENZA semaforo ===");
    let senza = prova(false);
    let nota = if senza == atteso {
        ""
    } else {
        "<- MANCANO INCREMENTI"
    };
    println!("  contatore = {senza}   (atteso {atteso})  {nota}\n");

    println!("=== CON semaforo ===");
    let con = prova(true);
    let nota = if con == atteso {
        "corretto"
    } else {
        "<- ANCORA SBAGLIATO"
    };
    println!("  contatore = {con}   (atteso {atteso})  {nota}");

    if con == atteso {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}
