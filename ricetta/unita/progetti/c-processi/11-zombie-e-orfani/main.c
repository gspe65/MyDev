/* 11 - Zombie e orfani: cosa succede se non aspetti i figli
 *
 * SOLO con gcc.
 *
 * Due situazioni che in un corso si citano sempre e si vedono di rado.
 *
 * ZOMBIE: il figlio finisce, ma il padre non ha ancora chiamato wait().
 *   Il sistema non puo' buttare via del tutto il figlio, perche' deve ancora
 *   consegnare al padre il suo valore di uscita: resta una voce nella tabella
 *   dei processi, senza memoria e senza codice. Sparisce nell'istante in cui
 *   il padre chiama wait().
 *
 * ORFANO: il padre finisce prima del figlio.
 *   Il figlio non muore: viene adottato da un altro processo, e il suo
 *   getppid() cambia. Quel nuovo padre chiamera' wait() al posto suo, cosi'
 *   l'orfano non diventera' mai uno zombie eterno.
 *
 * Morale: ogni fork vuole il suo wait.
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>

static void parte_zombie(void)
{
    printf("=== ZOMBIE ===\n");
    fflush(stdout);

    pid_t f = fork();
    if (f < 0) {
        perror("fork");
        return;
    }

    if (f == 0) {
        printf("  [figlio %d] finisco subito\n", (int)getpid());
        fflush(stdout);
        _exit(0);
    }

    sleep(1);   /* il figlio e' gia' morto, ma io non l'ho ancora aspettato */

    printf("  [padre] il figlio %d e' morto un secondo fa e io non l'ho\n"
           "          ancora aspettato: adesso e' uno ZOMBIE.\n", (int)f);
    printf("          Da un altro terminale lo vedresti con:  ps\n");

    int stato = 0;
    wait(&stato);
    printf("  [padre] ho chiamato wait(): lo zombie e' sparito\n\n");
    fflush(stdout);
}

static void parte_orfano(void)
{
    printf("=== ORFANO ===\n");
    fflush(stdout);

    pid_t f = fork();
    if (f < 0) {
        perror("fork");
        return;
    }

    if (f == 0) {
        printf("  [figlio %d] mio padre adesso e' %d\n",
               (int)getpid(), (int)getppid());
        fflush(stdout);

        sleep(2);   /* nel frattempo il padre se ne va */

        printf("  [figlio %d] mio padre adesso e' %d  <- sono stato adottato\n",
               (int)getpid(), (int)getppid());
        fflush(stdout);
        _exit(0);
    }

    printf("  [padre %d] esco subito, senza aspettare il figlio\n",
           (int)getpid());
    fflush(stdout);
}

int main(void)
{
    parte_zombie();
    parte_orfano();

    /* Il main finisce qui: il figlio della seconda parte resta vivo ancora
       un paio di secondi e stampa la sua seconda riga da orfano. */
    printf("[main] il programma principale termina.\n");
    fflush(stdout);
    return 0;
}
