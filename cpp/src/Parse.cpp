#include "../include/Particle.h"
#include "../include/Parse.h"
#include "../include/Grid.h"
#include <iostream>  


namespace parse {

size_t getSizePCD(char* data, size_t length) {
    size_t count = 0;
    for (size_t i = 0; i < length; ++i)
        if (data[i] == '\n') ++count;
    return count;
}



float parseFloat4Decimal(char*& data) {
    while (*data == ' ' || *data == ',') ++data;

    int sign = 1;
    if (*data == '-') { sign = -1; ++data; }

    int intPart = 0;
    while (*data >= '0' && *data <= '9') {
        intPart = intPart * 10 + (*data - '0');
        ++data;
    }

    ++data; // skip decimal point

    int fracPart = 0;
    while (*data >= '0' && *data <= '9') {
        fracPart = fracPart * 10 + (*data - '0');
        ++data;
    }

    while (*data == '\n' || *data == '\r' || *data == ' ' || *data == ',') ++data;

    float value = sign * (intPart + fracPart * 0.0001f);

    return value;
}


void readXYZFastFromBuffer(char* data, size_t length, std::vector<particle::Particle>& particles) {
    
    size_t particleCount = getSizePCD(data, length);
    particles.reserve(particleCount);

    char* ptr = data;
    char* end = data + length;

    while (ptr < end) {
        float values[3];
        for (int i = 0; i < 3; ++i) {
            values[i] = parseFloat4Decimal(ptr);
        }

        size_t cell = grid::fetch_cell(values[0], values[2]);
        particles.emplace_back(values[0], values[1], values[2], 1, 1, 1, cell);
    }
}


}

