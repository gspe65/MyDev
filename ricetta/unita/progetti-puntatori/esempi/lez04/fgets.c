/* fgets riceve la dimensione del buffer e conserva il fine riga. */
#include <stdio.h>
#include <string.h>

int main(void)
{
    char riga[32];
    if (fgets(riga, 32, stdin) == NULL) {
        return 1;
    }
    char *fine = strchr(riga, '\n');
    if (fine != NULL) {
        *fine = '\0';
    }
    printf("%s\n", riga);
    printf("%zu\n", strlen(riga));
    return 0;
}
