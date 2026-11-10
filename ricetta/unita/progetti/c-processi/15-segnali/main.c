/* 15 - Segnali: essere interrotti senza morire
 *
 * SOLO con gcc.
 * Con clang <signal.h> esiste, ma contiene solo i sei segnali dello
 * standard C: sigaction, sigemptyset e SIGUSR1 non ci sono.
 *
 * Un segnale arriva quando vuole lui, nel mezzo di qualunque istruzione.
 * Per questo il gestore deve fare pochissimo: qui si limita ad alzare una
 * bandierina, e il lavoro vero lo fa il ciclo principale.
 *
 * volatile sig_atomic_t non e' un vezzo:
 *   volatile       dice al compilatore di rileggere la variabile ogni volta,
 *                  perche' viene cambiata "da fuori"
 *   sig_atomic_t   garantisce che la scrittura non venga spezzata a meta'
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <signal.h>
#include <unistd.h>

static volatile sig_atomic_t interruzioni = 0;
static volatile sig_atomic_t ricevuto_usr1 = 0;

static void gestore(int segnale)
{
    if (segnale == SIGINT)
        interruzioni++;
    else if (segnale == SIGUSR1)
        ricevuto_usr1 = 1;
}

static int installa(int segnale)
{
    struct sigaction sa;

    sa.sa_handler = gestore;
    sigemptyset(&sa.sa_mask);   /* nessun altro segnale bloccato nel gestore */
    sa.sa_flags = SA_RESTART;   /* riprende le chiamate interrotte */

    if (sigaction(segnale, &sa, NULL) < 0) {
        perror("sigaction");
        return -1;
    }
    return 0;
}

int main(void)
{
    if (installa(SIGINT) < 0 || installa(SIGUSR1) < 0)
        return 1;

    /* 1) un segnale che il programma manda a se stesso */
    printf("mi mando un SIGUSR1...\n");
    kill(getpid(), SIGUSR1);
    sleep(1);
    printf("SIGUSR1 ricevuto: %s\n", ricevuto_usr1 ? "si" : "no");

    /* 2) un segnale che arriva dalla tastiera */
    printf("\nsono il processo %d. Ora premi Ctrl+C. Al terzo esco.\n",
           (int)getpid());

    while (interruzioni < 3) {
        printf("  ...sto lavorando (Ctrl+C ricevuti: %d)\n",
               (int)interruzioni);

        fflush(stdout);   /* cosi' la riga si vede subito anche quando
                             l'output non va a schermo */
        sleep(1);
    }

    printf("\ntre interruzioni, esco con calma.\n");
    return 0;
}
