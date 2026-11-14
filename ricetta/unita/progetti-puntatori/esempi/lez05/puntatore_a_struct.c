/* p->eta si legge come (*p).eta. */
#include <stdio.h>

typedef struct {
    char nome[16];
    int eta;
} Alunno;

void compleanno(Alunno *p)
{
    p->eta++;
}

int main(void)
{
    Alunno a = {"anna", 17};
    compleanno(&a);
    printf("%s %d\n", a.nome, a.eta);
    return 0;
}
