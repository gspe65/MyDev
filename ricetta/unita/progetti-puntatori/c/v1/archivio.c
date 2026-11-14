/*
 * L'archivio con i puntatori.
 *
 * Gli stessi comandi del primo archivio, ma la ricerca ora sta in una sola
 * funzione. Le funzioni ricevono gli array e, quando devono cambiarlo, l'indirizzo
 * del contatore.
 *
 * Si fida di chi scrive: i comandi devono essere ben formati e le parole
 * non piu' lunghe di 31 caratteri.
 */

#include <stdio.h>
#include <string.h>

#define CAPACITA 8
#define LUNGHEZZA 32 /* 31 caratteri piu' il terminatore */

/* Restituisce l'indirizzo del valore della chiave, oppure NULL se non c'e'. */
char *trova(char chiavi[][LUNGHEZZA], char valori[][LUNGHEZZA], int quante, char *chiave)
{
    for (int i = 0; i < quante; i++) {
        if (strcmp(chiavi[i], chiave) == 0) {
            return valori[i];
        }
    }
    return NULL;
}

/* Memorizza il valore. Restituisce 1 se ci e' riuscita, 0 se l'archivio e' pieno. */
int imposta(char chiavi[][LUNGHEZZA], char valori[][LUNGHEZZA], int *quante,
            char *chiave, char *valore)
{
    char *dove = trova(chiavi, valori, *quante, chiave);
    if (dove != NULL) {
        strcpy(dove, valore);
        return 1;
    }
    if (*quante == CAPACITA) {
        return 0;
    }
    strcpy(chiavi[*quante], chiave);
    strcpy(valori[*quante], valore);
    (*quante)++;
    return 1;
}

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
            if (imposta(chiavi, valori, &quante, chiave, valore)) {
                printf("OK\n");
            } else {
                printf("ERR pieno\n");
            }
        } else if (strcmp(comando, "GET") == 0) {
            scanf("%s", chiave);
            char *trovato = trova(chiavi, valori, quante, chiave);
            if (trovato != NULL) {
                printf("%s\n", trovato);
            } else {
                printf("(nil)\n");
            }
        } else {
            printf("ERR comando sconosciuto\n");
        }
    }

    return 0;
}
