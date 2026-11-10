# Makefile - fork.exe
#
#   make            compila con gcc
#   make CC=clang   compila con clang
#   make run        compila ed esegue
#   make clean      cancella i file prodotti
#
# -std=c11 -pedantic: C puro dello standard 2011, niente estensioni del
# compilatore e niente C++. Se un costrutto non e' C, qui non passa.

CC      = gcc
CFLAGS  = -std=c11 -pedantic -Wall -Wextra -g -O0
TARGET  = fork.exe
SRC     = main.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) -o $(TARGET) $(SRC)

run: $(TARGET)
	./$(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all run clean
