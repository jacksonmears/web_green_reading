#include <emscripten.h>
#include <vector>
#include <cstdio>
#include "../include/Particle.h"
#include "../include/Parse.h"
#include "../include/Grid.h"

extern "C" {

EMSCRIPTEN_KEEPALIVE
int add(int a, int b) {
    return a + b;
}

EMSCRIPTEN_KEEPALIVE
size_t parseXYZ(char* data, size_t length) {
    printf("parseXYZ called! length = %zu\n", length);
    std::fflush(stdout);

    try {
        std::vector<particle::Particle> particles;
        parse::readXYZFastFromBuffer(data, length, particles);
        printf("✅ parsed %zu particles\n", particles.size());
        std::fflush(stdout);
        return particles.size();
    } catch (const std::exception& e) {
        printf("❌ Exception: %s\n", e.what());
        std::fflush(stdout);
        return 0;
    } catch (...) {
        printf("❌ Unknown exception!\n");
        std::fflush(stdout);
        return 0;
    }
}

}
