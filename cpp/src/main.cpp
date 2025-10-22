#include <emscripten.h>
#include "../include/Particle.h"
#include "../include/Parse.h"
#include "../include/Grid.h"
#include "../include/Slope.h"
#include "../include/Color.h"

#include <vector>
#include <unordered_map>
#include <cstdio>

extern "C" {

// Returns a pointer to a float array: [x, y, z, r, g, b, x, y, z, r, g, b, ...]
// outCount is the number of particles
EMSCRIPTEN_KEEPALIVE
float* parseXYZFlattened(uint8_t* data, size_t length, int* outCount) {
    try {
        std::vector<particle::Particle> particles;
        std::unordered_map<size_t, geometry::Cell> cellMap;

        parse::readXYZFastFromBuffer(reinterpret_cast<char*>(data), length, particles);
        particle::sortParticles(particles);
        geometry::fillCellMap(particles, cellMap);
        color::applyColorGradient(particles, cellMap);

        *outCount = particles.size();
        float* buffer = (float*)malloc(particles.size() * 6 * sizeof(float)); // 6 floats per particle

        for (size_t i = 0; i < particles.size(); ++i) {
            buffer[i * 6 + 0] = particles[i].x;
            buffer[i * 6 + 1] = particles[i].y;
            buffer[i * 6 + 2] = particles[i].z;
            buffer[i * 6 + 3] = particles[i].r;
            buffer[i * 6 + 4] = particles[i].g;
            buffer[i * 6 + 5] = particles[i].b;
        }

        printf("[WASM] Parsed %zu particles\n", particles.size());
        std::fflush(stdout);

        return buffer;
    } catch (...) {
        *outCount = 0;
        return nullptr;
    }
}

// Free memory allocated for float array
EMSCRIPTEN_KEEPALIVE
void freeParticles(float* ptr) {
    free(ptr);
}

}
