/* 08 - Asincronia con i thread: non stare fermo ad aspettare
 *
 * Funziona con ENTRAMBI i compilatori.
 *
 * "Asincrono" vuol dire: faccio partire un lavoro lungo e NON mi blocco ad
 * aspettarlo; intanto faccio altro, e ogni tanto controllo a che punto e'.
 *
 * Qui un thread "operaio" finge di scaricare un file (dieci passi da mezzo
 * secondo). Il thread principale intanto disegna la barra di avanzamento.
 * Alla fine il join aspetta l'operaio: quello e' l'unico momento in cui il
 * programma si ferma davvero.
 *
 * La percentuale la scrive l'operaio e la legge il principale: e' memoria
 * condivisa fra thread, quindi va protetta con il mutex, come nel progetto 07.
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <pthread.h>
#include <time.h>      /* nanosleep */

#define PASSI 10

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

static pthread_mutex_t lucchetto = PTHREAD_MUTEX_INITIALIZER;
static int percentuale = 0;
static int finito = 0;

static void *operaio(void *argomento)
{
    (void)argomento;            /* non lo uso: cosi' il compilatore tace */

    for (int i = 1; i <= PASSI; i++) {
        pausa_ms(500);          /* mezzo secondo di finto lavoro */

        pthread_mutex_lock(&lucchetto);
        percentuale = i * 100 / PASSI;
        pthread_mutex_unlock(&lucchetto);
    }

    pthread_mutex_lock(&lucchetto);
    finito = 1;
    pthread_mutex_unlock(&lucchetto);

    return NULL;
}

int main(void)
{
    pthread_t thread;

    printf("faccio partire il lavoro e NON mi blocco\n\n");

    if (pthread_create(&thread, NULL, operaio, NULL) != 0) {
        fprintf(stderr, "pthread_create fallita\n");
        return 1;
    }

    /* Il thread principale continua a lavorare mentre l'operaio va avanti */
    for (;;) {
        int p, f;

        pthread_mutex_lock(&lucchetto);
        p = percentuale;
        f = finito;
        pthread_mutex_unlock(&lucchetto);

        printf("\r  avanzamento: [");
        for (int i = 0; i < 20; i++)
            putchar(i < p / 5 ? '#' : '.');
        printf("] %3d%%", p);
        fflush(stdout);         /* senza questo la riga non si vede subito:
                                   \r non manda a capo e il buffer resta pieno */

        if (f)
            break;

        pausa_ms(100);          /* controllo dieci volte al secondo */
    }

    pthread_join(thread, NULL); /* qui, e solo qui, aspetto davvero */

    printf("\n\nlavoro finito.\n");
    return 0;
}
