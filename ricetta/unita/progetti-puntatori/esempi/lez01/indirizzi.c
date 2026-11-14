/* Ogni variabile sta in una cella con un suo indirizzo; cambia a ogni esecuzione. */
#include <stdio.h>

int main(void)
{
    int a = 1;
    int b = 2;
    printf("a vale %d e sta in %p\n", a, (void *) &a);
    printf("b vale %d e sta in %p\n", b, (void *) &b);
    return 0;
}
