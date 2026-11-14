/* Un array come parametro e' un indirizzo: sizeof non ne da' la lunghezza. */
#include <stdio.h>

void stampa_dimensione(int v[])
{
    printf("%zu\n", sizeof(v));
}

int main(void)
{
    int v[5] = {1, 2, 3, 4, 5};
    stampa_dimensione(v);
    return 0;
}
