/*
 * L'archivio nell'heap.
 *
 * Chiavi e valori non hanno piu' una lunghezza massima: ogni testo sta in un
 * blocco di memoria chiesto con malloc e restituito con free. Lo Store conta
 * le due chiamate, e alla fine del programma i conteggi devono coincidere.
 *
 * Per vedere i conteggi si compila cosi':
 *     clang -DCONTATORE -Wall -Wextra -g -o archivio archivio.c
 */

#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define CAPACITA 8
#define RIGA 129         /* 127 caratteri, il fine riga e il terminatore */
#define MAX_PAROLE 3     /* il comando e due argomenti */
#define TESTO_NUMERO 21  /* il segno, 19 cifre e il terminatore */

/* Gli esiti di incrementa. */
#define FATTO 1
#define PIENO 0
#define NON_INTERO (-1)

typedef struct {
    char *chiave;
    char *valore;
} Voce;

typedef struct {
    Voce voci[CAPACITA];
    int quante;
    int allocazioni; /* chiamate a malloc */
    int liberazioni; /* chiamate a free */
} Store;

/* Chiede un blocco di memoria e lo conta. Senza memoria il programma si ferma. */
void *riserva(Store *s, size_t dimensione)
{
    void *blocco = malloc(dimensione);
    if (blocco == NULL) {
        fprintf(stderr, "memoria esaurita\n");
        exit(1);
    }
    s->allocazioni++;
    return blocco;
}

/* Restituisce un blocco di memoria e lo conta. */
void libera(Store *s, void *blocco)
{
    s->liberazioni++;
    free(blocco);
}

/* Copia il testo in un blocco nuovo, grande quanto basta. */
char *copia_testo(Store *s, char *testo)
{
    char *copia = riserva(s, strlen(testo) + 1);
    strcpy(copia, testo);
    return copia;
}

/* Restituisce l'indirizzo della voce con quella chiave, oppure NULL. */
Voce *trova(Store *s, char *chiave)
{
    for (int i = 0; i < s->quante; i++) {
        if (strcmp(s->voci[i].chiave, chiave) == 0) {
            return &s->voci[i];
        }
    }
    return NULL;
}

/* Memorizza il valore. Restituisce 1 se ci e' riuscita, 0 se l'archivio e' pieno. */
int imposta(Store *s, char *chiave, char *valore)
{
    Voce *voce = trova(s, chiave);
    if (voce == NULL) {
        if (s->quante == CAPACITA) {
            return 0;
        }
        voce = &s->voci[s->quante];
        s->quante++;
        voce->chiave = copia_testo(s, chiave);
    } else {
        libera(s, voce->valore);
    }
    voce->valore = copia_testo(s, valore);
    return 1;
}

/* Toglie la voce. Restituisce 1 se c'era, 0 se non c'era. */
int cancella(Store *s, char *chiave)
{
    Voce *voce = trova(s, chiave);
    if (voce == NULL) {
        return 0;
    }
    libera(s, voce->chiave);
    libera(s, voce->valore);
    /* Per non lasciare un buco, l'ultima voce prende il posto di quella tolta. */
    s->quante--;
    *voce = s->voci[s->quante];
    return 1;
}

/*
 * Legge il testo come intero a 64 bit e lo scrive in *numero.
 * Restituisce 1 se ci riesce, 0 se il testo non e' un intero o non ci sta.
 * Accumula il numero in negativo: il piu' piccolo intero non ha un opposto,
 * quindi solo cosi' ci stanno tutti.
 */
int leggi_intero(char *testo, long long *numero)
{
    int negativo = 0;
    if (*testo == '+' || *testo == '-') {
        negativo = (*testo == '-');
        testo++;
    }
    if (*testo == '\0') {
        return 0;
    }

    long long accumulo = 0;
    while (*testo != '\0') {
        if (*testo < '0' || *testo > '9') {
            return 0;
        }
        int cifra = *testo - '0';
        /* Il controllo viene prima della moltiplicazione, che traboccherebbe. */
        if (accumulo < (LLONG_MIN + cifra) / 10) {
            return 0;
        }
        accumulo = accumulo * 10 - cifra;
        testo++;
    }

    if (!negativo) {
        if (accumulo == LLONG_MIN) {
            return 0;
        }
        accumulo = -accumulo;
    }
    *numero = accumulo;
    return 1;
}

/* Aggiunge 1 al valore della chiave; una chiave assente vale 0. */
int incrementa(Store *s, char *chiave)
{
    Voce *voce = trova(s, chiave);
    if (voce == NULL) {
        if (imposta(s, chiave, "1")) {
            return FATTO;
        }
        return PIENO;
    }

    long long numero;
    if (!leggi_intero(voce->valore, &numero) || numero == LLONG_MAX) {
        return NON_INTERO;
    }

    char testo[TESTO_NUMERO];
    sprintf(testo, "%lld", numero + 1);
    imposta(s, chiave, testo);
    return FATTO;
}

/* Restituisce la memoria di tutte le voci ancora presenti. */
void svuota(Store *s)
{
    for (int i = 0; i < s->quante; i++) {
        libera(s, s->voci[i].chiave);
        libera(s, s->voci[i].valore);
    }
    s->quante = 0;
}

int e_spazio(char c)
{
    return c == ' ' || c == '\t' || c == '\n';
}

/*
 * Divide la riga in parole. Non copia niente: scrive un terminatore dopo ogni
 * parola e mette in parole[] l'indirizzo del suo primo carattere.
 * Restituisce quante parole ha trovato, anche se sono piu' di massimo.
 */
int dividi(char *riga, char *parole[], int massimo)
{
    int trovate = 0;
    char *p = riga;

    while (*p != '\0') {
        while (e_spazio(*p)) {
            p++;
        }
        if (*p == '\0') {
            break;
        }
        if (trovate < massimo) {
            parole[trovate] = p;
        }
        trovate++;
        while (*p != '\0' && !e_spazio(*p)) {
            p++;
        }
        if (*p != '\0') {
            *p = '\0';
            p++;
        }
    }
    return trovate;
}

/* Scarta i caratteri fino alla fine della riga corrente. */
void scarta_riga(void)
{
    int c = getchar();
    while (c != '\n' && c != EOF) {
        c = getchar();
    }
}

int main(void)
{
    Store archivio;
    archivio.quante = 0;
    archivio.allocazioni = 0;
    archivio.liberazioni = 0;

    char riga[RIGA];
    char *parole[MAX_PAROLE];

    while (fgets(riga, RIGA, stdin) != NULL) {
        /* Se il buffer e' pieno e manca il fine riga, la riga non ci e' stata. */
        if (strlen(riga) == RIGA - 1 && strchr(riga, '\n') == NULL) {
            scarta_riga();
            printf("ERR troppo lungo\n");
            continue;
        }

        int n = dividi(riga, parole, MAX_PAROLE);
        if (n == 0) {
            continue;
        }

        if (strcmp(parole[0], "SET") == 0) {
            if (n != 3) {
                printf("ERR numero di argomenti\n");
            } else if (imposta(&archivio, parole[1], parole[2])) {
                printf("OK\n");
            } else {
                printf("ERR pieno\n");
            }
        } else if (strcmp(parole[0], "GET") == 0) {
            if (n != 2) {
                printf("ERR numero di argomenti\n");
            } else {
                Voce *voce = trova(&archivio, parole[1]);
                if (voce != NULL) {
                    printf("%s\n", voce->valore);
                } else {
                    printf("(nil)\n");
                }
            }
        } else if (strcmp(parole[0], "DEL") == 0) {
            if (n != 2) {
                printf("ERR numero di argomenti\n");
            } else {
                printf("%d\n", cancella(&archivio, parole[1]));
            }
        } else if (strcmp(parole[0], "EXISTS") == 0) {
            if (n != 2) {
                printf("ERR numero di argomenti\n");
            } else {
                printf("%d\n", trova(&archivio, parole[1]) != NULL);
            }
        } else if (strcmp(parole[0], "INCR") == 0) {
            if (n != 2) {
                printf("ERR numero di argomenti\n");
            } else {
                int esito = incrementa(&archivio, parole[1]);
                if (esito == FATTO) {
                    printf("%s\n", trova(&archivio, parole[1])->valore);
                } else if (esito == PIENO) {
                    printf("ERR pieno\n");
                } else {
                    printf("ERR intero non valido\n");
                }
            }
        } else {
            printf("ERR comando sconosciuto\n");
        }
    }

    svuota(&archivio);

#ifdef CONTATORE
    fprintf(stderr, "malloc %d, free %d\n", archivio.allocazioni, archivio.liberazioni);
#endif

    return 0;
}
