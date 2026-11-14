/* Ogni chiamata ha il suo n, in celle diverse. */
#include <stdio.h>

int fattoriale(int n)
{
    printf("n = %d alla cella %p\n", n, (void *) &n);
    if (n <= 1) {
        return 1;
    }
    return n * fattoriale(n - 1);
}

int main(void)
{
    printf("%d\n", fattoriale(3));
    return 0;
}
