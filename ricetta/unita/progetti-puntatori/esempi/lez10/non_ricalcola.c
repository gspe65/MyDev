/* Se i bucket raddoppiano ogni chiave va ricalcolata: qui non si fa. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

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

void inserisci(Nodo *bucket[], unsigned int quanti, char *chiave)
{
    unsigned int i = hash(chiave) % quanti;
    Nodo *nuovo = malloc(sizeof(Nodo));
    if (nuovo == NULL) {
        exit(1);
    }
    nuovo->chiave = chiave;
    nuovo->successivo = bucket[i];
    bucket[i] = nuovo;
}

int presente(Nodo *bucket[], unsigned int quanti, char *chiave)
{
    unsigned int i = hash(chiave) % quanti;
    for (Nodo *nodo = bucket[i]; nodo != NULL; nodo = nodo->successivo) {
        if (strcmp(nodo->chiave, chiave) == 0) {
            return 1;
        }
    }
    return 0;
}

int main(void)
{
    Nodo *vecchi[4] = {NULL, NULL, NULL, NULL};
    inserisci(vecchi, 4, "anna");
    inserisci(vecchi, 4, "bruno");

    /* I bucket raddoppiano, ma ogni lista resta al suo indice. */
    Nodo *nuovi[8] = {NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL};
    for (int i = 0; i < 4; i++) {
        nuovi[i] = vecchi[i];
    }

    printf("anna: %d\n", presente(nuovi, 8, "anna"));
    printf("bruno: %d\n", presente(nuovi, 8, "bruno"));

    for (int i = 0; i < 8; i++) {
        while (nuovi[i] != NULL) {
            Nodo *successivo = nuovi[i]->successivo;
            free(nuovi[i]);
            nuovi[i] = successivo;
        }
    }
    return 0;
}
