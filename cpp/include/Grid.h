#pragma once

#include <vector>
#include <utility>
#include <cstddef> // size_t
#include <unordered_map>
// #include "../external/flat_hash_map.hpp"

namespace geometry { struct Cell; }  // forward declaration

namespace grid {

extern float grid_resolution; 

std::pair<int,int> quantize(float x, float y);

size_t hashCell(int gx, int gy);

size_t fetch_cell(float x, float y);

std::vector<geometry::Cell*> getNeighbors(float x, float y, std::unordered_map<size_t, geometry::Cell>& cellMap);

}