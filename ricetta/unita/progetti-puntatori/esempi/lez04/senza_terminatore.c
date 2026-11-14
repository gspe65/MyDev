/* Senza terminatore strlen continua a leggere oltre l'array. */
#include <stdio.h>
#include <string.h>

int main(void)
{
    char s[4] = {'c', 'i', 'a', 'o'};
    printf("%zu\n", strlen(s));
    return 0;
}
