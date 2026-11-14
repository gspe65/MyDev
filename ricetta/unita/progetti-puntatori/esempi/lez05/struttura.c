/* Una struct tiene insieme i dati che vanno insieme. */
#include <stdio.h>

typedef struct {
    char nome[16];
    int eta;
} Alunno;

int main(void)
{
    Alunno a = {"anna", 17};
    printf("%s %d\n", a.nome, a.eta);
    return 0;
}
