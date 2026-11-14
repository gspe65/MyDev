/* Leggere attraverso NULL ferma il programma. */
#include <stdio.h>

int main(void)
{
    int *p = NULL;
    printf("%d\n", *p);
    return 0;
}
