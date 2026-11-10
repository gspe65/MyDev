/* 09 - Produttore e consumatore: la variabile di condizione
 *
 * Funziona con ENTRAMBI i compilatori.
 *
 * Il mutex del progetto 07 risolve "non entrare mentre ci sono io".
 * Non risolve "aspetta finche' non c'e' qualcosa da fare": per quello un mutex
 * da solo costringerebbe a controllare in continuazione, bruciando
 * processore. La variabile di condizione serve esattamente a questo:
 *
 *     pthread_cond_wait   dormi finche' qualcuno non mi sveglia
 *                         (e intanto molla il lucchetto)
 *     pthread_cond_signal sveglia uno che sta aspettando
 *
 * Qui il produttore mette numeri in un magazzino da 4 posti, il consumatore
 * li prende. Se il magazzino e' pieno il produttore aspetta, se e' vuoto
 * aspetta il consumatore.
 *
 * pthread_cond_wait va SEMPRE dentro un while, mai dentro un if: al risveglio
 * la condizione va ricontrollata, perche' potrebbe essere cambiata di nuovo.
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <pthread.h>

#define POSTI    4
#define DA_FARE 10

static int  magazzino[POSTI];
static int  quanti = 0;        /* quanti pezzi ci sono adesso */
static int  entra = 0;         /* dove scrive il produttore */
static int  esce  = 0;         /* da dove legge il consumatore */

static pthread_mutex_t lucchetto = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t  non_pieno = PTHREAD_COND_INITIALIZER;
static pthread_cond_t  non_vuoto = PTHREAD_COND_INITIALIZER;

static void *produttore(void *arg)
{
    (void)arg;

    for (int i = 1; i <= DA_FARE; i++) {
        pthread_mutex_lock(&lucchetto);

        while (quanti == POSTI) {                     /* while, non if */
            printf("  [produttore]  magazzino pieno, aspetto\n");
            pthread_cond_wait(&non_pieno, &lucchetto);
        }

        magazzino[entra] = i;
        entra = (entra + 1) % POSTI;
        quanti++;
        printf("  [produttore]  ho messo %2d   (in magazzino: %d)\n", i, quanti);

        pthread_cond_signal(&non_vuoto);   /* sveglia il consumatore */
        pthread_mutex_unlock(&lucchetto);
    }

    return NULL;
}

static void *consumatore(void *arg)
{
    (void)arg;

    for (int i = 0; i < DA_FARE; i++) {
        pthread_mutex_lock(&lucchetto);

        while (quanti == 0) {
            printf("  [consumatore] magazzino vuoto, aspetto\n");
            pthread_cond_wait(&non_vuoto, &lucchetto);
        }

        int pezzo = magazzino[esce];
        esce = (esce + 1) % POSTI;
        quanti--;
        printf("  [consumatore] ho preso %2d  (in magazzino: %d)\n",
               pezzo, quanti);

        pthread_cond_signal(&non_pieno);   /* sveglia il produttore */
        pthread_mutex_unlock(&lucchetto);
    }

    return NULL;
}

int main(void)
{
    pthread_t p, c;

    printf("magazzino da %d posti, %d pezzi da produrre\n\n", POSTI, DA_FARE);

    if (pthread_create(&p, NULL, produttore, NULL) != 0 ||
        pthread_create(&c, NULL, consumatore, NULL) != 0) {
        fprintf(stderr, "pthread_create fallita\n");
        return 1;
    }

    pthread_join(p, NULL);
    pthread_join(c, NULL);

    printf("\nfinito. Pezzi rimasti in magazzino: %d\n", quanti);
    return quanti == 0 ? 0 : 1;
}
