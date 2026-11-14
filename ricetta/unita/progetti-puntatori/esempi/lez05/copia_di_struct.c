/* Passata per valore, la funzione lavora su una copia della struct. */
#include <stdio.h>

typedef struct {
    char nome[16];
    int eta;
} Alunno;

Alunno compleanno(Alunno a)
{
    a.eta++;
    return a;
}

int main(void)
{
    Alunno a = {"anna", 17};
    compleanno(a);
    printf("%s %d\n", a.nome, a.eta);
    return 0;
}
