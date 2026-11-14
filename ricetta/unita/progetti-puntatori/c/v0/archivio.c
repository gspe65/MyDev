/*
 * Il primo archivio.
 *
 * Conserva coppie chiave e valore in due array paralleli: il valore di
 * chiavi[i] sta in valori[i]. Legge i comandi dallo standard input:
 *
 *     SET chiave valore    memorizza il valore
 *     GET chiave           stampa il valore, oppure (nil)
 *
 * Si fida di chi scrive: i comandi devono essere ben formati e le parole
 * non piu' lunghe di 31 caratteri.
 */

#include <stdio.h>
#include <string.h>

#define CAPACITA 8
#define LUNGHEZZA 32 /* 31 caratteri piu' il terminatore */

int main(void)
{
    char chiavi[CAPACITA][LUNGHEZZA];
    char valori[CAPACITA][LUNGHEZZA];
    int quante = 0;

    char comando[LUNGHEZZA];
    char chiave[LUNGHEZZA];
    char valore[LUNGHEZZA];

    while (scanf("%s", comando) == 1) {
        if (strcmp(comando, "SET") == 0) {
            scanf("%s", chiave);
            scanf("%s", valore);

            /* La chiave c'e' gia'? */
            int posizione = -1;
            for (int i = 0; i < quante; i++) {
                if (strcmp(chiavi[i], chiave) == 0) {
                    posizione = i;
                }
            }

            if (posizione >= 0) {
                strcpy(valori[posizione], valore);
                printf("OK\n");
            } else if (quante < CAPACITA) {
                strcpy(chiavi[quante], chiave);
                strcpy(valori[quante], valore);
                quante++;
                printf("OK\n");
            } else {
                printf("ERR pieno\n");
            }
        } else if (strcmp(comando, "GET") == 0) {
            scanf("%s", chiave);

            /* La stessa ricerca di SET: per ora la ripetiamo. */
            int posizione = -1;
            for (int i = 0; i < quante; i++) {
                if (strcmp(chiavi[i], chiave) == 0) {
                    posizione = i;
                }
            }

            if (posizione >= 0) {
                printf("%s\n", valori[posizione]);
            } else {
                printf("(nil)\n");
            }
        } else {
            printf("ERR comando sconosciuto\n");
        }
    }

    return 0;
}
