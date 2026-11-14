/* Con un passaggio in piu' l'avviso sparisce, e l'errore resta. */
#include <stdio.h>

int *indirizzo_locale(void)
{
    int locale = 42;
    int *p = &locale;
    return p;
}

int main(void)
{
    int *p = indirizzo_locale();
    printf("%d\n", *p);
    return 0;
}
