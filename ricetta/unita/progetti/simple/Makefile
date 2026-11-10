CC      = gcc
CFLAGS  = -Wall -g -O0
TARGET  = main.exe

all: $(TARGET)

$(TARGET): main.c
	$(CC) $(CFLAGS) -o $(TARGET) main.c

clean:
	rm -f $(TARGET)

.PHONY: all clean
