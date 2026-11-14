/* Il programma che seguiamo lungo tutta la catena. */
#include <stdio.h>

#define VOLTE 3

int main(void)
{
    for (int i = 1; i <= VOLTE; i++) {
        printf("giro %d\n", i);
    }
    return 0;
}
