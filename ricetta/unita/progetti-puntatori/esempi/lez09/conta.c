/* Si contano i nodi seguendo il filo, dalla testa fino a NULL. */
#include <stdio.h>

typedef struct Nodo {
    int valore;
    struct Nodo *successivo;
} Nodo;

int conta(Nodo *testa)
{
    int n = 0;
    for (Nodo *nodo = testa; nodo != NULL; nodo = nodo->successivo) {
        n++;
    }
    return n;
}

int main(void)
{
    Nodo terzo = {3, NULL};
    Nodo secondo = {2, &terzo};
    Nodo primo = {1, &secondo};
    printf("%d\n", conta(&primo));
    return 0;
}
