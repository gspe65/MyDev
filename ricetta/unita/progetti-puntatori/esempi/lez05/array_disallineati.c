/* I nomi si mettono in ordine, le eta' no: nessuno se ne accorge. */
#include <stdio.h>

int main(void)
{
    char *nomi[2] = {"bruno", "anna"};
    int eta[2] = {18, 17};

    char *t = nomi[0];
    nomi[0] = nomi[1];
    nomi[1] = t;

    for (int i = 0; i < 2; i++) {
        printf("%s %d\n", nomi[i], eta[i]);
    }
    return 0;
}
