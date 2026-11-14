/* Ogni chiamata ha il proprio record di attivazione, con il proprio n. */
#include <stdio.h>

int fattoriale(int n)
{
    if (n <= 1) {
        return 1;
    }
    return n * fattoriale(n - 1);
}

int main(void)
{
    printf("%d\n", fattoriale(5));
    return 0;
}
