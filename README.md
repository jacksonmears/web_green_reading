# GreenReader

**Version:** 1.0  
**Stack:** React + Vite + Emscripten (WASM)

GreenReader is a small React application for reading `.xyz` particle files, processing them via a WebAssembly (WASM) module, and rendering particles and cell buffers on an HTML5 canvas.

---

## Usage

https://jacksonmears.github.io/web_green_reading

- Generate a LiDAR scan of a golf green (e.g., 3D Scanner App on iPhone)  
- Save the `.xyz` file (either space or comma delimited)  
- Upload the file to the website  

That's it.

---

## Methodology

GreenReader converts a 3D point cloud (`.xyz` file) into a visual representation of a green's surface and calculates slope information using a combination of WASM-accelerated C++ code and JavaScript for rendering.

The process involves the following steps:

### 1. Loading and parsing the `.xyz` file

- The uploaded `.xyz` file contains 3D point coordinates (`x`, `y`, `z`).  
- Using WebAssembly, the raw file bytes are passed into the C++ parser via `parseXYZFlattened`.  
- The parser:
  - Reads the points into `Particle` objects.
  - Sorts particles spatially for easier cell-based processing.
  - Divides the point cloud into **cells**, which are small regions of the green.

### 2. Creating cells and fitting planes

- Each cell contains a subset of nearby particles.  
- The plane fitting algorithm computes the local slope for each cell:
  1. Compute the centroid (`x̄`, `ȳ`, `z̄`) of particles in the cell.  
  2. Calculate deviations from the centroid (`dx`, `dy`, `dz`).  
  3. Fit a plane `y = a*x + b*z + c` using least squares regression on the particle points.  
  4. Calculate the **normal vector** of the plane and the slope percentage.  
  5. Mark the plane as valid only if the cell contains sufficient points (e.g., >3000).  

- This approach gives a smooth representation of the surface, with local slopes computed efficiently.

### 3. Calculating slope weights

- Neighboring cells influence the slope value for each particle:
  - Linear falloff: closer cells contribute more.  
  - Polynomial falloff: smooth weighting for visual gradients.  
- Weighted slopes are aggregated to provide a realistic slope metric for each particle.

### 4. Coloring and visualization

- Particle colors are assigned based on slope magnitude using a gradient (from flat to steep).  
- `drawParticles` and `drawCellArrows` render the point cloud and slope vectors on an HTML5 canvas.  
- All computations in the critical loop (plane fitting, slope calculation) are executed in **C++ compiled to WASM**, giving near-native performance in the browser.

### 5. Tools used

| Tool / Library | Purpose |
|----------------|---------|
| **React** | UI framework for state management and event handling. |
| **Vite** | Fast bundler for modern JavaScript development. |
| **Emscripten** | Compiles C++ code into WebAssembly to run plane fitting, slope calculation, and memory management in the browser. |
| **HTML5 Canvas** | 2D rendering of point clouds and slope arrows. |
| **ska::flat_hash_map** | Efficient hash map in C++ for storing cells and neighbor relationships. |
| **C++ STL & Math libraries** | Core algorithms for linear regression, slope computation, and plane fitting. |

### 6. Memory management

- WASM modules allocate memory for float arrays (particles and cells).  
- The JS layer calls `freeParticles` to prevent memory leaks.  
- Typed arrays (`Float32Array`) are used to efficiently read WASM memory buffers in JavaScript.

---

### Summary

GreenReader combines:

- **High-performance computation** via C++ and WASM.  
- **Flexible UI and interactivity** via React and HTML5 Canvas.  
- **Efficient spatial data structures** (cells, hash maps) for slope estimation.  

This allows fast visualization and analysis of golf green surfaces from raw 3D scan data, enabling a web-based, interactive slope inspection tool.
