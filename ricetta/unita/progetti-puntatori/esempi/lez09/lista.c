/* Ogni nodo conosce il successivo. */
#include <stdio.h>
#include <stdlib.h>

typedef struct Nodo {
    int valore;
    struct Nodo *successivo;
} Nodo;

Nodo *inserisci(Nodo *testa, int valore)
{
    Nodo *nuovo = malloc(sizeof(Nodo));
    if (nuovo == NULL) {
        exit(1);
    }
    nuovo->valore = valore;
    nuovo->successivo = testa;
    return nuovo;
}

Nodo *cerca(Nodo *testa, int valore)
{
    for (Nodo *nodo = testa; nodo != NULL; nodo = nodo->successivo) {
        if (nodo->valore == valore) {
            return nodo;
        }
    }
    return NULL;
}

Nodo *togli(Nodo *testa, int valore)
{
    Nodo *precedente = NULL;
    Nodo *nodo = testa;
    while (nodo != NULL && nodo->valore != valore) {
        precedente = nodo;
        nodo = nodo->successivo;
    }
    if (nodo == NULL) {
        return testa;
    }
    if (precedente == NULL) {
        testa = nodo->successivo;
    } else {
        precedente->successivo = nodo->successivo;
    }
    free(nodo);
    return testa;
}

void stampa(Nodo *testa)
{
    for (Nodo *nodo = testa; nodo != NULL; nodo = nodo->successivo) {
        printf("%d", nodo->valore);
        if (nodo->successivo != NULL) {
            printf(" ");
        }
    }
    printf("\n");
}

void libera_tutto(Nodo *testa)
{
    while (testa != NULL) {
        Nodo *successivo = testa->successivo;
        free(testa);
        testa = successivo;
    }
}

int main(void)
{
    Nodo *testa = NULL;
    testa = inserisci(testa, 1);
    testa = inserisci(testa, 2);
    testa = inserisci(testa, 3);
    stampa(testa);
    printf("%d\n", cerca(testa, 2) != NULL);
    testa = togli(testa, 2);
    stampa(testa);
    printf("%d\n", cerca(testa, 2) != NULL);
    libera_tutto(testa);
    return 0;
}
