/*
 * L'archivio che cresce.
 *
 * Non ci sono piu' limiti: l'array delle voci e il buffer della riga, quando
 * sono pieni, raddoppiano con realloc. realloc puo' spostare il blocco, quindi
 * dopo la chiamata vale solo l'indirizzo che ha restituito.
 *
 * Per vedere i conteggi di malloc e free si compila cosi':
 *     clang -DCONTATORE -Wall -Wextra -g -o archivio archivio.c
 */

#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define VOCI_INIZIALI 4
#define RIGA_INIZIALE 16
#define MAX_PAROLE 3    /* il comando e due argomenti */
#define TESTO_NUMERO 21 /* il segno, 19 cifre e il terminatore */

typedef struct {
    char *chiave;
    char *valore;
} Voce;

typedef struct {
    Voce *voci;
    int quante;
    int capacita;
    int allocazioni; /* chiamate a malloc */
    int liberazioni; /* chiamate a free */
} Store;

typedef struct {
    char *testo;
    size_t capacita;
} Riga;

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

/*
 * Cambia la dimensione di un blocco e restituisce il suo nuovo indirizzo.
 * Non si conta: il blocco resta uno solo, anche quando si sposta.
 */
void *ingrandisci(void *blocco, size_t dimensione)
{
    void *nuovo = realloc(blocco, dimensione);
    if (nuovo == NULL) {
        fprintf(stderr, "memoria esaurita\n");
        exit(1);
    }
    return nuovo;
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

/* Memorizza il valore; se l'array delle voci e' pieno, lo raddoppia. */
void imposta(Store *s, char *chiave, char *valore)
{
    Voce *voce = trova(s, chiave);
    if (voce == NULL) {
        if (s->quante == s->capacita) {
            s->capacita = s->capacita * 2;
            s->voci = ingrandisci(s->voci, s->capacita * sizeof(Voce));
        }
        voce = &s->voci[s->quante];
        s->quante++;
        voce->chiave = copia_testo(s, chiave);
    } else {
        libera(s, voce->valore);
    }
    voce->valore = copia_testo(s, valore);
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

/*
 * Aggiunge 1 al valore della chiave; una chiave assente vale 0.
 * Restituisce 1 se ci e' riuscita, 0 se il valore non e' un intero valido.
 */
int incrementa(Store *s, char *chiave)
{
    Voce *voce = trova(s, chiave);
    if (voce == NULL) {
        imposta(s, chiave, "1");
        return 1;
    }

    long long numero;
    if (!leggi_intero(voce->valore, &numero) || numero == LLONG_MAX) {
        return 0;
    }

    char testo[TESTO_NUMERO];
    sprintf(testo, "%lld", numero + 1);
    imposta(s, chiave, testo);
    return 1;
}

/* Restituisce la memoria di tutte le voci e dell'array. */
void svuota(Store *s)
{
    for (int i = 0; i < s->quante; i++) {
        libera(s, s->voci[i].chiave);
        libera(s, s->voci[i].valore);
    }
    libera(s, s->voci);
    s->voci = NULL;
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

/*
 * Legge una riga intera, senza il fine riga; se il buffer e' pieno, lo raddoppia.
 * Restituisce 1 se ha letto una riga, 0 se l'ingresso e' finito.
 */
int leggi_riga(Riga *riga)
{
    int c = getchar();
    if (c == EOF) {
        return 0;
    }

    size_t lunghezza = 0;
    while (c != '\n' && c != EOF) {
        /* Deve restare sempre un posto per il terminatore. */
        if (lunghezza + 1 == riga->capacita) {
            riga->capacita = riga->capacita * 2;
            riga->testo = ingrandisci(riga->testo, riga->capacita);
        }
        riga->testo[lunghezza] = (char) c;
        lunghezza++;
        c = getchar();
    }
    riga->testo[lunghezza] = '\0';
    return 1;
}

int main(void)
{
    Store archivio;
    archivio.quante = 0;
    archivio.allocazioni = 0;
    archivio.liberazioni = 0;
    archivio.capacita = VOCI_INIZIALI;
    archivio.voci = riserva(&archivio, archivio.capacita * sizeof(Voce));

    Riga riga;
    riga.capacita = RIGA_INIZIALE;
    riga.testo = riserva(&archivio, riga.capacita);

    char *parole[MAX_PAROLE];

    while (leggi_riga(&riga)) {
        int n = dividi(riga.testo, parole, MAX_PAROLE);
        if (n == 0) {
            continue;
        }

        if (strcmp(parole[0], "SET") == 0) {
            if (n != 3) {
                printf("ERR numero di argomenti\n");
            } else {
                imposta(&archivio, parole[1], parole[2]);
                printf("OK\n");
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
            } else if (incrementa(&archivio, parole[1])) {
                printf("%s\n", trova(&archivio, parole[1])->valore);
            } else {
                printf("ERR intero non valido\n");
            }
        } else {
            printf("ERR comando sconosciuto\n");
        }
    }

    svuota(&archivio);
    libera(&archivio, riga.testo);

#ifdef CONTATORE
    fprintf(stderr, "malloc %d, free %d\n", archivio.allocazioni, archivio.liberazioni);
#endif

    return 0;
}
