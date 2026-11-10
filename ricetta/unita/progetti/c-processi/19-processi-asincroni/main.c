/* 19 - Asincronia con i processi: tre figli, e nessuna attesa inutile
 *
 * SOLO con gcc.
 *
 * E' il gemello del progetto 08, ma con i processi al posto dei thread.
 *
 * Il padre fa partire TRE figli che durano tempi diversi (3, 1 e 2 secondi)
 * e poi NON si blocca: continua a fare il suo lavoro e ogni mezzo secondo
 * chiede "e' finito qualcuno?" con
 *
 *     waitpid(-1, &stato, WNOHANG)
 *
 *   -1        qualunque figlio
 *   WNOHANG   non bloccarti: se non e' finito nessuno, torna subito 0
 *
 * Risultato: i figli vengono raccolti nell'ordine in cui hanno finito
 * DAVVERO (il secondo per primo, perche' dorme meno), non in quello in cui
 * sono stati creati. Questa e' l'asincronia.
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <unistd.h>
#include <time.h>        /* nanosleep */
#include <sys/wait.h>

#define N_FIGLI 3

/* Pausa di N millisecondi.
 * Non si usa usleep: e' stato tolto dallo standard POSIX del 2008 e con
 * -std=c11 gcc non lo dichiara piu'.
 * nanosleep e' il suo sostituto, e si comporta uguale con i due compilatori.
 */
static void pausa_ms(long millisecondi)
{
    struct timespec t;

    t.tv_sec  = millisecondi / 1000;
    t.tv_nsec = (millisecondi % 1000) * 1000000L;

    nanosleep(&t, NULL);
}

int main(void)
{
    int durata[N_FIGLI] = { 3, 1, 2 };   /* secondi di "lavoro" */
    pid_t pid[N_FIGLI];

    for (int i = 0; i < N_FIGLI; i++) {
        fflush(stdout);
        pid[i] = fork();

        if (pid[i] < 0) {
            perror("fork");
            return 1;
        }

        if (pid[i] == 0) {
            /* FIGLIO: dorme e se ne va */
            sleep((unsigned int)durata[i]);
            _exit(10 + i);          /* valore di uscita riconoscibile */
        }

        printf("[padre] avviato figlio %d (pid %d, durera' %d s)\n",
               i, (int)pid[i], durata[i]);
    }

    printf("\n[padre] tutti avviati. Intanto lavoro io.\n\n");

    int vivi = N_FIGLI;
    int giro = 0;

    while (vivi > 0) {
        int stato = 0;

        /* WNOHANG: chiedo e basta, non aspetto */
        pid_t finito = waitpid(-1, &stato, WNOHANG);

        if (finito > 0) {
            printf("  -> il figlio %d ha finito (valore %d)\n",
                   (int)finito, WEXITSTATUS(stato));
            vivi--;
        } else if (finito < 0) {
            perror("waitpid");
            break;
        } else {
            /* nessuno ha finito: faccio il mio lavoro */
            printf("  [padre] giro %d, ancora %d figli al lavoro\n",
                   ++giro, vivi);
        }

        fflush(stdout);
        pausa_ms(500);    /* mezzo secondo */
    }

    printf("\n[padre] tutti finiti dopo %d giri di lavoro mio.\n", giro);
    return 0;
}
