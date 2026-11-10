#include <stdio.h>
#include <stdlib.h>
int main(void) {
    int *v = malloc(2 * sizeof(int));
    v[0] = 1; v[1] = 2;
    v[2] = 3;
    printf("%d\n", v[1]);
    free(v);
    return 0;
}
