/* La stringa occupa un carattere in piu' di quelli che si vedono. */
#include <stdio.h>
#include <string.h>

int main(void)
{
    char s[] = "ciao";
    printf("%zu %zu\n", sizeof(s), strlen(s));
    return 0;
}
