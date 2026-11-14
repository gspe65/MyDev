/* Senza typedef il tipo si chiama struct Alunno: due parole, ogni volta. */
#include <stdio.h>

struct Alunno {
    char nome[16];
    int eta;
};

int main(void)
{
    struct Alunno a = {"anna", 17};
    printf("%s %d\n", a.nome, a.eta);
    return 0;
}
