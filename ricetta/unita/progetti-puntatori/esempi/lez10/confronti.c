/* Quanti confronti servono per ritrovare tutte le chiavi: in una lista e in una tabella. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define LUNGHEZZA 16

typedef struct Nodo {
    char *chiave;
    struct Nodo *successivo;
} Nodo;

typedef struct {
    Nodo *testa;
} Bucket;

unsigned int hash(char *testo)
{
    unsigned int risultato = 0;
    while (*testo != '\0') {
        risultato = risultato * 31 + (unsigned char) *testo;
        testo++;
    }
    return risultato;
}

Nodo *in_testa(Nodo *testa, char *chiave)
{
    Nodo *nuovo = malloc(sizeof(Nodo));
    if (nuovo == NULL) {
        exit(1);
    }
    nuovo->chiave = chiave;
    nuovo->successivo = testa;
    return nuovo;
}

long long conta_confronti(Nodo *testa, char *chiave)
{
    long long confronti = 0;
    for (Nodo *nodo = testa; nodo != NULL; nodo = nodo->successivo) {
        confronti++;
        if (strcmp(nodo->chiave, chiave) == 0) {
            break;
        }
    }
    return confronti;
}

void libera_lista(Nodo *testa)
{
    while (testa != NULL) {
        Nodo *successivo = testa->successivo;
        free(testa);
        testa = successivo;
    }
}

void prova(int chiavi, unsigned int numero_bucket)
{
    char *testi = malloc(chiavi * LUNGHEZZA);
    Bucket *tabella = malloc(numero_bucket * sizeof(Bucket));
    if (testi == NULL || tabella == NULL) {
        exit(1);
    }
    for (unsigned int b = 0; b < numero_bucket; b++) {
        tabella[b].testa = NULL;
    }

    Nodo *lista = NULL;
    for (int i = 0; i < chiavi; i++) {
        char *chiave = testi + i * LUNGHEZZA;
        sprintf(chiave, "chiave%d", i);
        lista = in_testa(lista, chiave);
        Bucket *bucket = &tabella[hash(chiave) % numero_bucket];
        bucket->testa = in_testa(bucket->testa, chiave);
    }

    long long in_lista = 0;
    long long in_tabella = 0;
    for (int i = 0; i < chiavi; i++) {
        char *chiave = testi + i * LUNGHEZZA;
        in_lista += conta_confronti(lista, chiave);
        in_tabella += conta_confronti(tabella[hash(chiave) % numero_bucket].testa, chiave);
    }
    printf("%d chiavi, %u bucket: lista %lld, tabella %lld\n", chiavi, numero_bucket, in_lista, in_tabella);

    libera_lista(lista);
    for (unsigned int b = 0; b < numero_bucket; b++) {
        libera_lista(tabella[b].testa);
    }
    free(tabella);
    free(testi);
}

int main(void)
{
    prova(1000, 1024);
    prova(10000, 16384);
    prova(1000, 4);
    return 0;
}
