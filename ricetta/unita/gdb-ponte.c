/* Sta fra l'estensione di debug dell'editor e il gdb di MSYS e traduce i percorsi nella conversazione a righe.
 *
 * Il gdb di MSYS capisce solo /c/...: per lui C:\... e' un percorso relativo, e l'estensione manda quella forma.
 *   verso il gdb:   "C:\\a\\b.c:14"     ->  "/c/a/b.c:14"    (solo stringhe fra virgolette che cominciano con una lettera di unita')
 *   verso l'editor: fullname="/c/a/b.c" ->  fullname="C:/a/b.c"
 *
 * Compilazione: clang -O2 gdb-ponte.c -o gdb-ponte.exe -Wl,--no-insert-timestamp
 * Nessun percorso scritto: il gdb si cerca nel PATH. Uscita: quella del gdb, 127 se non parte.
 *
 * Che cosa NON guarda: i percorsi fuori da un'unita' (/usr/...), che si vedono come il gdb li da';
 * le righe piu' lunghe di TETTO, che passano spezzate. */

#define WIN32_LEAN_AND_MEAN
#include <ctype.h>
#include <string.h>
#include <wchar.h>
#include <windows.h>

#define TETTO (1 << 20)
#define MASSIMO 32768

typedef size_t (*traduci)(const char *, size_t, char *);
typedef struct {
    HANDLE da, a;
    traduci t;
} canale;

static int e_unita(const char *p) {
    return isalpha((unsigned char)p[0]) && p[1] == ':' && (p[2] == '\\' || p[2] == '/');
}

static size_t verso_gdb(const char *s, size_t n, char *d) {
    size_t i = 0, o = 0;
    while (i < n) {
        if (s[i] == '"' && i + 3 < n && e_unita(s + i + 1)) {
            d[o++] = '"';
            d[o++] = '/';
            d[o++] = (char)tolower((unsigned char)s[i + 1]);
            i += 3;
            while (i < n && s[i] != '"') {
                if (s[i] == '\\') {
                    d[o++] = '/';
                    i++;
                    if (i < n && s[i] == '\\') i++;
                } else {
                    d[o++] = s[i++];
                }
            }
            continue;
        }
        d[o++] = s[i++];
    }
    return o;
}

static size_t verso_editor(const char *s, size_t n, char *d) {
    static const char k[] = "fullname=\"/";
    size_t i = 0, o = 0;
    while (i < n) {
        if (i + 13 < n && memcmp(s + i, k, 11) == 0 && isalpha((unsigned char)s[i + 11]) && s[i + 12] == '/') {
            memcpy(d + o, k, 10);
            o += 10;
            d[o++] = (char)toupper((unsigned char)s[i + 11]);
            d[o++] = ':';
            i += 12;
            continue;
        }
        d[o++] = s[i++];
    }
    return o;
}

static void scrivi(HANDLE h, const char *b, size_t n) {
    DWORD w;
    while (n > 0 && WriteFile(h, b, (DWORD)n, &w, NULL) && w > 0) {
        b += w;
        n -= w;
    }
}

static DWORD WINAPI travasa(void *p) {
    canale *c = p;
    char *riga = HeapAlloc(GetProcessHeap(), 0, TETTO);
    char *fuori = HeapAlloc(GetProcessHeap(), 0, 2 * TETTO);
    char buf[65536];
    size_t n = 0;
    DWORD l;
    while (ReadFile(c->da, buf, sizeof buf, &l, NULL) && l > 0) {
        for (DWORD i = 0; i < l; i++) {
            riga[n++] = buf[i];
            if (buf[i] == '\n' || n == TETTO) {
                scrivi(c->a, fuori, c->t(riga, n, fuori));
                n = 0;
            }
        }
    }
    if (n) scrivi(c->a, fuori, c->t(riga, n, fuori));
    CloseHandle(c->a);
    return 0;
}

int main(void) {
    static wchar_t linea[MASSIMO] = L"gdb.exe";
    wchar_t *cmd = GetCommandLineW();
    int virgolette = 0;
    /* Si salta il nome di questo programma: il resto della riga passa al gdb com'e'. */
    while (*cmd && (virgolette || (*cmd != L' ' && *cmd != L'\t'))) {
        if (*cmd == L'"') virgolette = !virgolette;
        cmd++;
    }
    if (wcslen(cmd) >= MASSIMO - 8) return 127;
    wcscat(linea, cmd);

    SECURITY_ATTRIBUTES sa = {sizeof sa, NULL, TRUE};
    HANDLE in_r, in_w, out_r, out_w;
    if (!CreatePipe(&in_r, &in_w, &sa, 0) || !CreatePipe(&out_r, &out_w, &sa, 0)) return 127;
    SetHandleInformation(in_w, HANDLE_FLAG_INHERIT, 0);
    SetHandleInformation(out_r, HANDLE_FLAG_INHERIT, 0);

    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof si);
    si.cb = sizeof si;
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdInput = in_r;
    si.hStdOutput = out_w;
    si.hStdError = GetStdHandle(STD_ERROR_HANDLE);
    SetHandleInformation(si.hStdError, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
    if (!CreateProcessW(NULL, linea, NULL, NULL, TRUE, 0, NULL, NULL, &si, &pi)) {
        static const char avviso[] = "gdb-ponte: gdb.exe non si avvia: manca nel PATH?\n";
        scrivi(GetStdHandle(STD_ERROR_HANDLE), avviso, sizeof avviso - 1);
        return 127;
    }
    CloseHandle(in_r);
    CloseHandle(out_w);

    static canale a, b;
    a = (canale){GetStdHandle(STD_INPUT_HANDLE), in_w, verso_gdb};
    b = (canale){out_r, GetStdHandle(STD_OUTPUT_HANDLE), verso_editor};
    CreateThread(NULL, 0, travasa, &a, 0, NULL);
    HANDLE t = CreateThread(NULL, 0, travasa, &b, 0, NULL);
    WaitForSingleObject(pi.hProcess, INFINITE);
    WaitForSingleObject(t, 2000);

    DWORD codice = 0;
    GetExitCodeProcess(pi.hProcess, &codice);
    return (int)codice;
}
