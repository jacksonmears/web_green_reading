#pragma once

#include <iostream>
#include <vector>
#include <unordered_map>
#include <algorithm>
// #include "../external/flat_hash_map.hpp"

namespace geometry { struct Cell; }

namespace particle {

struct Particle {
    float x, y, z;
    float r, g, b;
    size_t grid_index;

    Particle() = default;

    Particle(float x_, float y_, float z_, float r_, float g_, float b_, size_t grid_index_)
        : x(x_), y(y_), z(z_), r(r_), g(g_), b(b_), grid_index(grid_index_) {}
};


inline void sortParticles(std::vector<Particle>& particles) {
    std::sort(particles.begin(), particles.end(), [](const particle::Particle& a, const particle::Particle& b) { return a.grid_index < b.grid_index; });
}


void fillCellParticles(std::vector<Particle>& particles, std::unordered_map<size_t, geometry::Cell>& cellMap);

}