/* I bucket sono liste corte: si cerca solo in quella giusta. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define BUCKET 4

typedef struct Nodo {
    char *chiave;
    struct Nodo *successivo;
} Nodo;

unsigned int hash(char *testo)
{
    unsigned int risultato = 0;
    while (*testo != '\0') {
        risultato = risultato * 31 + (unsigned char) *testo;
        testo++;
    }
    return risultato;
}

void inserisci(Nodo *bucket[], char *chiave)
{
    unsigned int i = hash(chiave) % BUCKET;
    Nodo *nuovo = malloc(sizeof(Nodo));
    if (nuovo == NULL) {
        exit(1);
    }
    nuovo->chiave = chiave;
    nuovo->successivo = bucket[i];
    bucket[i] = nuovo;
}

int presente(Nodo *bucket[], char *chiave)
{
    unsigned int i = hash(chiave) % BUCKET;
    for (Nodo *nodo = bucket[i]; nodo != NULL; nodo = nodo->successivo) {
        if (strcmp(nodo->chiave, chiave) == 0) {
            return 1;
        }
    }
    return 0;
}

void stampa(int trovato)
{
    if (trovato) {
        printf("trovato\n");
    } else {
        printf("assente\n");
    }
}

int main(void)
{
    Nodo *bucket[BUCKET] = {NULL, NULL, NULL, NULL};
    inserisci(bucket, "anna");
    inserisci(bucket, "bruno");
    inserisci(bucket, "carla");
    inserisci(bucket, "elena");

    stampa(presente(bucket, "bruno"));
    stampa(presente(bucket, "dario"));

    for (int i = 0; i < BUCKET; i++) {
        while (bucket[i] != NULL) {
            Nodo *successivo = bucket[i]->successivo;
            free(bucket[i]);
            bucket[i] = successivo;
        }
    }
    return 0;
}
