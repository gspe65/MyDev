/*
 * Quanto tempo serve a ritrovare tutte le chiavi: array, lista, tabella.
 * Si puo' dare il numero delle chiavi sulla riga di comando: .\tempi 20000
 * I millisecondi dipendono dal PC: per confrontarli si compila con -O2 e senza sanitizer.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define LUNGHEZZA 16

typedef struct Nodo {
    char *chiave;
    struct Nodo *successivo;
} Nodo;

typedef struct {
    Nodo *testa;
} Bucket;

typedef struct {
    char *chiave;
} Voce;

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

int in_lista(Nodo *testa, char *chiave)
{
    for (Nodo *nodo = testa; nodo != NULL; nodo = nodo->successivo) {
        if (strcmp(nodo->chiave, chiave) == 0) {
            return 1;
        }
    }
    return 0;
}

int in_array(Voce *voci, int quante, char *chiave)
{
    for (int i = 0; i < quante; i++) {
        if (strcmp(voci[i].chiave, chiave) == 0) {
            return 1;
        }
    }
    return 0;
}

void libera_lista(Nodo *testa)
{
    while (testa != NULL) {
        Nodo *successivo = testa->successivo;
        free(testa);
        testa = successivo;
    }
}

void stampa(char *nome, clock_t inizio, int trovate)
{
    long millisecondi = (long) ((clock() - inizio) * 1000 / CLOCKS_PER_SEC);
    printf("%s: %ld ms, trovate %d\n", nome, millisecondi, trovate);
}

int main(int argc, char *argv[])
{
    int chiavi = 2000;
    if (argc > 1) {
        chiavi = atoi(argv[1]);
    }
    unsigned int numero_bucket = 4;
    while (numero_bucket < (unsigned int) chiavi) {
        numero_bucket = numero_bucket * 2;
    }

    char *testi = malloc(chiavi * LUNGHEZZA);
    Voce *voci = malloc(chiavi * sizeof(Voce));
    Bucket *tabella = malloc(numero_bucket * sizeof(Bucket));
    if (testi == NULL || voci == NULL || tabella == NULL) {
        exit(1);
    }
    for (unsigned int b = 0; b < numero_bucket; b++) {
        tabella[b].testa = NULL;
    }

    Nodo *lista = NULL;
    for (int i = 0; i < chiavi; i++) {
        char *chiave = testi + i * LUNGHEZZA;
        sprintf(chiave, "chiave%d", i);
        voci[i].chiave = chiave;
        lista = in_testa(lista, chiave);
        Bucket *bucket = &tabella[hash(chiave) % numero_bucket];
        bucket->testa = in_testa(bucket->testa, chiave);
    }

    int trovate = 0;
    clock_t inizio = clock();
    for (int i = 0; i < chiavi; i++) {
        trovate += in_array(voci, chiavi, voci[i].chiave);
    }
    stampa("array", inizio, trovate);

    trovate = 0;
    inizio = clock();
    for (int i = 0; i < chiavi; i++) {
        trovate += in_lista(lista, voci[i].chiave);
    }
    stampa("lista", inizio, trovate);

    trovate = 0;
    inizio = clock();
    for (int i = 0; i < chiavi; i++) {
        trovate += in_lista(tabella[hash(voci[i].chiave) % numero_bucket].testa, voci[i].chiave);
    }
    stampa("tabella", inizio, trovate);

    libera_lista(lista);
    for (unsigned int b = 0; b < numero_bucket; b++) {
        libera_lista(tabella[b].testa);
    }
    free(tabella);
    free(voci);
    free(testi);
    return 0;
}
