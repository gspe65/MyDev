/* sizeof conta le celle, offsetof dice dove comincia un campo. */
#include <stdio.h>
#include <stddef.h>

typedef struct {
    char nome[16];
    int eta;
} Alunno;

typedef struct {
    char iniziale;
    int eta;
} Scheda;

int main(void)
{
    printf("Alunno: %zu celle, eta alla %zu\n",
           sizeof(Alunno), offsetof(Alunno, eta));
    printf("Scheda: %zu celle, eta alla %zu\n",
           sizeof(Scheda), offsetof(Scheda, eta));
    return 0;
}
