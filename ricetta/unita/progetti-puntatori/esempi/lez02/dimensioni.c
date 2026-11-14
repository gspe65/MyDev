/* sizeof dice quante celle occupa un tipo: dipende dal sistema. */
#include <stdio.h>

int main(void)
{
    printf("un int occupa %zu celle\n", sizeof(int));
    printf("un puntatore a int occupa %zu celle\n", sizeof(int *));
    return 0;
}
