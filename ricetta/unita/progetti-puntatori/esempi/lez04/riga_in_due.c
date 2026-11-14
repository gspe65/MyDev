/* Un terminatore scritto in mezzo divide la riga in due stringhe. */
#include <stdio.h>

int main(void)
{
    char riga[] = "GET colore";
    char *parole[2];
    parole[0] = riga;
    riga[3] = '\0';
    parole[1] = riga + 4;
    printf("%s\n", parole[0]);
    printf("%s\n", parole[1]);
    return 0;
}
