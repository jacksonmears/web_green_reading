#include <emscripten.h>
#include <vector>
#include "../include/Particle.h"
#include "../include/Parse.h"
#include "../include/Grid.h"

extern "C" {

// WASM-friendly entry point
EMSCRIPTEN_KEEPALIVE
size_t parseXYZFromMemory(char* data, particle::Particle* outArray) {
    std::vector<particle::Particle> particles;
    
    // Wrap the incoming memory buffer as a "file-like" pointer
    parse::readXYZFastFromBuffer(data, particles); // <-- new helper

    // Copy into outArray
    for (size_t i = 0; i < particles.size(); ++i) {
        outArray[i] = particles[i];
    }

    return particles.size();
}

}
