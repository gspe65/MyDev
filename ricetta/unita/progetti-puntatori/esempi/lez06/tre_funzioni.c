/* Una sola di queste tre funzioni restituisce un indirizzo ancora valido. */
#include <stdio.h>

int *stesso(int *a)
{
    return a;
}

int *copia(int a)
{
    return &a;
}

char *parola(void)
{
    char s[8] = "ciao";
    return s;
}

int main(void)
{
    int x = 1;
    printf("%d\n", *stesso(&x));
    return 0;
}
