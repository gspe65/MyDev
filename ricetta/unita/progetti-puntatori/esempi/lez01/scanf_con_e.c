/* scanf riceve l'indirizzo della variabile in cui scrivere. */
#include <stdio.h>

int main(void)
{
    int numero;
    if (scanf("%d", &numero) != 1) {
        return 1;
    }
    printf("%d\n", numero + 1);
    return 0;
}
