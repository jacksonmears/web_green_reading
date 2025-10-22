#include <emscripten.h>
#include <vector>
#include <string>
#include <sstream>
#include <iostream>

namespace parse {

struct Particle { 
    float x,y,z; 
    float r,g,b; 
    size_t grid_index; 
};


// old rigid parsing logic here, but working on a string
EMSCRIPTEN_KEEPALIVE
void parseXYZBuffer(char* buffer, int length, Particle* outParticles, int* outCount) {
    std::vector<Particle> particles;

    std::string content(buffer, length); // convert raw bytes to string
    std::istringstream ss(content);
    std::string line;

    while (std::getline(ss, line)) {
        Particle p;
        std::istringstream lineStream(line);
        lineStream >> p.x >> p.y >> p.z;
        particles.push_back(p);
    }

    // Copy to the output buffer passed from JS
    int count = 0;
    for (auto& p : particles) {
        outParticles[count++] = p;
        if (count >= *outCount) break; // avoid overflow
    }
    *outCount = count;

    std::cout << "Parsed " << count << " particles\n";
}

} // namespace parse
