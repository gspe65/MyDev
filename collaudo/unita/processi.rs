use std::sync::atomic::{AtomicBool, Ordering};

static ARRIVATO: AtomicBool = AtomicBool::new(false);

unsafe extern "C" {
    fn fork() -> i32;
    fn waitpid(pid: i32, stato: *mut i32, opzioni: i32) -> i32;
    fn _exit(codice: i32) -> !;
    fn signal(numero: i32, gestore: extern "C" fn(i32)) -> usize;
    fn alarm(secondi: u32) -> u32;
    fn pause() -> i32;
}

extern "C" fn al_segnale(_n: i32) {
    ARRIVATO.store(true, Ordering::SeqCst);
}

fn main() {
    let figlio = unsafe { fork() };
    if figlio == 0 {
        unsafe { _exit(7) };
    }
    let mut stato = 0;
    let atteso = unsafe { waitpid(figlio, &mut stato, 0) };
    println!(
        "atteso giusto {}, codice {}",
        atteso == figlio,
        (stato >> 8) & 0xff
    );
    unsafe {
        signal(14, al_segnale);
        alarm(1);
        pause();
    }
    println!("allarme arrivato {}", ARRIVATO.load(Ordering::SeqCst));
    let t = std::thread::spawn(|| 40 + 2);
    println!("thread {}", t.join().unwrap());
}
