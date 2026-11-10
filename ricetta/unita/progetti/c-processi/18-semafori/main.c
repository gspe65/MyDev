/* 18 - Semafori fra processi: la mutua esclusione senza thread
 *
 * SOLO con gcc.
 *
 * Questo programma e' il gemello esatto del progetto 07, ma con i PROCESSI al
 * posto dei thread. Vale la pena aprirli affiancati.
 *
 *   progetto 07:  thread   +  pthread_mutex
 *   progetto 18:  processi +  semaforo in memoria condivisa
 *
 * Due processi aumentano lo stesso contatore, che sta in memoria condivisa.
 * Il semaforo inizializzato a 1 fa da lucchetto: sem_wait entra (e
 * decrementa), sem_post esce (e incrementa). Se e' gia' a 0, chi arriva
 * aspetta.
 *
 * Il secondo argomento di sem_init e' quello che conta: 1 = "questo semaforo
 * e' condiviso fra PROCESSI, non solo fra thread". Con 0 non funzionerebbe.
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <unistd.h>
#include <semaphore.h>
#include <sys/mman.h>
#include <sys/wait.h>

#define GIRI 50000

struct condiviso {
    sem_t lucchetto;
    long  contatore;
};

static void lavora(struct condiviso *c, const char *chi, int usa_lucchetto)
{
    for (int i = 0; i < GIRI; i++) {
        if (usa_lucchetto)
            sem_wait(&c->lucchetto);      /* entro, o aspetto */

        c->contatore++;

        if (usa_lucchetto)
            sem_post(&c->lucchetto);      /* esco e lascio passare */
    }
    printf("  %s ha finito i suoi %d incrementi\n", chi, GIRI);
    fflush(stdout);
}

static long prova(int usa_lucchetto)
{
    struct condiviso *c = mmap(NULL, sizeof *c,
                               PROT_READ | PROT_WRITE,
                               MAP_SHARED | MAP_ANONYMOUS, -1, 0);
    if (c == MAP_FAILED) {
        perror("mmap");
        return -1;
    }

    c->contatore = 0;

    /* 1 = condiviso fra processi ; 1 = valore iniziale (lucchetto aperto) */
    if (sem_init(&c->lucchetto, 1, 1) < 0) {
        perror("sem_init");
        munmap(c, sizeof *c);
        return -1;
    }

    fflush(stdout);   /* svuota il buffer PRIMA della fork: senza, mandando
                         l'output in un file il figlio ristampa le righe
                         gia' scritte dal padre (vedi progetto 10) */

    pid_t f = fork();
    if (f < 0) {
        perror("fork");
        munmap(c, sizeof *c);
        return -1;
    }

    if (f == 0) {
        lavora(c, "[figlio]", usa_lucchetto);
        _exit(0);
    }

    lavora(c, "[padre] ", usa_lucchetto);
    wait(NULL);

    long risultato = c->contatore;

    sem_destroy(&c->lucchetto);
    munmap(c, sizeof *c);
    return risultato;
}

int main(void)
{
    long atteso = 2L * GIRI;

    printf("=== SENZA semaforo ===\n");
    long senza = prova(0);
    printf("  contatore = %ld   (atteso %ld)  %s\n\n",
           senza, atteso, senza == atteso ? "" : "<- MANCANO INCREMENTI");

    printf("=== CON semaforo ===\n");
    long con = prova(1);
    printf("  contatore = %ld   (atteso %ld)  %s\n",
           con, atteso, con == atteso ? "corretto" : "<- ANCORA SBAGLIATO");

    return con == atteso ? 0 : 1;
}
