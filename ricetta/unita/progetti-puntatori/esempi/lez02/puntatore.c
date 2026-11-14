/* Attraverso il puntatore si scrive nella variabile a cui punta. */
#include <stdio.h>

int main(void)
{
    int a = 5;
    int *p = &a;
    *p = 7;
    printf("%d %d\n", a, *p);
    return 0;
}
