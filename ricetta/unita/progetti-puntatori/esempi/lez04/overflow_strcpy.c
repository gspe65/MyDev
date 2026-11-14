/* strcpy non sa quanto e' grande la destinazione. */
#include <stdio.h>
#include <string.h>

int main(void)
{
    char destinazione[8];
    char *testo = "una frase troppo lunga";
    strcpy(destinazione, testo);
    printf("%s\n", destinazione);
    return 0;
}
