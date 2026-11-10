CC      = gcc
CFLAGS  = -Wall -g -O0
TARGET  = multifile.exe

all: $(TARGET)

$(TARGET): main.o utils.o
	$(CC) -o $(TARGET) main.o utils.o

main.o: main.c utils.h
	$(CC) $(CFLAGS) -c main.c

utils.o: utils.c utils.h
	$(CC) $(CFLAGS) -c utils.c

clean:
	rm -f *.o $(TARGET)

.PHONY: all clean
