/* 07 - Thread: quattro esecuzioni dentro lo STESSO programma
 *
 * Questo e' il caso interessante del confronto: i THREAD funzionano con
 * ENTRAMBI i compilatori, mentre i PROCESSI (fork) solo con gcc.
 * Il motivo: Windows i thread ce li ha, e clang ci appoggia sopra pthread.
 * Il fork di Unix invece non ha alcun equivalente e va emulato.
 *
 * Quattro thread aumentano lo stesso contatore. Il mutex ("lucchetto") serve
 * a farli entrare uno per volta: senza, si pestano i piedi e il totale finale
 * e' sbagliato.
 *
 * Si compila con -pthread (lo fa gia' il Makefile).
 */

#include <stdio.h>
#include <pthread.h>

#define N_THREAD 4
#define GIRI     100000

static pthread_mutex_t lucchetto = PTHREAD_MUTEX_INITIALIZER;
static long contatore = 0;     /* condiviso da tutti i thread */

/* Questa funzione viene eseguita da ogni thread.
   La firma (void* -> void*) e' imposta da pthread_create. */
static void *conta(void *argomento)
{
    int id = *(int *)argomento;

    for (int i = 0; i < GIRI; i++) {
        pthread_mutex_lock(&lucchetto);     /* <-- prova a commentare */
        contatore++;
        pthread_mutex_unlock(&lucchetto);   /* <-- queste due righe    */
    }

    printf("  thread %d ha finito\n", id);
    return NULL;
}

int main(void)
{
    pthread_t thread[N_THREAD];
    int id[N_THREAD];

    printf("avvio %d thread, %d incrementi ciascuno\n", N_THREAD, GIRI);

    for (int i = 0; i < N_THREAD; i++) {
        id[i] = i;
        if (pthread_create(&thread[i], NULL, conta, &id[i]) != 0) {
            fprintf(stderr, "pthread_create fallita\n");
            return 1;
        }
    }

    /* join = aspetta che quel thread abbia finito */
    for (int i = 0; i < N_THREAD; i++)
        pthread_join(thread[i], NULL);

    long atteso = (long)N_THREAD * GIRI;
    printf("contatore = %ld (atteso %ld)\n", contatore, atteso);

    return contatore == atteso ? 0 : 1;
}
