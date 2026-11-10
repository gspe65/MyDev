/* 16 - alarm(): mettere una scadenza a un'operazione
 *
 * SOLO con gcc.
 *
 * alarm(n) chiede al sistema di mandarci un SIGALRM fra n secondi. E' il modo
 * piu' semplice di dire "se entro tot non ho finito, interrompimi".
 *
 * Qui il programma finge un lavoro da 10 secondi ma si da' 3 secondi di
 * tempo. Quando scatta l'allarme, il gestore alza la bandierina e la sleep
 * viene interrotta.
 *
 * Nota: qui il gestore NON ha SA_RESTART, che non cambierebbe nulla: riprende
 * una read o una write interrotte, ma una sleep si interrompe comunque.
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <signal.h>
#include <unistd.h>

#define TEMPO_MASSIMO  3
#define LAVORO_LUNGO  10

static volatile sig_atomic_t scaduto = 0;

static void gestore(int segnale)
{
    (void)segnale;
    scaduto = 1;
}

int main(void)
{
    struct sigaction sa;

    sa.sa_handler = gestore;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;            /* niente SA_RESTART: vogliamo interrompere */

    if (sigaction(SIGALRM, &sa, NULL) < 0) {
        perror("sigaction");
        return 1;
    }

    printf("il lavoro durerebbe %d secondi, ma mi do' %d secondi di tempo\n",
           LAVORO_LUNGO, TEMPO_MASSIMO);
    fflush(stdout);

    alarm(TEMPO_MASSIMO);       /* la sveglia parte adesso */

    /* il "lavoro lungo": dormo, e verro' svegliato dall'allarme.
       sleep torna i secondi che mancavano quando e' stata interrotta. */
    unsigned int restanti = sleep(LAVORO_LUNGO);

    if (scaduto) {
        printf("\nTEMPO SCADUTO dopo %d secondi.\n", TEMPO_MASSIMO);
        printf("Al lavoro mancavano ancora %u secondi.\n", restanti);
        return 1;
    }

    alarm(0);                   /* finito in tempo: disdico la sveglia */
    printf("\nfinito prima della scadenza.\n");
    return 0;
}
