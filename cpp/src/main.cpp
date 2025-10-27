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
extern "C" EMSCRIPTEN_KEEPALIVE
float* parseXYZFlattened(uint8_t* data, size_t length, int* outCount, float** outCellBuffer, int* outCellCount) {
    std::vector<particle::Particle> particles;
    std::unordered_map<size_t, geometry::Cell> cellMap;

    parse::readXYZFastFromBuffer(reinterpret_cast<char*>(data), length, particles);
    particle::sortParticles(particles);
    geometry::fillCellMap(particles, cellMap);
    color::applyColorGradient(particles, cellMap);

    *outCount = particles.size();
    float* particleBuffer = (float*)malloc(particles.size() * 6 * sizeof(float));
    for (size_t i = 0; i < particles.size(); ++i) {
        particleBuffer[i*6+0] = particles[i].x;
        particleBuffer[i*6+1] = particles[i].y;
        particleBuffer[i*6+2] = particles[i].z;
        particleBuffer[i*6+3] = particles[i].r;
        particleBuffer[i*6+4] = particles[i].g;
        particleBuffer[i*6+5] = particles[i].b;
    }

    *outCellCount = cellMap.size();
    float* cellBuffer = (float*)malloc(cellMap.size() * 16 * sizeof(float));
    size_t idx = 0;
    for (auto& [key, cell] : cellMap) {
        cellBuffer[idx+0]  = (float)cell.start_index;
        cellBuffer[idx+1]  = (float)cell.end_index;
        const auto& p = cell.plane;
        cellBuffer[idx+2]  = p.a;
        cellBuffer[idx+3]  = p.b;
        cellBuffer[idx+4]  = p.len;
        cellBuffer[idx+5]  = p.slopePercent;
        cellBuffer[idx+6]  = p.dx;
        cellBuffer[idx+7]  = p.dz;
        cellBuffer[idx+8]  = p.endX;
        cellBuffer[idx+9]  = p.endY;
        cellBuffer[idx+10] = p.endZ;
        cellBuffer[idx+11] = p.color;
        cellBuffer[idx+12] = p.xBar;
        cellBuffer[idx+13] = p.yBar;
        cellBuffer[idx+14] = p.zBar;
        cellBuffer[idx+15] = p.valid ? 1.f : 0.f;
        idx += 16;
    }

    *outCellBuffer = cellBuffer;
    return particleBuffer;
}


// Free memory allocated for float array
EMSCRIPTEN_KEEPALIVE
void freeParticles(float* ptr) {
    free(ptr);
}

}
