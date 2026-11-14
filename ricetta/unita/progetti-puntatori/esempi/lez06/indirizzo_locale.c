/* La variabile locale finisce con la funzione: il compilatore avvisa. */
#include <stdio.h>

int *indirizzo_locale(void)
{
    int locale = 42;
    return &locale;
}

int main(void)
{
    int *p = indirizzo_locale();
    printf("%p\n", (void *) p);
    return 0;
}
