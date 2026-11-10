/* Sta fra un programma Windows e uno strumento di MSYS, e chiama quello di MSYS.
 *
 * Compilazione: clang -O2 ponte.c -DPROGRAMMA=cargo -DTRADUCI -o cargo-ponte.exe -Wl,--no-insert-timestamp
 *               clang -O2 ponte.c -DPROGRAMMA=rustc -DTRADUCI -o rustc-ponte.exe -Wl,--no-insert-timestamp
 *               clang -O2 ponte.c -DPROGRAMMA=git -o git.exe -Wl,--no-insert-timestamp
 *
 * Con TRADUCI:
 *   verso lo strumento: un argomento C:\a\b diventa /c/a/b;
 *   verso il programma Windows, sullo standard output: /C/a/b diventa C:/a/b e /usr/... diventa <MSYS>/usr/...,
 *   solo a inizio riga o subito dopo una virgoletta.
 * Senza TRADUCI gli argomenti passano com'e' e le uscite sono ereditate.
 *
 * Toglie CARGO e RUSTC dall'ambiente dello strumento: il cargo vero userebbe il traduttore come compilatore.
 * Imposta HOME, se manca, dentro l'unita'. La radice di MSYS viene da MYDEV_MSYS: nessun percorso scritto.
 * Uscita: quella dello strumento, 127 se non parte.
 *
 * Che cosa NON guarda: lo standard error, che passa com'e'; i percorsi di MSYS diversi da /usr. */

#define WIN32_LEAN_AND_MEAN
#include <ctype.h>
#include <stdio.h>
#include <string.h>
#include <wchar.h>
#include <windows.h>

#define MASSIMO 32768
#define L2(x) L## #x
#define LARGO(x) L2(x)

static char radice_msys[MASSIMO];
static size_t lung_radice;

static void scrivi(HANDLE h, const char *b, size_t n) {
    DWORD w;
    while (n > 0 && WriteFile(h, b, (DWORD)n, &w, NULL) && w > 0) {
        b += w;
        n -= w;
    }
}

#ifdef TRADUCI
/* Riscrive gli argomenti: un percorso con la lettera di unita' diventa /lettera/resto. */
static void traduci_argomenti(const wchar_t *s, wchar_t *d) {
    int virgolette = 0;
    wchar_t prima = L' ';
    while (*s) {
        if (iswalpha(s[0]) && s[1] == L':' && (s[2] == L'\\' || s[2] == L'/') && (prima == L' ' || prima == L'"' || prima == L'=' || prima == L'\t')) {
            *d++ = L'/';
            *d++ = (wchar_t)towlower(s[0]);
            s += 2;
            while (*s && *s != L'"' && (virgolette || (*s != L' ' && *s != L'\t'))) {
                *d++ = *s == L'\\' ? L'/' : *s;
                s++;
            }
            prima = L'a';
            continue;
        }
        if (*s == L'"') virgolette = !virgolette;
        prima = *s;
        *d++ = *s++;
    }
    *d = 0;
}

/* Quanti byte di coda tenere da parte: un percorso spezzato fra due letture non si riconoscerebbe. */
#define CODA 8

static size_t e_usr(const char *s, size_t n, int fine) {
    if (n < 5 && !fine) return 0;
    if (n >= 4 && memcmp(s, "/usr", 4) == 0 && (n == 4 || s[4] == '/' || s[4] == '"' || s[4] == '\n' || s[4] == '\r')) return 4;
    return 0;
}

static DWORD WINAPI travasa(void *p) {
    HANDLE da = ((HANDLE *)p)[0], a = ((HANDLE *)p)[1];
    static char buf[1 << 20], fuori[1 << 21];
    size_t pieni = 0;
    char prima = '\n';
    DWORD l;
    for (;;) {
        BOOL ok = ReadFile(da, buf + pieni, (DWORD)(sizeof buf - pieni), &l, NULL) && l > 0;
        if (ok) pieni += l;
        size_t limite = ok ? (pieni > CODA ? pieni - CODA : 0) : pieni;
        size_t i = 0, o = 0;
        while (i < limite) {
            if (o + MASSIMO > sizeof fuori) {
                scrivi(a, fuori, o);
                o = 0;
            }
            if (buf[i] == '/' && (prima == '"' || prima == '\n')) {
                size_t resta = pieni - i, u;
                if (resta >= 3 && isalpha((unsigned char)buf[i + 1]) && buf[i + 2] == '/') {
                    fuori[o++] = (char)toupper((unsigned char)buf[i + 1]);
                    fuori[o++] = ':';
                    fuori[o++] = '/';
                    i += 3;
                    prima = '/';
                    continue;
                }
                if ((u = e_usr(buf + i, resta, !ok)) > 0) {
                    memcpy(fuori + o, radice_msys, lung_radice);
                    o += lung_radice;
                    memcpy(fuori + o, "/usr", 4);
                    o += 4;
                    i += u;
                    prima = 'r';
                    continue;
                }
            }
            prima = buf[i];
            fuori[o++] = buf[i++];
        }
        if (o) scrivi(a, fuori, o);
        memmove(buf, buf + i, pieni - i);
        pieni -= i;
        if (!ok) break;
    }
    CloseHandle(a);
    return 0;
}
#endif

int main(void) {
    static wchar_t linea[MASSIMO], msys[MASSIMO], casa[MASSIMO], tradotti[MASSIMO];
    DWORD n = GetEnvironmentVariableW(L"MYDEV_MSYS", msys, MASSIMO);
    if (n == 0 || n >= MASSIMO) {
        static const char avviso[] = "ponte: manca MYDEV_MSYS, parti dal lanciatore dell'unita'\n";
        scrivi(GetStdHandle(STD_ERROR_HANDLE), avviso, sizeof avviso - 1);
        return 127;
    }
    wchar_t *cmd = GetCommandLineW();
    int virgolette = 0;
    while (*cmd && (virgolette || (*cmd != L' ' && *cmd != L'\t'))) {
        if (*cmd == L'"') virgolette = !virgolette;
        cmd++;
    }
#ifdef TRADUCI
    traduci_argomenti(cmd, tradotti);
    cmd = tradotti;
    WideCharToMultiByte(CP_UTF8, 0, msys, -1, radice_msys, MASSIMO, NULL, NULL);
    for (char *q = radice_msys; *q; q++) if (*q == '\\') *q = '/';
    lung_radice = strlen(radice_msys);
#endif
    swprintf(linea, MASSIMO, L"\"%ls\\usr\\bin\\%ls.exe\"%ls", msys, LARGO(PROGRAMMA), cmd);
    static wchar_t applicazione[MASSIMO];
    swprintf(applicazione, MASSIMO, L"%ls\\usr\\bin\\%ls.exe", msys, LARGO(PROGRAMMA));

    SetEnvironmentVariableW(L"CARGO", NULL);
    SetEnvironmentVariableW(L"RUSTC", NULL);
    if (GetEnvironmentVariableW(L"HOME", casa, MASSIMO) == 0 && GetEnvironmentVariableW(L"MYDEV_RADICE_POSIX", casa, MASSIMO) > 0) {
        wcscat(casa, L"/home");
        SetEnvironmentVariableW(L"HOME", casa);
    }

    SECURITY_ATTRIBUTES sa = {sizeof sa, NULL, TRUE};
    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof si);
    si.cb = sizeof si;
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
    si.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
    si.hStdError = GetStdHandle(STD_ERROR_HANDLE);
#ifdef TRADUCI
    HANDLE out_r, out_w;
    if (!CreatePipe(&out_r, &out_w, &sa, 0)) return 127;
    SetHandleInformation(out_r, HANDLE_FLAG_INHERIT, 0);
    si.hStdOutput = out_w;
#endif
    SetHandleInformation(si.hStdInput, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
    SetHandleInformation(si.hStdError, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
    (void)sa;
    if (!CreateProcessW(applicazione, linea, NULL, NULL, TRUE, 0, NULL, NULL, &si, &pi)) {
        static const char avviso[] = "ponte: lo strumento di MSYS non si avvia\n";
        scrivi(GetStdHandle(STD_ERROR_HANDLE), avviso, sizeof avviso - 1);
        return 127;
    }
#ifdef TRADUCI
    CloseHandle(out_w);
    static HANDLE coppia[2];
    coppia[0] = out_r;
    coppia[1] = GetStdHandle(STD_OUTPUT_HANDLE);
    HANDLE t = CreateThread(NULL, 0, travasa, coppia, 0, NULL);
#endif
    WaitForSingleObject(pi.hProcess, INFINITE);
#ifdef TRADUCI
    WaitForSingleObject(t, 5000);
#endif
    DWORD codice = 0;
    GetExitCodeProcess(pi.hProcess, &codice);
    return (int)codice;
}
