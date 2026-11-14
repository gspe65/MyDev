/* La lunghezza si trova cercando il terminatore. */
#include <stdio.h>

int lunghezza(char *s)
{
    int n = 0;
    while (*s != '\0') {
        n++;
        s++;
    }
    return n;
}

int main(void)
{
    printf("%d\n", lunghezza("ciao"));
    return 0;
}
