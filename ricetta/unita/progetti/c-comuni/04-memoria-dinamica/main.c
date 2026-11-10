/* 04 - Memoria dinamica: malloc, realloc, free
 *
 * Funziona con ENTRAMBI i compilatori.
 *
 * Un array dichiarato normalmente ha dimensione decisa quando SCRIVI il
 * programma. Con malloc la decidi quando lo ESEGUI.
 *
 * Tre regole, e non sono facoltative:
 *   1. malloc puo' fallire: controlla SEMPRE se torna NULL
 *   2. ogni malloc vuole la sua free
 *   3. dopo la free il puntatore non vale piu': non leggerlo e non liberarlo
 *      una seconda volta
 */

#include <stdio.h>
#include <stdlib.h>

static void stampa(const char *titolo, const int *v, int n)
{
    printf("%-22s [", titolo);
    for (int i = 0; i < n; i++)
        printf("%s%d", i ? " " : "", v[i]);
    printf("]  (%d elementi)\n", n);
}

int main(void)
{
    int n = 5;

    /* 1) chiedo memoria per n interi */
    int *v = malloc((size_t)n * sizeof *v);
    if (v == NULL) {                 /* SEMPRE */
        fprintf(stderr, "memoria esaurita\n");
        return 1;
    }

    for (int i = 0; i < n; i++)
        v[i] = (i + 1) * 10;
    stampa("dopo malloc:", v, n);

    /* 2) ne voglio il doppio: realloc conserva quello che c'era gia' */
    int nuovo = n * 2;
    int *piu_grande = realloc(v, (size_t)nuovo * sizeof *v);
    if (piu_grande == NULL) {
        /* se realloc fallisce, v e' ancora valido: per questo non si scrive
           mai  v = realloc(v, ...) , o si perderebbe l'unico riferimento */
        fprintf(stderr, "realloc fallita, tengo l'array vecchio\n");
        free(v);
        return 1;
    }
    v = piu_grande;

    for (int i = n; i < nuovo; i++)
        v[i] = (i + 1) * 10;
    stampa("dopo realloc:", v, nuovo);

    /* 3) restituisco la memoria */
    free(v);
    v = NULL;        /* buona abitudine: cosi' un uso per sbaglio esplode
                        subito invece di funzionare "quasi sempre" */

    printf("memoria restituita.\n");
    return 0;
}
