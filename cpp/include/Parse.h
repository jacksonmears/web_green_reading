#pragma once

#include <cstddef>
#include <vector>

namespace particle { struct Particle; }

namespace parse {

size_t getSizePCD(char* data, size_t length);

float parseFloat4Decimal(char*& data);

void readXYZFastFromBuffer(const char* data, size_t length, std::vector<particle::Particle>& particles);


}