"""Estrae l'icona principale di un eseguibile Windows e la scrive come file .ico.

    python -I -B estrai_icona.py <eseguibile> <file.ico>

La prima icona di gruppo delle risorse e' quella che Explorer mostra. Il risultato dipende solo dai byte dell'eseguibile.

Che cosa NON guarda: che il disegno sia quello atteso; gli eseguibili senza sezione di risorse danno un rosso.

Uscite: 0 fatto, 1 rosso, 2 fermo. Solo libreria standard.
"""
import struct
import sys


class Rosso(Exception):
    pass


def leggi_pe(b):
    pe = struct.unpack_from("<I", b, 0x3C)[0]
    if b[pe:pe + 4] != b"PE\0\0":
        raise Rosso("non e' un eseguibile PE")
    n = struct.unpack_from("<H", b, pe + 6)[0]
    opz = struct.unpack_from("<H", b, pe + 20)[0]
    inizio = pe + 24 + opz
    for i in range(n):
        nome, _, va, _, ptr = struct.unpack_from("<8sIIII", b, inizio + 40 * i)
        if nome.rstrip(b"\0") == b".rsrc":
            return va, ptr
    raise Rosso("nessuna sezione di risorse")


def voci(b, base, off):
    nomi, ids = struct.unpack_from("<HH", b, base + off + 12)
    return [struct.unpack_from("<II", b, base + off + 16 + 8 * i) for i in range(nomi + ids)]


def foglia(b, base, off):
    """Scende fino al dato: nome o numero, poi lingua; si prende la prima."""
    while off & 0x80000000:
        off = voci(b, base, off & 0x7FFFFFFF)[0][1]
    return struct.unpack_from("<II", b, base + off)


def principale(argv):
    b = open(argv[0], "rb").read()
    va, ptr = leggi_pe(b)
    per_tipo = {tipo: dato for tipo, dato in voci(b, ptr, 0)}
    if 14 not in per_tipo or 3 not in per_tipo:
        raise Rosso("l'eseguibile non ha icone")
    gruppi = voci(b, ptr, per_tipo[14] & 0x7FFFFFFF)
    rva, _ = foglia(b, ptr, gruppi[0][1])
    g = ptr + rva - va
    tipo, conta = struct.unpack_from("<HH", b, g + 2)
    if tipo != 1 or conta == 0:
        raise Rosso("gruppo di icone non valido")
    immagini = {i & 0xFFFF: d for i, d in voci(b, ptr, per_tipo[3] & 0x7FFFFFFF)}
    corpo = bytearray()
    dir_ico = bytearray(struct.pack("<HHH", 0, 1, conta))
    pos = 6 + 16 * conta
    for i in range(conta):
        l, a, col, ris, piani, bit, _, ident = struct.unpack_from("<BBBBHHIH", b, g + 6 + 14 * i)
        if ident not in immagini:
            raise Rosso(f"immagine {ident} assente")
        r, lung = foglia(b, ptr, immagini[ident])
        dato = b[ptr + r - va:ptr + r - va + lung]
        dir_ico += struct.pack("<BBBBHHII", l, a, col, ris, piani, bit, lung, pos)
        corpo += dato
        pos += lung
    with open(argv[1], "wb") as h:
        h.write(bytes(dir_ico) + bytes(corpo))
    print(f"icona estratta: immagini {conta}, byte {pos}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(principale(sys.argv[1:]))
    except Rosso as e:
        print(f"ROSSO: {e}\nESITO: ROSSO")
        sys.exit(1)
    except SystemExit:
        raise
    except BaseException as e:
        print(f"FERMO: eccezione {e.__class__.__name__}: {e}\nESITO: FERMO")
        sys.exit(2)
