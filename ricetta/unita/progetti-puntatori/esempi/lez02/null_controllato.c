/* NULL dice che un puntatore non punta a niente: prima di usarlo si controlla. */
#include <stdio.h>

void stampa(int *p)
{
    if (p == NULL) {
        printf("nessun valore\n");
    } else {
        printf("%d\n", *p);
    }
}

int main(void)
{
    int a = 5;
    stampa(NULL);
    stampa(&a);
    return 0;
}
