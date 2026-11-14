/* scanf non sa quanto e' grande comando: scrive anche oltre la fine. */
#include <stdio.h>
#include <string.h>

int main(void)
{
    char comando[8];
    if (scanf("%s", comando) == 1) {
        printf("%zu\n", strlen(comando));
    }
    return 0;
}
