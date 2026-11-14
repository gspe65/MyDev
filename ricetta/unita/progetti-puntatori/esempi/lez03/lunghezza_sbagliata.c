/* La lunghezza e' un numero in piu': se e' sbagliata, il C legge oltre la fine. */
#include <stdio.h>

int somma(int v[], int quanti)
{
    int totale = 0;
    for (int i = 0; i < quanti; i++) {
        totale += v[i];
    }
    return totale;
}

int main(void)
{
    int v[4] = {1, 2, 3, 4};
    printf("%d\n", somma(v, 5));
    return 0;
}
