/* getchar restituisce un int: deve poter dire anche EOF. */
#include <stdio.h>

int main(void)
{
    char testo[16];
    int n = 0;
    int c = getchar();
    while (c != '\n' && c != EOF && n < 15) {
        testo[n] = (char) c;
        n++;
        c = getchar();
    }
    testo[n] = '\0';
    printf("%s\n", testo);
    return 0;
}
