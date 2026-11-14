/* La funzione riceve una copia dei valori: fuori non cambia niente. */
#include <stdio.h>

void scambia(int a, int b)
{
    int temporanea = a;
    a = b;
    b = temporanea;
    printf("dentro: a=%d b=%d\n", a, b);
}

int main(void)
{
    int a = 1;
    int b = 2;
    scambia(a, b);
    printf("fuori: a=%d b=%d\n", a, b);
    return 0;
}
