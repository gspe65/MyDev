# Disegna l'icona dei lanciatori: un sottile lampo giallo in un cielo blu notte con qualche minuscola stella.
# Uso: python -X utf8 -B ricetta/icona.py ricetta/unita
# Solo libreria standard: uscita identica a ogni corsa. Sotto i 48 pixel il lampo si ingrossa e le stelle si diradano, o sparirebbero.
# L'unita' copia ricetta/unita/mydev.ico, il file versionato; questo script dice come e' nato e nessuna prova lo
# rilancia: con un'altra versione di zlib i byte potrebbero cambiare, e il file versionato resta quello che vale.
import math
import pathlib
import struct
import sys
import zlib

sys.stdout.reconfigure(encoding="utf-8")
USCITA = pathlib.Path(sys.argv[1])
USCITA.mkdir(parents=True, exist_ok=True)
MISURE = [256, 128, 64, 48, 32, 24, 16]

LAMPO_SOTTILE = [(0.585, 0.07), (0.685, 0.07), (0.555, 0.415), (0.675, 0.415), (0.395, 0.935), (0.475, 0.535), (0.345, 0.535)]
LAMPO_MEDIO = [(0.56, 0.06), (0.72, 0.06), (0.585, 0.40), (0.725, 0.40), (0.375, 0.95), (0.465, 0.55), (0.30, 0.55)]
LAMPO_GROSSO = [(0.52, 0.03), (0.80, 0.03), (0.62, 0.38), (0.82, 0.38), (0.34, 0.98), (0.45, 0.58), (0.22, 0.58)]
# x, y, raggio, luminosita'
STELLE = [
    (0.16, 0.20, 0.0105, 1.00), (0.33, 0.13, 0.0065, 0.75), (0.80, 0.17, 0.0085, 0.95),
    (0.88, 0.40, 0.0060, 0.70), (0.13, 0.47, 0.0070, 0.80), (0.24, 0.73, 0.0085, 0.90),
    (0.74, 0.70, 0.0065, 0.75), (0.86, 0.84, 0.0095, 1.00), (0.53, 0.90, 0.0055, 0.60),
]
CIELO_ALTO = (0x0a, 0x10, 0x38)
CIELO_BASSO = (0x1a, 0x2a, 0x6e)
GIALLO = (0xff, 0xd8, 0x30)


def forma_per(n):
    if n >= 48:
        return LAMPO_SOTTILE
    if n >= 32:
        return LAMPO_MEDIO
    return LAMPO_GROSSO


def stelle_per(n):
    if n >= 48:
        return STELLE
    if n >= 32:
        return [STELLE[0], STELLE[2], STELLE[7]]
    return []


def dentro(px, py, poligono):
    c = False
    j = len(poligono) - 1
    for i, (xi, yi) in enumerate(poligono):
        xj, yj = poligono[j]
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


def distanza_segmento(px, py, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def distanza_poligono(px, py, poligono):
    if dentro(px, py, poligono):
        return 0.0
    return min(distanza_segmento(px, py, poligono[i], poligono[(i + 1) % len(poligono)]) for i in range(len(poligono)))


def dentro_tondo(px, py, r=0.18):
    cx = min(max(px, r), 1 - r)
    cy = min(max(py, r), 1 - r)
    return math.hypot(px - cx, py - cy) <= r


def disegna(n):
    forma = forma_per(n)
    stelle = stelle_per(n)
    camp = 4 if n >= 48 else 8
    passo = 1.0 / (n * camp)
    alone_r = 0.075 if n >= 48 else 0.0
    righe = []
    for y in range(n):
        riga = bytearray()
        for x in range(n):
            somma = [0.0, 0.0, 0.0]
            copertura = 0
            cx = (x + 0.5) / n
            cy = (y + 0.5) / n
            # L'alone si calcola una volta per pixel: e' morbido, il campionamento non gli serve.
            alone = 0.0
            if alone_r:
                d = distanza_poligono(cx, cy, forma)
                if d < alone_r:
                    alone = 0.38 * (1 - d / alone_r) ** 2
            for sy in range(camp):
                for sx in range(camp):
                    px = (x + (sx + 0.5) / camp) / n
                    py = (y + (sy + 0.5) / camp) / n
                    if not dentro_tondo(px, py):
                        continue
                    copertura += 1
                    t = py
                    r, g, b = (CIELO_ALTO[i] + (CIELO_BASSO[i] - CIELO_ALTO[i]) * t for i in range(3))
                    for sx0, sy0, raggio, lum in stelle:
                        rq = max(raggio, 0.75 / n)
                        if math.hypot(px - sx0, py - sy0) <= rq:
                            r, g, b = (r + (255 - r) * lum, g + (255 - g) * lum, b + (250 - b) * lum)
                    r, g, b = (r + (GIALLO[0] - r) * alone, g + (GIALLO[1] - g) * alone, b + (GIALLO[2] - b) * alone)
                    if dentro(px, py, forma):
                        r, g, b = GIALLO
                    somma[0] += r
                    somma[1] += g
                    somma[2] += b
            if copertura == 0:
                riga += b"\0\0\0\0"
            else:
                riga += bytes((round(somma[0] / copertura), round(somma[1] / copertura), round(somma[2] / copertura), round(255 * copertura / (camp * camp))))
        righe.append(bytes(riga))
    return righe


def png(n, righe):
    def blocco(tipo, dati):
        return struct.pack(">I", len(dati)) + tipo + dati + struct.pack(">I", zlib.crc32(tipo + dati))
    grezzi = b"".join(b"\0" + r for r in righe)
    return b"\x89PNG\r\n\x1a\n" + blocco(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 6, 0, 0, 0)) + blocco(b"IDAT", zlib.compress(grezzi, 9)) + blocco(b"IEND", b"")


def scrivi_ico(immagini):
    testa = struct.pack("<HHH", 0, 1, len(immagini))
    posizione = 6 + 16 * len(immagini)
    voci = b""
    corpo = b""
    for n, dati in immagini:
        lato = 0 if n >= 256 else n
        voci += struct.pack("<BBBBHHII", lato, lato, 0, 0, 1, 32, len(dati), posizione)
        corpo += dati
        posizione += len(dati)
    return testa + voci + corpo


immagini = []
tele = {}
for n in MISURE:
    r = disegna(n)
    tele[n] = r
    immagini.append((n, png(n, r)))
    print("disegnata", n, flush=True)
(USCITA / "mydev.ico").write_bytes(scrivi_ico(immagini))

print("byte dell'icona:", (USCITA / "mydev.ico").stat().st_size)
