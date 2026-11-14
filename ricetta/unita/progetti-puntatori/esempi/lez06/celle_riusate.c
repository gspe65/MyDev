/* Finita la funzione, la chiamata dopo riusa le sue celle. */
#include <stdio.h>

int *indirizzo_locale(void)
{
    int locale = 42;
    int *p = &locale;
    return p;
}

int altra_funzione(void)
{
    int altra = 7;
    return altra;
}

int main(void)
{
    int *p = indirizzo_locale();
    int prima = *p;
    altra_funzione();
    int dopo = *p;
    printf("prima %d, dopo %d\n", prima, dopo);
    return 0;
}
