/* Con gli indirizzi la funzione lavora sulle variabili di chi la chiama. */
#include <stdio.h>

void scambia(int *a, int *b)
{
    int temporanea = *a;
    *a = *b;
    *b = temporanea;
}

int main(void)
{
    int a = 1;
    int b = 2;
    scambia(&a, &b);
    printf("a=%d b=%d\n", a, b);
    return 0;
}
