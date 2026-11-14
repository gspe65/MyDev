/* Perso l'indirizzo del primo nodo, si perdono anche tutti gli altri. */
#include <stdlib.h>

typedef struct Nodo {
    int valore;
    struct Nodo *successivo;
} Nodo;

int main(void)
{
    Nodo *testa = NULL;
    Nodo *nuovo = NULL;
    for (int i = 1; i <= 3; i++) {
        nuovo = malloc(sizeof(Nodo));
        if (nuovo == NULL) {
            return 1;
        }
        nuovo->valore = i;
        nuovo->successivo = testa;
        testa = nuovo;
    }
    nuovo = NULL;
    testa = NULL;
    return testa != NULL;
}
