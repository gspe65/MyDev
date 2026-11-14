/* Senza & scanf riceve un valore al posto di un indirizzo: il compilatore avvisa. */
#include <stdio.h>

int main(void)
{
    int numero = 0;
    scanf("%d", numero);
    printf("%d\n", numero);
    return 0;
}
