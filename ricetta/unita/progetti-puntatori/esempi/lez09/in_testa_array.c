/* Per mettere un numero in testa a un array, si spostano tutti gli altri. */
#include <stdio.h>

int main(void)
{
    int v[4] = {1, 2, 3, 0};
    int quanti = 3;
    int spostati = 0;

    for (int i = quanti; i > 0; i--) {
        v[i] = v[i - 1];
        spostati++;
    }
    v[0] = 9;
    quanti++;

    printf("%d %d %d %d\n", v[0], v[1], v[2], v[3]);
    printf("spostati: %d\n", spostati);
    return 0;
}
